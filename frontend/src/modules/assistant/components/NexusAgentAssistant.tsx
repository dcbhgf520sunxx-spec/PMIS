import {
  CloseOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined
} from '@ant-design/icons';
import { Alert, Spin } from 'antd';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent
} from 'react';
import { getNexusSsoTicket } from '../../../api/authApi';
import { AdminButton, AdminFloatingAssistant, AdminIconAction } from '../../../components/admin';
import { getNexusChatUrl } from '../nexusAgentConfig';
import './NexusAgentAssistant.css';

type PanelStyle = CSSProperties & {
  '--nexus-agent-assistant-width': string;
};

const DEFAULT_WIDTH = 560;
const MIN_WIDTH = 420;
const MAX_WIDTH = 960;
const MIN_PAGE_WIDTH = 320;
const KEYBOARD_STEP = 24;

function maxPanelWidth() {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, window.innerWidth - MIN_PAGE_WIDTH));
}

function clampPanelWidth(value: number) {
  return Math.min(Math.max(value, MIN_WIDTH), maxPanelWidth());
}

function readPanelWidth(storageKey: string) {
  try {
    const saved = Number(window.localStorage.getItem(storageKey));
    return clampPanelWidth(Number.isFinite(saved) && saved > 0 ? saved : DEFAULT_WIDTH);
  } catch {
    return clampPanelWidth(DEFAULT_WIDTH);
  }
}

export function NexusAgentAssistant({ storageKey }: { storageKey: string }) {
  const widthStorageKey = `${storageKey}_width`;
  const requestIdRef = useRef(0);
  const dragStartRef = useRef<{ clientX: number; width: number }>();
  const [open, setOpen] = useState(false);
  const [chatUrl, setChatUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [width, setWidth] = useState(() => readPanelWidth(widthStorageKey));
  const [isResizing, setIsResizing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleResize = () => setWidth((current) => clampPanelWidth(current));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(widthStorageKey, String(width));
    } catch {
      // 宽度记忆不可用时不影响当前会话调整。
    }
  }, [width, widthStorageKey]);

  const loadChat = async (force = false) => {
    setOpen(true);
    if (!force && chatUrl && !error) return;

    const requestId = ++requestIdRef.current;
    setChatUrl(null);
    setError('');

    try {
      const { ticket } = await getNexusSsoTicket();
      if (requestId === requestIdRef.current) {
        setChatUrl(getNexusChatUrl(ticket));
      }
    } catch {
      if (requestId === requestIdRef.current) {
        setError('智能体暂时无法连接，请稍后重试。');
      }
    }
  };

  const handleClose = () => {
    requestIdRef.current += 1;
    setOpen(false);
    setIsFullscreen(false);
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = { clientX: event.clientX, width };
    setIsResizing(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!isResizing || !dragStartRef.current) return;
    const offset = dragStartRef.current.clientX - event.clientX;
    setWidth(clampPanelWidth(dragStartRef.current.width + offset));
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
    const nextWidth = event.key === 'ArrowLeft'
      ? width + KEYBOARD_STEP
      : event.key === 'ArrowRight'
        ? width - KEYBOARD_STEP
        : event.key === 'Home'
          ? MIN_WIDTH
          : maxPanelWidth();
    setWidth(clampPanelWidth(nextWidth));
  };

  const panelStyle = {
    '--nexus-agent-assistant-width': `${width}px`
  } as PanelStyle;

  return (
    <>
      {!open ? (
        <AdminFloatingAssistant
          storageKey={storageKey}
          onClick={() => void loadChat()}
        />
      ) : null}
      <aside
        aria-hidden={!open}
        aria-label="AI 智能助手"
        className={[
          'nexus-agent-assistant-panel',
          open ? 'is-open' : undefined,
          isFullscreen ? 'is-fullscreen' : undefined,
          isResizing ? 'is-resizing' : undefined
        ].filter(Boolean).join(' ')}
        style={panelStyle}
      >
        <AdminButton
          aria-label="调整智能助手宽度"
          aria-orientation="vertical"
          aria-valuemax={maxPanelWidth()}
          aria-valuemin={MIN_WIDTH}
          aria-valuenow={width}
          className="nexus-agent-assistant-panel__resize"
          onKeyDown={handleKeyDown}
          onPointerCancel={handlePointerUp}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          role="separator"
          tabIndex={open && !isFullscreen ? 0 : -1}
        >
          <span aria-hidden="true" />
        </AdminButton>
        <header className="nexus-agent-assistant-panel__header">
          <strong>AI 智能助手</strong>
          <div className="nexus-agent-assistant-panel__actions">
            <AdminIconAction
              icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              label={isFullscreen ? '退出全屏' : '全屏'}
              onClick={() => setIsFullscreen((current) => !current)}
              tabIndex={open ? 0 : -1}
            />
            <AdminIconAction
              icon={<CloseOutlined />}
              label="关闭智能助手"
              onClick={handleClose}
              tabIndex={open ? 0 : -1}
            />
          </div>
        </header>
        <div className="nexus-agent-assistant-panel__body">
          {chatUrl ? (
            <iframe
              className="nexus-agent-assistant-panel__frame"
              src={chatUrl}
              tabIndex={open ? 0 : -1}
              title="AI 智能助手对话"
            />
          ) : error ? (
            <div className="nexus-agent-assistant-panel__state">
              <Alert message={error} type="error" showIcon />
              <AdminButton type="primary" onClick={() => void loadChat(true)}>
                重新连接
              </AdminButton>
            </div>
          ) : (
            <div className="nexus-agent-assistant-panel__state">
              <Spin size="large" tip="正在连接智能体">
                <span className="nexus-agent-assistant-panel__loading-content" />
              </Spin>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
