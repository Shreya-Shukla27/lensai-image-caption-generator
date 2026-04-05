import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';

const REWRITE_ACTIONS = [
  { key: 'shorten', label: 'Shorten' },
  { key: 'addEmojis', label: 'Add emojis' },
  { key: 'makeFormal', label: 'Make formal' },
  { key: 'makeFunny', label: 'Make funny' },
  { key: 'ctaBoost', label: 'CTA boost' },
];

const normalizeVariants = (result) => {
  const fromApi = Array.isArray(result?.variants) ? result.variants : [];
  const cleaned = fromApi
    .map((variant) => {
      const caption = String(variant?.caption || '').trim();
      const hashtags = Array.isArray(variant?.hashtags) ? variant.hashtags : [];
      if (!caption) {
        return null;
      }

      return { caption, hashtags };
    })
    .filter(Boolean);

  if (cleaned.length > 0) {
    return cleaned;
  }

  return [{
    caption: String(result?.caption || '').trim(),
    hashtags: Array.isArray(result?.hashtags) ? result.hashtags : [],
  }];
};

export default function CaptionResult({ result, onReset }) {
  const [copied, setCopied] = useState(false);
  const [rewriteLoading, setRewriteLoading] = useState('');
  const [screenReaderMessage, setScreenReaderMessage] = useState('');
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [variants, setVariants] = useState(() => normalizeVariants(result));
  const [captionText, setCaptionText] = useState(() => normalizeVariants(result)[0]?.caption || '');
  const [hashtags, setHashtags] = useState(() => normalizeVariants(result)[0]?.hashtags || []);

  const announceTimerRef = useRef(null);

  useEffect(() => {
    const normalized = normalizeVariants(result);
    setVariants(normalized);
    setActiveVariantIndex(0);
    setCaptionText(normalized[0]?.caption || '');
    setHashtags(normalized[0]?.hashtags || []);
  }, [result]);

  useEffect(() => {
    return () => {
      if (announceTimerRef.current) {
        clearTimeout(announceTimerRef.current);
      }
    };
  }, []);

  const announce = (message) => {
    if (announceTimerRef.current) {
      clearTimeout(announceTimerRef.current);
    }

    setScreenReaderMessage('');
    announceTimerRef.current = setTimeout(() => {
      setScreenReaderMessage(message);
    }, 40);
  };

  const selectVariant = (index) => {
    const selected = variants[index];
    if (!selected) {
      return;
    }

    setActiveVariantIndex(index);
    setCaptionText(selected.caption);
    setHashtags(Array.isArray(selected.hashtags) ? selected.hashtags : []);
  };

  const copyAll = () => {
    const text = `${captionText}\n\n${hashtags.join(' ')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard!');
    announce('Caption and hashtags copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  const copyCaption = () => {
    navigator.clipboard.writeText(captionText);
    toast.success('Caption copied!');
    announce('Caption copied to clipboard.');
  };

  const copyHashtags = () => {
    navigator.clipboard.writeText(hashtags.join(' '));
    toast.success('Hashtags copied!');
    announce('Hashtags copied to clipboard.');
  };

  const copyVariant = (index) => {
    const selected = variants[index];
    if (!selected) {
      return;
    }

    const selectedHashtags = Array.isArray(selected.hashtags) ? selected.hashtags : [];
    const text = `${selected.caption}\n\n${selectedHashtags.join(' ')}`;
    navigator.clipboard.writeText(text);
    toast.success(`Variant ${index + 1} copied!`);
    announce(`Caption option ${index + 1} copied to clipboard.`);
  };

  const handleRewrite = async (action) => {
    try {
      setRewriteLoading(action);

      const res = await api.post('/caption/rewrite', {
        caption: captionText,
        hashtags,
        action,
        platform: result?.platform || 'general',
      });

      const rewrittenCaption = String(res.data?.caption || '').trim() || captionText;
      const rewrittenHashtags = Array.isArray(res.data?.hashtags) ? res.data.hashtags : hashtags;

      setCaptionText(rewrittenCaption);
      setHashtags(rewrittenHashtags);
      const targetVariantIndex = activeVariantIndex;
      setVariants((prev) => {
        if (!Array.isArray(prev) || prev.length === 0) {
          return [{ caption: rewrittenCaption, hashtags: rewrittenHashtags }];
        }

        const copy = [...prev];
        const safeIndex = Math.min(Math.max(targetVariantIndex, 0), copy.length - 1);
        copy[safeIndex] = { caption: rewrittenCaption, hashtags: rewrittenHashtags };
        return copy;
      });

      toast.success('Caption rewritten');
      announce('Caption rewritten successfully.');
    } catch (err) {
      const message = err.response?.data?.error || 'Rewrite failed';
      toast.error(message);
      announce('Caption rewrite failed.');
    } finally {
      setRewriteLoading('');
    }
  };

  return (
    <div className="animate-fade-up space-y-5 sm:space-y-6">
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {screenReaderMessage}
      </div>

      <div className="flex flex-wrap gap-2 text-xs font-mono text-muted">
        <span className="px-2 py-1 rounded border border-border bg-surface capitalize">
          Tone: {result?.tone || 'neutral'}
        </span>
        <span className="px-2 py-1 rounded border border-border bg-surface capitalize">
          Platform: {result?.platform || 'general'}
        </span>
        <span className="px-2 py-1 rounded border border-border bg-surface capitalize">
          Voice: {result?.brandVoice || 'default'}
        </span>
        <span className="px-2 py-1 rounded border border-border bg-surface">
          {captionText.length} chars
        </span>
      </div>

      {variants.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted font-mono">
            Caption options (generated together)
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {variants.map((variant, index) => (
              <div
                key={`${variant.caption.slice(0, 20)}-${index}`}
                className={`rounded-xl border p-3 space-y-3 transition-all ${index === activeVariantIndex ? 'bg-accent/10 border-accent/45' : 'bg-panel border-border'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-muted">Option {index + 1}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => selectVariant(index)}
                      className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-body transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 ${index === activeVariantIndex ? 'bg-accent/20 border-accent/55 text-accent-light' : 'bg-surface border-border text-muted hover:text-white hover:border-accent/30'}`}
                    >
                      Use
                    </button>
                    <button
                      type="button"
                      onClick={() => copyVariant(index)}
                      className="px-2.5 py-1.5 rounded-lg border border-border text-[11px] text-muted hover:text-white hover:border-accent/30 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <p className="text-sm text-white font-body leading-relaxed">{variant.caption}</p>

                <div className="flex flex-wrap gap-1.5">
                  {(variant.hashtags || []).map((tag) => (
                    <span key={`${tag}-${index}`} className="hashtag-chip text-xs">{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
        <div className="rounded-2xl overflow-hidden border border-border">
          {result?.imageUrl ? (
            <img
              src={result.imageUrl}
              alt="Uploaded"
              className="w-full h-52 sm:h-64 object-cover"
            />
          ) : (
            <div className="w-full h-52 sm:h-64 bg-surface flex items-center justify-center text-sm text-muted font-body">
              Image preview unavailable
            </div>
          )}
        </div>

        <div className="bg-panel border border-border rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-mono text-muted uppercase tracking-wider">
                Generated caption
              </span>
              <button
                type="button"
                onClick={copyCaption}
                aria-label="Copy generated caption"
                className="text-xs text-muted hover:text-accent transition-colors font-body flex items-center gap-1 px-1 py-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy
              </button>
            </div>
            <p className="font-body text-white leading-relaxed text-sm sm:text-base">
              {captionText}
            </p>
          </div>

          {result?.altText && (
            <div className="rounded-xl border border-border bg-surface/60 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wider text-muted font-mono mb-1">Alt text</p>
              <p className="text-xs sm:text-sm text-white/90 font-body">{result.altText}</p>
            </div>
          )}

          <div className="mt-2 pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-muted uppercase tracking-wider">
                Hashtags
              </span>
              <button
                type="button"
                onClick={copyHashtags}
                aria-label="Copy generated hashtags"
                className="text-xs text-muted hover:text-accent transition-colors font-body flex items-center gap-1 px-1 py-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {hashtags.map((tag) => (
                <span key={tag} className="hashtag-chip">{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted font-mono">Rewrite tools</p>
        <div className="flex flex-wrap gap-2">
          {REWRITE_ACTIONS.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => handleRewrite(action.key)}
              disabled={Boolean(rewriteLoading)}
              className={`px-3 py-2 rounded-lg border text-xs font-body transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 ${rewriteLoading === action.key ? 'bg-accent/20 border-accent/50 text-accent-light' : 'bg-panel border-border text-muted hover:border-accent/30 hover:text-white'} ${rewriteLoading && rewriteLoading !== action.key ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {rewriteLoading === action.key ? 'Rewriting...' : action.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={copyAll}
          aria-label="Copy caption and hashtags"
          className={`w-full sm:flex-1 py-3.5 rounded-xl font-body font-medium text-sm transition-all border
            ${copied
              ? 'bg-green-500/15 border-green-500/30 text-green-400'
              : 'bg-accent hover:bg-accent/90 border-transparent text-white'
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70`}
        >
          {copied ? 'Copied everything' : 'Copy caption + hashtags'}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-body text-sm text-muted border border-border hover:border-accent/30 hover:text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
        >
          New image
        </button>
      </div>
    </div>
  );
}
