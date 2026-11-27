import { useCallback, useEffect, useId, useState } from 'react';
import './recordFocus.css';

type HighlightOptions<T> = {
  rows: T[];
  loading?: boolean;
  error?: string;
  getId?: (row: T) => string;
};

export function useRecordHighlight<T>({ rows, loading, error, getId = row => String((row as { id: string }).id) }: HighlightOptions<T>) {
  const scope = `admin-record-focus-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [pending, setPending] = useState<{ ids: readonly string[]; focusId: string }>();
  const [active, setActive] = useState<{ ids: readonly string[] }>();
  const highlight = useCallback((ids: readonly string[], focusId = ids[0]) => {
    setActive(undefined);
    setPending(focusId ? { ids, focusId } : undefined);
  }, []);
  useEffect(() => {
    if (!pending || loading || error || !rows.some(row => getId(row) === pending.focusId)) return;
    const frame = requestAnimationFrame(() => {
      const row = document.querySelector<HTMLTableRowElement>(`.${scope} tr[data-row-key="${CSS.escape(pending.focusId)}"]`);
      if (!row) return;
      row.scrollIntoView({ block: 'center', inline: 'nearest' });
      setActive({ ids: pending.ids });
      setPending(undefined);
    });
    return () => cancelAnimationFrame(frame);
  }, [pending, rows, loading, error, getId, scope]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setActive(undefined), 5000);
    return () => window.clearTimeout(timer);
  }, [active]);
  return {
    highlight,
    tableProps: {
      className: `admin-record-focus-table ${scope}`,
      rowClassName: (row: T) => active?.ids.includes(getId(row)) ? 'admin-record-row--updated' : ''
    }
  };
}
