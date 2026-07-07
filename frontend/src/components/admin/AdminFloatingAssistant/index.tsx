import { useEffect, useRef, useState, type PointerEvent } from 'react';
import './index.css';

type AssistantMood =
  | 'idle'
  | 'run'
  | 'patrol'
  | 'wave'
  | 'sit'
  | 'cheer'
  | 'think'
  | 'look';

type Position = {
  x: number;
  y: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  originX: number;
  originY: number;
  moved: boolean;
};

type RunDirection = 'left' | 'right';

type AdminFloatingAssistantProps = {
  onClick?: () => void;
  storageKey?: string;
};

const DEFAULT_STORAGE_KEY = 'admin_floating_assistant_position';
const ASSISTANT_WIDTH = 78;
const ASSISTANT_HEIGHT = 84;
const DEFAULT_LEFT = 48;
const DEFAULT_BOTTOM = 122;
const EDGE_GAP = 14;
const RUN_DIRECTION_THRESHOLD = 2;
const AMBIENT_MOODS: AssistantMood[] = [
  'idle',
  'wave',
  'sit',
  'cheer',
  'think',
  'look'
];

function clampPosition(position: Position) {
  const maxX = Math.max(EDGE_GAP, window.innerWidth - ASSISTANT_WIDTH - EDGE_GAP);
  const maxY = Math.max(EDGE_GAP, window.innerHeight - ASSISTANT_HEIGHT - EDGE_GAP);
  return {
    x: Math.min(Math.max(position.x, EDGE_GAP), maxX),
    y: Math.min(Math.max(position.y, EDGE_GAP), maxY)
  };
}

function getDefaultPosition(): Position {
  return clampPosition({
    x: DEFAULT_LEFT,
    y: window.innerHeight - ASSISTANT_HEIGHT - DEFAULT_BOTTOM
  });
}

function readSavedPosition(storageKey: string): Position {
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return getDefaultPosition();
    const parsed = JSON.parse(saved) as Partial<Position>;
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return getDefaultPosition();
    return clampPosition({ x: parsed.x, y: parsed.y });
  } catch {
    return getDefaultPosition();
  }
}

export function AdminFloatingAssistant({ onClick, storageKey = DEFAULT_STORAGE_KEY }: AdminFloatingAssistantProps) {
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [ambientMood, setAmbientMood] = useState<AssistantMood>('idle');
  const [isHovering, setIsHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [runDirection, setRunDirection] = useState<RunDirection>('right');

  useEffect(() => {
    setPosition(readSavedPosition(storageKey));
  }, [storageKey]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setAmbientMood((current) => {
        const candidates = AMBIENT_MOODS.filter((item) => item !== current);
        return candidates[Math.floor(Math.random() * candidates.length)] || 'idle';
      });
    }, 4200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setPosition((current) => current ? clampPosition(current) : current);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!position) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(position));
    } catch {
      // Ignore storage failures; dragging still works for the current page view.
    }
  }, [position, storageKey]);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!position) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      originX: position.x,
      originY: position.y,
      moved: false
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      drag.moved = true;
    }
    const movementX = event.clientX - drag.lastX;
    if (Math.abs(movementX) > RUN_DIRECTION_THRESHOLD) {
      setRunDirection(movementX < 0 ? 'left' : 'right');
      drag.lastX = event.clientX;
    }
    setPosition(clampPosition({
      x: drag.originX + deltaX,
      y: drag.originY + deltaY
    }));
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    suppressClickRef.current = drag.moved;
    dragRef.current = null;
    setIsDragging(false);
  };

  const handleClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onClick?.();
  };

  if (!position) return null;

  const mood: AssistantMood = isDragging ? 'run' : isHovering ? 'wave' : ambientMood;

  return (
    <button
      className="admin-floating-assistant"
      data-mood={mood}
      data-run-direction={runDirection}
      type="button"
      aria-label="AI 助手入口"
      style={{ left: position.x, top: position.y }}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerEnter={() => setIsHovering(true)}
      onPointerLeave={() => setIsHovering(false)}
    >
      <span className="admin-floating-assistant__halo" />
      <span className="admin-floating-assistant__sprite" aria-hidden="true" />
    </button>
  );
}
