const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const { HfInference } = require('@huggingface/inference');
const { cloudinary } = require('../config/cloudinary');
const Caption = require('../models/Caption');
const { optionalAuth, requireAuth } = require('../middleware/auth');

const router = express.Router();

const MAX_HF_RETRIES = 3;
const MAX_BATCH_FILES = 3;
const MIN_CAPTION_VARIANTS = 2;
const MAX_CAPTION_VARIANTS = 3;
const ALLOWED_TONES = ['neutral', 'poetic', 'funny', 'professional', 'instagram'];
const ALLOWED_PLATFORMS = ['general', 'instagram', 'linkedin', 'x', 'youtube'];
const ALLOWED_BRAND_VOICES = ['default', 'minimal', 'playful', 'luxury', 'bold', 'friendly'];
const ALLOWED_REWRITE_ACTIONS = ['shorten', 'addEmojis', 'makeFormal', 'makeFunny', 'ctaBoost'];
const ALLOWED_HISTORY_SORTS = ['newest', 'oldest', 'favorites'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_CLOUDINARY_FALLBACK_BYTES = 700 * 1024;
const isProduction = process.env.NODE_ENV === 'production';

const publicError = (err, status, fallback = 'Internal server error') => {
  if (!isProduction || status < 500) {
    return err.message;
  }

  return fallback;
};

const HF_VISION_MODEL = process.env.HF_VISION_MODEL || 'Qwen/Qwen3-VL-8B-Instruct';
const HF_PROVIDERS = (process.env.HF_PROVIDERS || 'together,novita')
  .split(',')
  .map((provider) => provider.trim())
  .filter(Boolean);

const HF_ALT_TEXT_PROMPT =
  'Write concise accessible alt text for this image in one sentence under 18 words.';

const PLATFORM_PRESETS = {
  general: {
    maxChars: 2200,
    hashtagCount: 5,
    cta: 'Share your thoughts.',
  },
  instagram: {
    maxChars: 2200,
    hashtagCount: 8,
    cta: 'Save this for later.',
  },
  linkedin: {
    maxChars: 3000,
    hashtagCount: 4,
    cta: 'What is your take on this?',
  },
  x: {
    maxChars: 280,
    hashtagCount: 2,
    cta: '',
  },
  youtube: {
    maxChars: 5000,
    hashtagCount: 5,
    cta: 'Subscribe for more content like this.',
  },
};

const createHttpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeEnum = (value, allowedValues, fallback) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (allowedValues.includes(normalized)) {
    return normalized;
  }
  return fallback;
};

const parseIntegerInRange = (value, fallback, min, max) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
};

const parseBooleanFlag = (value) => {
  if (value === true || value === 'true') {
    return true;
  }

  if (value === false || value === 'false') {
    return false;
  }

  return null;
};

const buildCaptionVariantsPrompt = ({ tone, platform, brandVoice, variantsCount }) => {
  return [
    'Generate social media captions for this image.',
    `Create exactly ${variantsCount} distinct caption options.`,
    `Tone: ${tone}. Platform: ${platform}. Brand voice: ${brandVoice}.`,
    'Each caption must be under 20 words.',
    'Do not include hashtags.',
    'Return only a numbered list (1., 2., 3.) with captions and nothing else.',
  ].join(' ');
};

const extractCaptionCandidates = (rawText) => {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const numbered = lines
    .map((line) => line.match(/^\d+\s*[.)\-:]\s*(.+)$/))
    .filter(Boolean)
    .map((match) => sanitizeText(match[1]));

  const source = numbered.length > 0 ? numbered : lines;

  const cleaned = source
    .map((line) => sanitizeText(line.replace(/^[-*]\s*/, '')))
    .map((line) => line.replace(/^caption\s*\d*\s*[:\-]\s*/i, ''))
    .map((line) => sanitizeText(line))
    .filter(Boolean);

  return [...new Set(cleaned)];
};

const encodeCursor = (payload) => {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
};

const decodeCursor = (token) => {
  try {
    if (!token) {
      return null;
    }

    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded);

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const buildSortClause = (sortBy) => {
  if (sortBy === 'oldest') {
    return { createdAt: 1, _id: 1 };
  }

  if (sortBy === 'favorites') {
    return { favorite: -1, createdAt: -1, _id: -1 };
  }

  return { createdAt: -1, _id: -1 };
};

const buildCursorFilter = (sortBy, cursorPayload) => {
  if (!cursorPayload) {
    return null;
  }

  const cursorCreatedAt = new Date(cursorPayload.createdAt);
  const cursorId = cursorPayload.id;

  if (Number.isNaN(cursorCreatedAt.getTime()) || !isValidObjectId(cursorId)) {
    return null;
  }

  const cursorObjectId = new mongoose.Types.ObjectId(cursorId);

  if (sortBy === 'oldest') {
    return {
      $or: [
        { createdAt: { $gt: cursorCreatedAt } },
        {
          createdAt: cursorCreatedAt,
          _id: { $gt: cursorObjectId },
        },
      ],
    };
  }

  if (sortBy === 'favorites') {
    const cursorFavorite = Boolean(cursorPayload.favorite);

    if (cursorFavorite) {
      return {
        $or: [
          {
            favorite: true,
            createdAt: { $lt: cursorCreatedAt },
          },
          {
            favorite: true,
            createdAt: cursorCreatedAt,
            _id: { $lt: cursorObjectId },
          },
          { favorite: false },
        ],
      };
    }

    return {
      $or: [
        {
          favorite: false,
          createdAt: { $lt: cursorCreatedAt },
        },
        {
          favorite: false,
          createdAt: cursorCreatedAt,
          _id: { $lt: cursorObjectId },
        },
      ],
    };
  }

  return {
    $or: [
      { createdAt: { $lt: cursorCreatedAt } },
      {
        createdAt: cursorCreatedAt,
        _id: { $lt: cursorObjectId },
      },
    ],
  };
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sanitizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const trimToSentence = (value) => {
  const text = sanitizeText(value);
  if (!text) {
    return text;
  }

  return /[.!?]$/.test(text) ? text : `${text}.`;
};

const clampCaptionLength = (value, maxChars) => {
  const text = sanitizeText(value);
  if (!text || text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars - 1).trimEnd()}...`;
};

const generateHashtags = (caption, maxTags = 6) => {
  const stopWords = [
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'this',
    'that', 'from', 'into', 'your', 'their', 'have', 'has', 'had',
  ];

  const words = sanitizeText(caption)
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(' ')
    .filter((word) => word.length > 3 && !stopWords.includes(word));

  return [...new Set(words)]
    .slice(0, maxTags)
    .map((word) => `#${word}`);
};

const appendUniqueHashtags = (primary, extra, maxTags) => {
  const normalizeTag = (tag) => {
    const clean = sanitizeText(tag).replace(/\s+/g, '');
    if (!clean) {
      return null;
    }

    return clean.startsWith('#') ? clean.toLowerCase() : `#${clean.toLowerCase()}`;
  };

  const merged = [];
  for (const tag of [...(primary || []), ...(extra || [])]) {
    const normalized = normalizeTag(tag);
    if (!normalized) {
      continue;
    }

    if (!merged.includes(normalized)) {
      merged.push(normalized);
    }

    if (merged.length >= maxTags) {
      break;
    }
  }

  return merged;
};

const applyTone = (caption, tone) => {
  const text = sanitizeText(caption);

  const toneHandlers = {
    neutral: (content) => content,
    poetic: (content) => `In soft light, ${content}`,
    funny: (content) => `${content} And yes, it understood the assignment.`,
    professional: (content) => `Key insight: ${content}`,
    instagram: (content) => `${content} Made for your feed.`,
  };

  return (toneHandlers[tone] || toneHandlers.neutral)(text);
};

const applyBrandVoice = (caption, brandVoice) => {
  const text = sanitizeText(caption);

  const handlers = {
    default: (content) => content,
    minimal: (content) => clampCaptionLength(content, 90),
    playful: (content) => `${content} Keep it fun and authentic.`,
    luxury: (content) => `Elevated mood: ${content}`,
    bold: (content) => `${content} Make it count.`,
    friendly: (content) => `${content} Thanks for being here.`,
  };

  return (handlers[brandVoice] || handlers.default)(text);
};

const applyPlatformPreset = (caption, hashtags, platform) => {
  const preset = PLATFORM_PRESETS[platform] || PLATFORM_PRESETS.general;
  let nextCaption = sanitizeText(caption);

  if (preset.cta && !nextCaption.toLowerCase().includes(preset.cta.toLowerCase())) {
    const withPunctuation = trimToSentence(nextCaption);
    const ctaCandidate = `${withPunctuation} ${preset.cta}`;
    nextCaption = ctaCandidate.length <= preset.maxChars ? ctaCandidate : withPunctuation;
  }

  nextCaption = clampCaptionLength(nextCaption, preset.maxChars);

  return {
    caption: nextCaption,
    hashtags: appendUniqueHashtags(hashtags, [], preset.hashtagCount),
  };
};

const buildVariants = (baseCaption, baseHashtags, requestedCount, options) => {
  const variantsCount = parseIntegerInRange(requestedCount, 3, 1, 5);
  const transforms = [
    (caption) => caption,
    (caption) => `Fresh angle: ${caption}`,
    (caption) => `${caption} Tell us what you think.`,
    (caption) => `Another take: ${caption}`,
    (caption) => `Short version: ${clampCaptionLength(caption, 90)}`,
  ];

  const variants = [];
  const seen = new Set();

  for (let i = 0; i < transforms.length && variants.length < variantsCount; i += 1) {
    const transformed = sanitizeText(transforms[i](baseCaption));
    const formatted = applyPlatformPreset(transformed, baseHashtags, options.platform);
    const signature = formatted.caption.toLowerCase();

    if (!seen.has(signature)) {
      seen.add(signature);
      variants.push(formatted);
    }
  }

  while (variants.length < variantsCount) {
    variants.push(variants[0]);
  }

  return variants;
};

const composeCaptionVariants = ({ candidates, tone, platform, brandVoice, variantsCount }) => {
  const preset = PLATFORM_PRESETS[platform] || PLATFORM_PRESETS.general;
  const uniqueVariants = [];

  for (const candidate of candidates) {
    const toned = applyTone(candidate, tone);
    const voiced = applyBrandVoice(toned, brandVoice);
    const hashtags = generateHashtags(candidate, preset.hashtagCount);
    const variant = applyPlatformPreset(voiced, hashtags, platform);

    if (!variant.caption) {
      continue;
    }

    if (!uniqueVariants.some((entry) => entry.caption.toLowerCase() === variant.caption.toLowerCase())) {
      uniqueVariants.push(variant);
    }

    if (uniqueVariants.length >= variantsCount) {
      break;
    }
  }

  const seedCaption = uniqueVariants[0]?.caption || candidates[0] || 'A memorable moment worth sharing.';
  const seedHashtags = uniqueVariants[0]?.hashtags || generateHashtags(seedCaption, preset.hashtagCount);

  if (uniqueVariants.length < variantsCount) {
    const fallbackVariants = buildVariants(seedCaption, seedHashtags, variantsCount, { platform });
    for (const fallbackVariant of fallbackVariants) {
      if (!uniqueVariants.some((entry) => entry.caption.toLowerCase() === fallbackVariant.caption.toLowerCase())) {
        uniqueVariants.push(fallbackVariant);
      }

      if (uniqueVariants.length >= variantsCount) {
        break;
      }
    }
  }

  return uniqueVariants.slice(0, variantsCount);
};

const rewriteCaption = (caption, action, platform) => {
  const preset = PLATFORM_PRESETS[platform] || PLATFORM_PRESETS.general;
  const safeCaption = sanitizeText(caption);

  const handlers = {
    shorten: (content) => clampCaptionLength(content, Math.min(90, preset.maxChars)),
    addEmojis: (content) => `${content} ✨📸`,
    makeFormal: (content) => `In summary, ${content}`,
    makeFunny: (content) => `${content} Plot twist: it is even better in person.`,
    ctaBoost: (content) => {
      if (!preset.cta) {
        return `${trimToSentence(content)} Let us know in the comments.`;
      }
      return `${trimToSentence(content)} ${preset.cta}`;
    },
  };

  const rewritten = (handlers[action] || handlers.shorten)(safeCaption);
  return clampCaptionLength(rewritten, preset.maxChars);
};

const requestTextFromHuggingFace = async (imageDataUrl, prompt, options = {}) => {
  const hf = new HfInference(process.env.HF_TOKEN);
  let retries = MAX_HF_RETRIES;
  let lastError = null;

  while (retries > 0) {
    for (const provider of HF_PROVIDERS) {
      try {
        const response = await hf.chatCompletion({
          model: HF_VISION_MODEL,
          provider,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imageDataUrl } },
              ],
            },
          ],
          max_tokens: options.maxTokens || 70,
          temperature: options.temperature ?? 0.2,
        });

        const rawContent = response?.choices?.[0]?.message?.content;
        const normalizedContent = Array.isArray(rawContent)
          ? rawContent
            .map((part) => (typeof part?.text === 'string' ? part.text : ''))
            .join('\n')
          : String(rawContent || '');

        const generatedText = options.preserveLineBreaks
          ? normalizedContent.trim()
          : sanitizeText(normalizedContent);

        if (!generatedText) {
          throw createHttpError(502, 'Caption model returned empty output');
        }

        return generatedText;
      } catch (providerErr) {
        lastError = providerErr;
      }
    }

    retries -= 1;

    if (retries > 0) {
      await sleep(1500);
    }
  }

  const message = lastError?.message || 'HuggingFace request failed';

  if (/no inference provider available|inference provider information/i.test(message)) {
    throw createHttpError(
      502,
      'No supported inference provider is available for the configured caption model.'
    );
  }

  throw createHttpError(502, message);
};

const generateAltTextFallback = (caption) => {
  const noHashtags = sanitizeText(caption).replace(/#[^\s]+/g, '');
  if (!noHashtags) {
    return 'Image with visual content suitable for social media.';
  }

  return clampCaptionLength(`Image showing ${noHashtags.toLowerCase()}.`, 180);
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(createHttpError(400, 'Only JPG, PNG, and WEBP images are allowed'));
    }
    return cb(null, true);
  },
});

const uploadImageToCloudinary = async (imageDataUrl) => {
  return cloudinary.uploader.upload(imageDataUrl, {
    folder: 'image-captions',
    resource_type: 'image',
    transformation: [{ width: 800, crop: 'limit' }],
  });
};

const parseGenerationOptions = (body = {}) => {
  return {
    tone: normalizeEnum(body.tone, ALLOWED_TONES, 'neutral'),
    platform: normalizeEnum(body.platform, ALLOWED_PLATFORMS, 'general'),
    brandVoice: normalizeEnum(body.brandVoice, ALLOWED_BRAND_VOICES, 'default'),
    variantsCount: parseIntegerInRange(
      body.variantsCount,
      3,
      MIN_CAPTION_VARIANTS,
      MAX_CAPTION_VARIANTS
    ),
  };
};

const processSingleImage = async ({ file, userId, tone, platform, brandVoice, variantsCount }) => {
  let uploadedImagePublicId = null;
  let captionWasPersisted = false;

  try {
    const imageBuffer = file.buffer;
    const mimeType = file.mimetype;
    const imageDataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

    const fallbackImageUrl = imageBuffer.length <= MAX_CLOUDINARY_FALLBACK_BYTES
      ? imageDataUrl
      : null;

    let imageUrl = fallbackImageUrl;
    let cloudinaryUploadFailed = false;

    try {
      const uploadedImage = await uploadImageToCloudinary(imageDataUrl);
      uploadedImagePublicId = uploadedImage.public_id;
      imageUrl = uploadedImage.secure_url;
    } catch (cloudErr) {
      cloudinaryUploadFailed = true;
      console.error('Cloudinary upload error:', cloudErr.message);
    }

    const variantsPrompt = buildCaptionVariantsPrompt({
      tone,
      platform,
      brandVoice,
      variantsCount,
    });

    const rawCaptionOutput = await requestTextFromHuggingFace(imageDataUrl, variantsPrompt, {
      maxTokens: 220,
      temperature: 0.45,
      preserveLineBreaks: true,
    });

    const rawCandidates = extractCaptionCandidates(rawCaptionOutput);
    if (rawCandidates.length === 0) {
      throw createHttpError(502, 'Caption model returned no valid caption options');
    }

    const variants = composeCaptionVariants({
      candidates: rawCandidates,
      tone,
      platform,
      brandVoice,
      variantsCount,
    });

    if (variants.length === 0) {
      throw createHttpError(502, 'Could not build caption variants from model output');
    }

    const primaryVariant = variants[0];

    let altText;
    try {
      altText = await requestTextFromHuggingFace(imageDataUrl, HF_ALT_TEXT_PROMPT, {
        maxTokens: 45,
        temperature: 0.1,
      });
      altText = clampCaptionLength(altText, 180);
    } catch {
      altText = generateAltTextFallback(primaryVariant.caption);
    }

    let saved = null;
    if (userId && uploadedImagePublicId && imageUrl) {
      saved = await Caption.create({
        user: userId,
        imageUrl,
        imagePublicId: uploadedImagePublicId,
        caption: primaryVariant.caption,
        hashtags: primaryVariant.hashtags,
        tone,
        platform,
        brandVoice,
        altText,
        variants,
      });
      captionWasPersisted = true;
    }

    const warnings = [];
    if (cloudinaryUploadFailed) {
      warnings.push(
        userId
          ? 'Image hosting is temporarily unavailable. Caption generated, but this item was not saved to history.'
          : 'Image hosting is temporarily unavailable. Caption was generated successfully.'
      );
    }

    if (!imageUrl) {
      warnings.push('Image preview is unavailable for large files right now.');
    }

    return {
      caption: primaryVariant.caption,
      hashtags: primaryVariant.hashtags,
      variants,
      altText,
      imageUrl,
      id: saved?._id || null,
      tone,
      platform,
      brandVoice,
      warning: warnings.length ? warnings.join(' ') : null,
    };
  } catch (err) {
    if (uploadedImagePublicId && !captionWasPersisted) {
      try {
        await cloudinary.uploader.destroy(uploadedImagePublicId);
      } catch (cleanupErr) {
        console.error('Cloudinary cleanup error:', cleanupErr.message);
      }
    }

    throw err;
  }
};

router.post('/', optionalAuth, upload.single('image'), async (req, res) => {
  try {
    if (!process.env.HF_TOKEN) {
      return res.status(500).json({ error: 'HF_TOKEN is not configured on the server' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const options = parseGenerationOptions(req.body);
    const payload = await processSingleImage({
      file: req.file,
      userId: req.userId,
      ...options,
    });

    res.json(payload);
  } catch (err) {
    console.error('Caption error:', err.message);
    const status = err.status && Number.isInteger(err.status) ? err.status : 500;
    const message = publicError(err, status, 'Caption generation failed. Please try again.');
    res.status(status).json({ error: message });
  }
});

router.post('/batch', optionalAuth, upload.array('images', MAX_BATCH_FILES), async (req, res) => {
  try {
    if (!process.env.HF_TOKEN) {
      return res.status(500).json({ error: 'HF_TOKEN is not configured on the server' });
    }

    if (!Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    const options = parseGenerationOptions(req.body);
    const results = [];

    for (let index = 0; index < req.files.length; index += 1) {
      const file = req.files[index];

      try {
        const payload = await processSingleImage({
          file,
          userId: req.userId,
          ...options,
        });

        results.push({
          success: true,
          index,
          filename: file.originalname,
          ...payload,
        });
      } catch (err) {
        console.error('Batch caption error:', err.message);
        const status = err.status && Number.isInteger(err.status) ? err.status : 500;
        const message = publicError(err, status, 'Image could not be processed right now.');
        results.push({
          success: false,
          index,
          filename: file.originalname,
          error: message,
        });
      }
    }

    const successCount = results.filter((item) => item.success).length;
    if (successCount === 0) {
      return res.status(502).json({
        error: 'Unable to process any images in this batch',
        results,
      });
    }

    return res.json({
      results,
      warning: successCount < results.length
        ? 'Some images could not be processed. Try re-uploading failed items.'
        : null,
    });
  } catch (err) {
    console.error('Batch caption error:', err.message);
    const status = err.status && Number.isInteger(err.status) ? err.status : 500;
    const message = publicError(err, status, 'Batch processing failed. Please try again.');
    res.status(status).json({ error: message });
  }
});

router.get('/history', requireAuth, async (req, res) => {
  try {
    const filters = { user: req.userId };
    const sortBy = normalizeEnum(req.query.sort, ALLOWED_HISTORY_SORTS, 'newest');
    const paginationMode = String(req.query.pagination || 'page').toLowerCase();
    const useCursorPagination = paginationMode === 'cursor' || Boolean(req.query.cursor);

    const toneFilter = normalizeEnum(req.query.tone, ALLOWED_TONES, null);
    if (toneFilter) {
      filters.tone = toneFilter;
    }

    const platformFilter = normalizeEnum(req.query.platform, ALLOWED_PLATFORMS, null);
    if (platformFilter) {
      filters.platform = platformFilter;
    }

    const favorite = parseBooleanFlag(req.query.favorite);
    if (favorite !== null) {
      filters.favorite = favorite;
    }

    const queryText = sanitizeText(req.query.q || '');
    if (queryText) {
      const escapedQuery = escapeRegex(queryText);
      filters.$or = [
        { caption: { $regex: escapedQuery, $options: 'i' } },
        { altText: { $regex: escapedQuery, $options: 'i' } },
        { hashtags: { $elemMatch: { $regex: escapedQuery, $options: 'i' } } },
      ];
    }

    const createdAtFilter = {};

    if (req.query.from) {
      const fromDate = new Date(req.query.from);
      if (!Number.isNaN(fromDate.getTime())) {
        createdAtFilter.$gte = fromDate;
      }
    }

    if (req.query.to) {
      const toDate = new Date(req.query.to);
      if (!Number.isNaN(toDate.getTime())) {
        toDate.setHours(23, 59, 59, 999);
        createdAtFilter.$lte = toDate;
      }
    }

    if (Object.keys(createdAtFilter).length > 0) {
      filters.createdAt = createdAtFilter;
    }

    const limit = parseIntegerInRange(req.query.limit, 12, 1, 120);

    if (useCursorPagination) {
      const cursorPayload = decodeCursor(String(req.query.cursor || ''));
      const cursorFilter = buildCursorFilter(sortBy, cursorPayload);

      if (req.query.cursor && !cursorFilter) {
        return res.status(400).json({ error: 'Invalid cursor token' });
      }

      const cursorAwareFilters = { ...filters };
      if (cursorFilter) {
        cursorAwareFilters.$and = [cursorFilter];
      }

      const docs = await Caption.find(cursorAwareFilters)
        .sort(buildSortClause(sortBy))
        .limit(limit + 1);

      const hasMore = docs.length > limit;
      const history = hasMore ? docs.slice(0, limit) : docs;

      let nextCursor = '';
      if (hasMore && history.length > 0) {
        const lastItem = history[history.length - 1];
        nextCursor = encodeCursor({
          id: String(lastItem._id),
          createdAt: lastItem.createdAt,
          favorite: Boolean(lastItem.favorite),
        });
      }

      res.set('X-Pagination-Mode', 'cursor');
      res.set('X-Limit', String(limit));
      res.set('X-Sort', sortBy);
      res.set('X-Has-More', String(hasMore));
      res.set('X-Next-Cursor', nextCursor);

      return res.json(history);
    }

    const page = parseIntegerInRange(req.query.page, 1, 1, 2000);
    const skip = (page - 1) * limit;

    const [history, totalCount] = await Promise.all([
      Caption.find(filters)
        .sort(buildSortClause(sortBy))
        .skip(skip)
        .limit(limit),
      Caption.countDocuments(filters),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    res.set('X-Pagination-Mode', 'page');
    res.set('X-Total-Count', String(totalCount));
    res.set('X-Page', String(page));
    res.set('X-Limit', String(limit));
    res.set('X-Total-Pages', String(totalPages));
    res.set('X-Sort', sortBy);

    return res.json(history);
  } catch (err) {
    console.error('History fetch error:', err.message);
    res.status(500).json({ error: isProduction ? 'Internal server error' : err.message });
  }
});

router.post('/rewrite', optionalAuth, async (req, res) => {
  try {
    const caption = sanitizeText(req.body?.caption);
    if (!caption) {
      return res.status(400).json({ error: 'Caption text is required for rewrite' });
    }

    const platform = normalizeEnum(req.body?.platform, ALLOWED_PLATFORMS, 'general');
    const action = normalizeEnum(req.body?.action, ALLOWED_REWRITE_ACTIONS, 'shorten');

    const incomingHashtags = Array.isArray(req.body?.hashtags)
      ? req.body.hashtags
      : [];

    const rewrittenCaption = rewriteCaption(caption, action, platform);
    const generatedHashtags = generateHashtags(
      rewrittenCaption,
      PLATFORM_PRESETS[platform].hashtagCount
    );

    const hashtags = appendUniqueHashtags(
      incomingHashtags,
      generatedHashtags,
      PLATFORM_PRESETS[platform].hashtagCount
    );

    return res.json({
      caption: rewrittenCaption,
      hashtags,
      action,
      platform,
    });
  } catch (err) {
    const status = err.status && Number.isInteger(err.status) ? err.status : 500;
    const message = publicError(err, status, 'Rewrite failed. Please try again.');
    res.status(status).json({ error: message });
  }
});

router.patch('/:id/favorite', requireAuth, async (req, res) => {
  try {
    const item = await Caption.findOne({ _id: req.params.id, user: req.userId });
    if (!item) {
      return res.status(404).json({ error: 'Not found' });
    }

    const favorite = parseBooleanFlag(req.body?.favorite);
    item.favorite = favorite === null ? !item.favorite : favorite;

    await item.save();

    return res.json({
      id: item._id,
      favorite: item.favorite,
    });
  } catch (err) {
    console.error('Favorite update error:', err.message);
    res.status(500).json({ error: isProduction ? 'Internal server error' : err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const item = await Caption.findOne({ _id: req.params.id, user: req.userId });
    if (!item) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (item.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(item.imagePublicId);
      } catch (cleanupErr) {
        console.error('Cloudinary delete error:', cleanupErr.message);
      }
    }

    await item.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete caption error:', err.message);
    res.status(500).json({ error: isProduction ? 'Internal server error' : err.message });
  }
});

module.exports = router;
