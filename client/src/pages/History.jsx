import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';

const TONE_FILTERS = [
  { value: 'all', label: 'All tones' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'poetic', label: 'Poetic' },
  { value: 'funny', label: 'Funny' },
  { value: 'professional', label: 'Professional' },
  { value: 'instagram', label: 'Instagram' },
];

const PLATFORM_FILTERS = [
  { value: 'all', label: 'All platforms' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'x', label: 'X' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'general', label: 'General' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'favorites', label: 'Favorites first' },
];

function SkeletonCard() {
  return (
    <div className="bg-panel border border-border rounded-2xl overflow-hidden">
      <div className="shimmer h-40 w-full" />
      <div className="p-4 space-y-3">
        <div className="shimmer h-4 rounded w-3/4" />
        <div className="shimmer h-4 rounded w-1/2" />
        <div className="flex gap-2 mt-2">
          <div className="shimmer h-6 rounded-full w-16" />
          <div className="shimmer h-6 rounded-full w-16" />
          <div className="shimmer h-6 rounded-full w-16" />
        </div>
      </div>
    </div>
  );
}

export default function History() {
  const { user, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const [queryInput, setQueryInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [toneFilter, setToneFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [cursorByPage, setCursorByPage] = useState({ 1: '' });
  const [nextCursor, setNextCursor] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [knownTotal, setKnownTotal] = useState(null);

  const [screenReaderMessage, setScreenReaderMessage] = useState('');
  const announceTimerRef = useRef(null);

  const announce = useCallback((message) => {
    if (announceTimerRef.current) {
      clearTimeout(announceTimerRef.current);
    }

    setScreenReaderMessage('');
    announceTimerRef.current = setTimeout(() => {
      setScreenReaderMessage(message);
    }, 40);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(queryInput.trim());
    }, 280);

    return () => clearTimeout(timer);
  }, [queryInput]);

  useEffect(() => {
    setPage(1);
    setCursorByPage({ 1: '' });
    setNextCursor('');
    setHasMore(false);
  }, [searchQuery, toneFilter, platformFilter, sortBy, favoriteOnly, fromDate, toDate, limit]);

  useEffect(() => {
    return () => {
      if (announceTimerRef.current) {
        clearTimeout(announceTimerRef.current);
      }
    };
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const params = {
        pagination: 'cursor',
        limit,
        sort: sortBy,
      };

      const currentCursor = cursorByPage[page] || '';
      if (currentCursor) {
        params.cursor = currentCursor;
      }

      if (searchQuery) {
        params.q = searchQuery;
      }
      if (toneFilter !== 'all') {
        params.tone = toneFilter;
      }
      if (platformFilter !== 'all') {
        params.platform = platformFilter;
      }
      if (favoriteOnly) {
        params.favorite = true;
      }
      if (fromDate) {
        params.from = fromDate;
      }
      if (toDate) {
        params.to = toDate;
      }

      const res = await api.get('/caption/history', { params });
      const items = Array.isArray(res.data) ? res.data : [];

      const parsedTotalCount = Number.parseInt(res.headers['x-total-count'], 10);
      const safeTotalCount = Number.isNaN(parsedTotalCount) ? null : parsedTotalCount;

      setHistory(items);
      setKnownTotal(safeTotalCount);
      setHasMore(String(res.headers['x-has-more'] || '').toLowerCase() === 'true');
      setNextCursor(res.headers['x-next-cursor'] || '');
      announce(`Loaded ${items.length} captions on page ${page}.`);
    } catch (err) {
      const status = err.response?.status;

      if (status === 401) {
        logout();
        toast.error('Session expired. Please log in again.', { id: 'history-auth-error' });
        announce('Session expired. Please log in again.');
        navigate('/login');
        return;
      }

      toast.error(err.response?.data?.error || 'Failed to load history', {
        id: 'history-load-error',
      });
      setKnownTotal(null);
      setHasMore(false);
      setNextCursor('');
      announce('Failed to load caption history.');
    } finally {
      setLoading(false);
    }
  }, [
    announce,
    cursorByPage,
    favoriteOnly,
    fromDate,
    limit,
    logout,
    navigate,
    page,
    platformFilter,
    sortBy,
    searchQuery,
    toDate,
    toneFilter,
  ]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setLoading(false);
      navigate('/login');
      return;
    }

    setLoading(true);
    fetchHistory();
  }, [authLoading, user, navigate, fetchHistory]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/caption/${id}`);
      toast.success('Deleted');
      announce('Caption deleted.');

      if (history.length === 1 && page > 1) {
        setPage((currentPage) => Math.max(1, currentPage - 1));
      } else {
        fetchHistory();
      }
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
        toast.error('Session expired. Please log in again.', { id: 'history-auth-error' });
        announce('Session expired. Please log in again.');
        navigate('/login');
        return;
      }

      toast.error(err.response?.data?.error || 'Delete failed', {
        id: 'history-delete-error',
      });
      announce('Delete failed.');
    }
  };

  const copyCaption = (caption, hashtags) => {
    const safeHashtags = Array.isArray(hashtags) ? hashtags : [];
    navigator.clipboard.writeText(`${caption}\n\n${safeHashtags.join(' ')}`);
    toast.success('Copied!');
    announce('Caption copied to clipboard.');
  };

  const handleToggleFavorite = async (item) => {
    try {
      const res = await api.patch(`/caption/${item._id}/favorite`, {
        favorite: !item.favorite,
      });

      const nextFavorite = Boolean(res.data?.favorite);

      if (favoriteOnly && !nextFavorite) {
        setHistory((previous) => previous.filter((entry) => entry._id !== item._id));
      } else {
        setHistory((previous) => previous.map((entry) => {
          if (entry._id !== item._id) {
            return entry;
          }

          return { ...entry, favorite: nextFavorite };
        }));
      }

      toast.success(nextFavorite ? 'Added to favorites' : 'Removed from favorites');
      announce(nextFavorite ? 'Added to favorites.' : 'Removed from favorites.');
    } catch (err) {
      const message = err.response?.data?.error || 'Could not update favorite';
      toast.error(message);
      announce('Could not update favorite status.');
    }
  };

  const clearFilters = () => {
    setQueryInput('');
    setSearchQuery('');
    setToneFilter('all');
    setPlatformFilter('all');
    setSortBy('newest');
    setFavoriteOnly(false);
    setFromDate('');
    setToDate('');
    setPage(1);
    setCursorByPage({ 1: '' });
    setNextCursor('');
    setHasMore(false);
  };

  const goToPreviousPage = () => {
    setPage((currentPage) => Math.max(1, currentPage - 1));
  };

  const goToNextPage = () => {
    if (!hasMore || !nextCursor) {
      return;
    }

    const nextPage = page + 1;
    setCursorByPage((previous) => ({ ...previous, [nextPage]: nextCursor }));
    setPage(nextPage);
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-6" aria-busy={loading}>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {screenReaderMessage}
      </div>

      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap animate-fade-up">
          <div>
            <h1 className="font-display font-700 text-3xl text-white mb-1">
              Caption history
            </h1>
            <p className="text-muted font-body text-sm">
              {knownTotal !== null
                ? `${knownTotal} caption${knownTotal !== 1 ? 's' : ''} found`
                : `${history.length} caption${history.length !== 1 ? 's' : ''} on this page`}
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl font-body text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
          >
            + New caption
          </button>
        </div>

        <div className="bg-panel/70 border border-border rounded-2xl p-4 sm:p-5 animate-fade-up space-y-4">
          <div className="grid lg:grid-cols-7 gap-3">
            <input
              type="text"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Search caption, hashtag, or alt text"
              className="lg:col-span-2 bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/70"
            />

            <select
              value={toneFilter}
              onChange={(event) => setToneFilter(event.target.value)}
              className="bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/70"
            >
              {TONE_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <select
              value={platformFilter}
              onChange={(event) => setPlatformFilter(event.target.value)}
              className="bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/70"
            >
              {PLATFORM_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/70"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/70"
              aria-label="Filter from date"
            />

            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/70"
              aria-label="Filter to date"
            />
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <label className="inline-flex items-center gap-2 text-sm text-muted font-body">
              <input
                type="checkbox"
                checked={favoriteOnly}
                onChange={(event) => setFavoriteOnly(event.target.checked)}
                className="rounded border-border bg-surface text-accent focus:ring-accent"
              />
              Favorites only
            </label>

            <div className="flex items-center gap-2 flex-wrap">
              <label htmlFor="history-page-size" className="text-xs text-muted font-body">
                Per page
              </label>
              <select
                id="history-page-size"
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
                className="bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/70"
              >
                {[6, 12, 24].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={clearFilters}
                className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted hover:text-white hover:border-accent/30 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
              >
                Clear filters
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, index) => <SkeletonCard key={index} />)}
          </div>
        ) : history.length === 0 ? (
          <div className="glass rounded-3xl p-16 text-center animate-fade-up">
            <div className="text-5xl mb-4">📷</div>
            <h2 className="font-display font-600 text-xl text-white mb-2">No captions found</h2>
            <p className="text-muted font-body mb-6">
              Try changing your filters or generate a new caption.
            </p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-accent hover:bg-accent/90 text-white rounded-xl font-body text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
            >
              Generate caption
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-fade-up">
            {history.map((item) => (
              <div
                key={item._id}
                className="bg-panel border border-border rounded-2xl overflow-hidden hover:border-accent/30 transition-colors group"
              >
                <div className="relative">
                  <img
                    src={item.imageUrl}
                    alt="Caption"
                    className="w-full h-44 object-cover"
                  />

                  <button
                    type="button"
                    onClick={() => handleToggleFavorite(item)}
                    aria-label={item.favorite ? 'Remove from favorites' : 'Add to favorites'}
                    className={`absolute top-3 left-3 p-2 rounded-lg border backdrop-blur-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 ${item.favorite ? 'bg-yellow-400/20 border-yellow-300/60 text-yellow-200' : 'bg-ink/70 border-border text-white hover:text-yellow-200'}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={item.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </button>

                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex gap-2">
                    <button
                      type="button"
                      onClick={() => copyCaption(item.caption, item.hashtags)}
                      aria-label="Copy saved caption"
                      className="p-2 bg-ink/80 backdrop-blur-sm rounded-lg border border-border text-white hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                      title="Copy caption"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item._id)}
                      aria-label="Delete saved caption"
                      className="p-2 bg-ink/80 backdrop-blur-sm rounded-lg border border-border text-white hover:text-red-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                      title="Delete caption"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" strokeLinecap="round" />
                        <path d="M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M10 11v6M14 11v6" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <p className="text-white font-body text-sm leading-relaxed line-clamp-2">
                    {item.caption}
                  </p>

                  {item.altText && (
                    <p className="text-xs text-muted font-body line-clamp-2">
                      Alt text: {item.altText}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {(item.hashtags || []).slice(0, 4).map((tag) => (
                      <span key={tag} className="hashtag-chip text-xs">{tag}</span>
                    ))}
                    {(item.hashtags || []).length > 4 && (
                      <span className="text-xs text-muted font-mono self-center">
                        +{(item.hashtags || []).length - 4}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 text-[11px] text-muted font-mono">
                    <span className="px-2 py-1 rounded bg-surface border border-border capitalize">
                      {item.tone || 'neutral'}
                    </span>
                    <span className="px-2 py-1 rounded bg-surface border border-border capitalize">
                      {item.platform || 'general'}
                    </span>
                    <span className="px-2 py-1 rounded bg-surface border border-border capitalize">
                      {item.brandVoice || 'default'}
                    </span>
                  </div>

                  <p className="text-xs text-muted font-mono pt-1">
                    {new Date(item.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && history.length > 0 && (
          <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
            <p className="text-xs text-muted font-mono">
              Page {page}{hasMore ? ' · more results available' : ' · end of results'}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goToPreviousPage}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-border text-sm text-muted hover:text-white hover:border-accent/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
              >
                Previous
              </button>

              <button
                type="button"
                onClick={goToNextPage}
                disabled={!hasMore || !nextCursor}
                className="px-3 py-1.5 rounded-lg border border-border text-sm text-muted hover:text-white hover:border-accent/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
