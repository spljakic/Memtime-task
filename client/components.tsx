import { useEffect, useState } from 'react';
import { ApiError } from './api';
export function ErrorNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const retryAfter = error instanceof ApiError ? error.details.retryAfter : undefined;
  const [remaining, setRemaining] = useState(retryAfter ?? 0);
  useEffect(() => {
    setRemaining(retryAfter ?? 0);
    if (!retryAfter) return;
    const timer = setInterval(() => setRemaining((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(timer);
  }, [error, retryAfter]);
  return (
    <div className="error" role="alert">
      <span>{error instanceof Error ? error.message : 'Something went wrong.'}</span>
      {remaining > 0 && <span> Retry in {remaining}s.</span>}
      {error instanceof ApiError && error.details.fields && (
        <ul>
          {Object.entries(error.details.fields).map(([field, message]) => (
            <li key={field}>
              {field}: {message}
            </li>
          ))}
        </ul>
      )}
      {onRetry && (
        <button disabled={remaining > 0} onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
export function Pagination({
  page,
  count,
  busy,
  hasMore,
  onChange,
}: {
  page: number;
  count: number;
  busy: boolean;
  hasMore: boolean;
  onChange: (page: number) => void;
}) {
  return (
    <nav aria-label="Time entry pages" className="pagination">
      <span>
        Page {page + 1} · {count} entries
      </span>
      <div>
        <button disabled={busy || page === 0} onClick={() => onChange(page - 1)}>
          ← Previous
        </button>
        <button disabled={busy || !hasMore} onClick={() => onChange(page + 1)}>
          Next →
        </button>
      </div>
    </nav>
  );
}
