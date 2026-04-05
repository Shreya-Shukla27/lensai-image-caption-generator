import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import UploadZone from '../components/UploadZone';
import ToneSelector from '../components/ToneSelector';
import CaptionResult from '../components/CaptionResult';
import api from '../utils/api';

const MAX_BATCH_FILES = 3;

const PLATFORM_OPTIONS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'x', label: 'X' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'general', label: 'General' },
];

const BRAND_VOICE_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'playful', label: 'Playful' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'bold', label: 'Bold' },
  { value: 'friendly', label: 'Friendly' },
];

export default function Home() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [batchFiles, setBatchFiles] = useState([]);
  const [batchMode, setBatchMode] = useState(false);

  const [tone, setTone] = useState('neutral');
  const [platform, setPlatform] = useState('instagram');
  const [brandVoice, setBrandVoice] = useState(() => {
    const stored = localStorage.getItem('lensai:brandVoice');
    const isValid = BRAND_VOICE_OPTIONS.some((option) => option.value === stored);
    return isValid ? stored : 'default';
  });
  const [variantsCount, setVariantsCount] = useState(3);

  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [inlineError, setInlineError] = useState('');
  const [result, setResult] = useState(null);
  const [batchResults, setBatchResults] = useState([]);

  const loadingTimersRef = useRef([]);

  const clearLoadingTimers = () => {
    loadingTimersRef.current.forEach((timer) => clearTimeout(timer));
    loadingTimersRef.current = [];
  };

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  useEffect(() => {
    return () => {
      clearLoadingTimers();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('lensai:brandVoice', brandVoice);
  }, [brandVoice]);

  const clearSingleSelection = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setFile(null);
    setPreview(null);
  };

  const handleFileSelect = (selectedFile) => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setBatchMode(false);
    setBatchFiles([]);
    setBatchResults([]);
    setResult(null);
    setInlineError('');

    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
  };

  const handleBatchFileSelect = (event) => {
    const selected = Array.from(event.target.files || []);
    if (selected.length === 0) {
      return;
    }

    if (selected.length > MAX_BATCH_FILES) {
      toast.error(`Batch mode supports up to ${MAX_BATCH_FILES} images at once.`);
    }

    const limited = selected.slice(0, MAX_BATCH_FILES);
    const validFiles = limited.filter((currentFile) => {
      if (!currentFile.type.startsWith('image/')) {
        return false;
      }

      if (currentFile.size > 5 * 1024 * 1024) {
        return false;
      }

      return true;
    });

    if (validFiles.length === 0) {
      toast.error('Choose valid image files under 5MB each.');
      return;
    }

    if (validFiles.length < limited.length) {
      toast.error('Some files were skipped (invalid type or over 5MB).');
    }

    clearSingleSelection();

    setBatchMode(true);
    setBatchFiles(validFiles);
    setResult(null);
    setBatchResults([]);
    setInlineError('');
  };

  const handleModeSwitch = (nextMode) => {
    const enableBatch = nextMode === 'batch';
    setBatchMode(enableBatch);
    setInlineError('');
    setResult(null);
    setBatchResults([]);

    if (enableBatch) {
      clearSingleSelection();
    } else {
      setBatchFiles([]);
    }
  };

  const hasInput = batchMode ? batchFiles.length > 0 : !!file;

  const applyGenerationSettings = (formData) => {
    formData.append('tone', tone);
    formData.append('platform', platform);
    formData.append('brandVoice', brandVoice);
    formData.append('variantsCount', String(variantsCount));
  };

  const handleGenerate = async () => {
    if (!hasInput) {
      const message = batchMode
        ? 'Please choose one or more images first.'
        : 'Please upload an image first.';
      setInlineError(message);
      toast.error(message);
      return;
    }

    clearLoadingTimers();
    setInlineError('');
    setLoading(true);
    setLoadingStage(batchMode ? 'Uploading batch images...' : 'Uploading image...');

    loadingTimersRef.current = [
      setTimeout(() => setLoadingStage('Generating caption variants...'), 1400),
      setTimeout(() => setLoadingStage('Creating alt text and finalizing...'), 5200),
    ];

    try {
      if (batchMode) {
        const formData = new FormData();
        batchFiles.forEach((currentFile) => {
          formData.append('images', currentFile);
        });
        applyGenerationSettings(formData);

        const res = await api.post('/caption/batch', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const results = Array.isArray(res.data?.results) ? res.data.results : [];
        const successCount = results.filter((item) => item.success).length;

        setResult(null);
        setBatchResults(results);

        if (successCount > 0) {
          toast.success(`Generated ${successCount} batch caption${successCount === 1 ? '' : 's'}!`);
        }

        if (res.data?.warning) {
          toast(res.data.warning, { duration: 5000 });
        }
      } else {
        const formData = new FormData();
        formData.append('image', file);
        applyGenerationSettings(formData);

        const res = await api.post('/caption', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        setBatchResults([]);
        setResult(res.data);
        toast.success('Caption generated!');

        if (res.data?.warning) {
          toast(res.data.warning, {
            duration: 5000,
          });
        }
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Something went wrong';
      setInlineError(msg);
      toast.error(msg);
    } finally {
      clearLoadingTimers();
      setLoadingStage('');
      setLoading(false);
    }
  };

  const handleReset = () => {
    clearLoadingTimers();

    clearSingleSelection();
    setBatchFiles([]);
    setResult(null);
    setBatchResults([]);

    setInlineError('');
    setLoadingStage('');
    setTone('neutral');
    setPlatform('instagram');
    setVariantsCount(3);
    setBatchMode(false);
  };

  const copyBatchItem = (item) => {
    const safeHashtags = Array.isArray(item.hashtags) ? item.hashtags : [];
    const text = `${item.caption}\n\n${safeHashtags.join(' ')}`;
    navigator.clipboard.writeText(text);
    toast.success('Batch caption copied!');
  };

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-12 sm:pb-16 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">

        <div className="text-center mb-8 sm:mb-12 animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent/10 border border-accent/20 rounded-full mb-5 sm:mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-slow" />
            <span className="text-xs font-mono text-accent-light tracking-wider">
              Powered by Vision AI
            </span>
          </div>
          <h1 className="font-display font-800 text-3xl sm:text-5xl text-white mb-3 sm:mb-4 leading-tight">
            Turn images into
            <br />
            <span className="text-accent">perfect captions</span>
          </h1>
          <p className="text-muted font-body text-base sm:text-lg max-w-xl mx-auto">
            Generate platform-ready captions, variants, brand voice styles, alt text, and batch outputs.
          </p>
        </div>

        <div className="glass rounded-3xl p-5 sm:p-8 glow" aria-busy={loading}>
          {result ? (
            <CaptionResult result={result} onReset={handleReset} />
          ) : batchResults.length > 0 ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="font-display text-xl text-white">Batch results</h2>
                  <p className="text-sm text-muted font-body">
                    {batchResults.filter((item) => item.success).length} success, {batchResults.filter((item) => !item.success).length} failed
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-5 py-2.5 rounded-xl border border-border text-sm text-muted hover:text-white hover:border-accent/40 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                >
                  New batch
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {batchResults.map((item, index) => (
                  <div key={`${item.filename}-${index}`} className="bg-panel border border-border rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-muted font-mono truncate">
                        {item.filename || `Image ${index + 1}`}
                      </p>
                      <span className={`text-xs font-mono px-2 py-1 rounded-full ${item.success ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                        {item.success ? 'Success' : 'Failed'}
                      </span>
                    </div>

                    {item.success ? (
                      <>
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="Batch item" className="w-full h-40 rounded-xl object-cover border border-border" />
                        ) : (
                          <div className="w-full h-40 rounded-xl bg-surface border border-border flex items-center justify-center text-xs text-muted font-body">
                            Preview unavailable
                          </div>
                        )}
                        <p className="text-white text-sm leading-relaxed font-body">{item.caption}</p>
                        {item.altText && (
                          <p className="text-xs text-muted font-body">Alt text: {item.altText}</p>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                          {(item.hashtags || []).map((tag) => (
                            <span key={`${item.filename}-${tag}`} className="hashtag-chip text-xs">{tag}</span>
                          ))}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex flex-wrap gap-2 text-[11px] text-muted font-mono">
                            <span className="px-2 py-1 rounded bg-surface border border-border capitalize">{item.platform || 'general'}</span>
                            <span className="px-2 py-1 rounded bg-surface border border-border capitalize">{item.brandVoice || 'default'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyBatchItem(item)}
                            className="px-3 py-1.5 text-xs rounded-lg bg-accent/15 text-accent-light border border-accent/40 hover:bg-accent/25 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                          >
                            Copy
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-red-200 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 font-body">
                        {item.error || 'Failed to process image.'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleModeSwitch('single')}
                  className={`px-4 py-3 rounded-xl border text-sm font-body transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 ${!batchMode ? 'bg-accent/20 border-accent/50 text-white' : 'bg-panel border-border text-muted hover:border-accent/40 hover:text-white'}`}
                >
                  Single image mode
                </button>
                <button
                  type="button"
                  onClick={() => handleModeSwitch('batch')}
                  className={`px-4 py-3 rounded-xl border text-sm font-body transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 ${batchMode ? 'bg-accent/20 border-accent/50 text-white' : 'bg-panel border-border text-muted hover:border-accent/40 hover:text-white'}`}
                >
                  Batch mode (up to 3)
                </button>
              </div>

              {!batchMode ? (
                <UploadZone onFileSelect={handleFileSelect} preview={preview} />
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-panel/30 p-5 sm:p-6 text-center">
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-accent/40 text-accent-light text-sm font-body cursor-pointer hover:bg-accent/10 transition-all focus-within:outline-none focus-within:ring-2 focus-within:ring-accent/70">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleBatchFileSelect}
                      className="sr-only"
                    />
                    Choose images
                  </label>
                  <p className="mt-3 text-xs text-muted font-body">
                    JPG, PNG, WEBP only · max 5MB each · up to {MAX_BATCH_FILES} images
                  </p>

                  {batchFiles.length > 0 && (
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {batchFiles.map((currentFile) => (
                        <span
                          key={`${currentFile.name}-${currentFile.size}`}
                          className="text-xs font-mono px-2 py-1 border border-border bg-surface rounded"
                        >
                          {currentFile.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {hasInput && (
                <div className="animate-fade-up space-y-6">
                  <ToneSelector selected={tone} onChange={setTone} />

                  <div className="space-y-3">
                    <label className="block text-sm font-body text-muted">Platform preset</label>
                    <div className="flex flex-wrap gap-2">
                      {PLATFORM_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setPlatform(option.value)}
                          className={`px-3.5 py-2 rounded-xl text-sm border transition-all font-body capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 ${platform === option.value ? 'bg-accent/15 border-accent/50 text-accent-light' : 'bg-panel border-border text-muted hover:border-accent/30 hover:text-white'}`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="brand-voice" className="block text-sm font-body text-muted mb-2">
                        Brand voice profile
                      </label>
                      <select
                        id="brand-voice"
                        value={brandVoice}
                        onChange={(event) => setBrandVoice(event.target.value)}
                        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-white font-body text-sm focus:outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/70"
                      >
                        {BRAND_VOICE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="variants-count" className="block text-sm font-body text-muted mb-2">
                        Captions to generate
                      </label>
                      <select
                        id="variants-count"
                        value={variantsCount}
                        onChange={(event) => setVariantsCount(Number(event.target.value))}
                        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-white font-body text-sm focus:outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/70"
                      >
                        {[2, 3].map((count) => (
                          <option key={count} value={count}>{count}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={loading}
                    aria-disabled={loading}
                    className={`
                      w-full py-3.5 sm:py-4 rounded-2xl font-display font-600 text-base transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70
                      ${loading
                        ? 'bg-accent/50 cursor-not-allowed text-white/70'
                        : 'bg-accent hover:bg-accent/90 text-white glow cursor-pointer'
                      }
                    `}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-3">
                        <svg className="animate-spin-slow w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
                        </svg>
                        {batchMode ? 'Generating batch captions...' : 'Analyzing image...'}
                      </span>
                    ) : (
                      batchMode ? 'Generate batch captions' : 'Generate caption'
                    )}
                  </button>

                  {inlineError && !loading && (
                    <p
                      role="alert"
                      aria-live="assertive"
                      className="text-sm text-red-200 border border-red-400/30 bg-red-400/10 rounded-xl px-3 py-2 text-center font-body"
                    >
                      {inlineError}
                    </p>
                  )}

                  {loading && (
                    <p role="status" aria-live="polite" className="text-center text-xs sm:text-sm text-muted font-body animate-pulse-slow">
                      {loadingStage || 'AI model is processing - this takes 5 to 20 seconds'}
                    </p>
                  )}
                </div>
              )}

              {!hasInput && (
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 pt-1">
                  {['Scenic landscapes', 'Food & recipes', 'Travel photos', 'Portraits'].map((example) => (
                    <span key={example} className="text-[11px] sm:text-xs text-muted font-body px-2 py-1 border border-border rounded-lg bg-panel/60">
                      {example}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 sm:mt-8">
          {[
            { icon: '⚡', title: 'Fast', desc: 'Results in seconds' },
            { icon: '🧠', title: 'Variants', desc: '2 to 3 options per image' },
            { icon: '🎯', title: 'Platform-ready', desc: 'Preset formatting' },
            { icon: '🗂️', title: 'Batch mode', desc: 'Generate up to 3 at once' },
          ].map((feature) => (
            <div key={feature.title} className="bg-surface border border-border rounded-2xl p-4 text-center">
              <div className="text-2xl mb-2">{feature.icon}</div>
              <div className="font-display font-600 text-sm text-white mb-1">{feature.title}</div>
              <div className="text-xs text-muted font-body">{feature.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
