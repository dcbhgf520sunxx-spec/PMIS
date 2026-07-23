import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import './index.css';

type SplitPaneStyle = CSSProperties & {
  '--admin-split-pane-left-width': string;
};

export type AdminSplitPaneProps = {
  left: ReactNode;
  right: ReactNode;
  className?: string;
  defaultLeftWidth?: number;
  minLeftWidth?: number;
  maxLeftWidth?: number;
  minRightWidth?: number;
  storageKey?: string;
  ariaLabel?: string;
};

const DEFAULT_LEFT_WIDTH = 360;
const DEFAULT_MIN_LEFT_WIDTH = 280;
const DEFAULT_MIN_RIGHT_WIDTH = 420;
const KEYBOARD_STEP = 24;

function readSavedWidth(storageKey: string | undefined, fallback: number) {
  if (!storageKey) return fallback;

  try {
    const saved = Number(window.localStorage.getItem(`admin-split-pane:${storageKey}`));
    return Number.isFinite(saved) && saved > 0 ? saved : fallback;
  } catch {
    return fallback;
  }
}

export function AdminSplitPane({
  left,
  right,
  className,
  defaultLeftWidth = DEFAULT_LEFT_WIDTH,
  minLeftWidth = DEFAULT_MIN_LEFT_WIDTH,
  maxLeftWidth,
  minRightWidth = DEFAULT_MIN_RIGHT_WIDTH,
  storageKey,
  ariaLabel = '调整左右区域宽度'
}: AdminSplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ clientX: number; leftWidth: number }>();
  const [leftWidth, setLeftWidth] = useState(() => readSavedWidth(storageKey, defaultLeftWidth));
  const [isResizing, setIsResizing] = useState(false);

  const resolveMaxWidth = useMemo(() => (containerWidth: number) => Math.max(
    minLeftWidth,
    Math.min(maxLeftWidth ?? Number.POSITIVE_INFINITY, containerWidth - minRightWidth)
  ), [maxLeftWidth, minLeftWidth, minRightWidth]);

  const clampWidth = useMemo(() => (nextWidth: number) => {
    const containerWidth = containerRef.current?.clientWidth ?? 0;
    return Math.min(Math.max(nextWidth, minLeftWidth), resolveMaxWidth(containerWidth));
  }, [minLeftWidth, resolveMaxWidth]);

  useEffect(() => {
    setLeftWidth(clampWidth(readSavedWidth(storageKey, defaultLeftWidth)));
  }, [clampWidth, defaultLeftWidth, storageKey]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(() => setLeftWidth((current) => clampWidth(current)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [clampWidth]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(`admin-split-pane:${storageKey}`, String(leftWidth));
    } catch {
      // 本次会话仍可正常调整，存储不可用时不影响布局。
    }
  }, [leftWidth, storageKey]);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = { clientX: event.clientX, leftWidth };
    setIsResizing(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!isResizing || !dragStartRef.current) return;
    const offset = event.clientX - dragStartRef.current.clientX;
    setLeftWidth(clampWidth(dragStartRef.current.leftWidth + offset));
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStartRef.current = undefined;
    setIsResizing(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const containerWidth = containerRef.current?.clientWidth ?? 0;
    const maximum = resolveMaxWidth(containerWidth);
    const nextWidth = event.key === 'ArrowLeft'
      ? leftWidth - KEYBOARD_STEP
      : event.key === 'ArrowRight'
        ? leftWidth + KEYBOARD_STEP
        : event.key === 'Home'
          ? minLeftWidth
          : maximum;
    setLeftWidth(clampWidth(nextWidth));
  };

  const style = { '--admin-split-pane-left-width': `${leftWidth}px` } as SplitPaneStyle;

  return (
    <div
      ref={containerRef}
      className={['admin-split-pane', className, isResizing ? 'is-resizing' : undefined].filter(Boolean).join(' ')}
      style={style}
    >
      <section className="admin-split-pane__left">{left}</section>
      <button
        aria-label={ariaLabel}
        aria-orientation="vertical"
        aria-valuemax={resolveMaxWidth(containerRef.current?.clientWidth ?? 0)}
        aria-valuemin={minLeftWidth}
        aria-valuenow={leftWidth}
        className="admin-split-pane__divider"
        onKeyDown={handleKeyDown}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        role="separator"
        type="button"
      >
        <span aria-hidden="true" />
      </button>
      <section className="admin-split-pane__right">{right}</section>
    </div>
  );
}
