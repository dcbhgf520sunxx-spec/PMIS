import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AdminDrawer } from '../AdminDrawer';
import { AdminEmptyState } from '../AdminEmptyState';
import { AdminButton, AdminSegmented, AdminTag } from '../AdminPrimitives';
import './index.css';

export type AdminMessageType = 'notification' | 'system';

export type AdminMessageItem = {
  id: string;
  type: AdminMessageType;
  title: string;
  description: string;
  time: string;
  unread?: boolean;
  href?: string;
};

type MessageTab = 'all' | AdminMessageType;

type AdminMessageCenterProps = {
  messages: AdminMessageItem[];
  loading?: boolean;
  onNavigate?: (href: string) => void;
  onMarkRead?: (id: string, item: AdminMessageItem) => void | Promise<void>;
  onMarkAllRead?: () => void | Promise<void>;
};

const tabOptions: Array<{ label: ReactNode; value: MessageTab }> = [
  { label: '全部', value: 'all' },
  { label: '通知', value: 'notification' },
  { label: '系统', value: 'system' }
];

const messageTypeMeta: Record<AdminMessageType, { label: string; className: string }> = {
  notification: { label: '通知', className: 'is-notification' },
  system: { label: '系统', className: 'is-system' }
};

function MessageBellIcon() {
  return (
    <svg
      aria-hidden="true"
      className="admin-message-center__trigger-icon"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M18.2 16.4H5.8c1.25-1.05 1.7-2.35 1.7-4.7 0-3.4 1.82-5.7 4.5-5.7s4.5 2.3 4.5 5.7c0 2.35.45 3.65 1.7 4.7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9.7 18.4c.42 1.05 1.2 1.6 2.3 1.6s1.88-.55 2.3-1.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 4.8V3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function AdminMessageCenter({
  messages,
  loading,
  onNavigate,
  onMarkRead,
  onMarkAllRead
}: AdminMessageCenterProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<MessageTab>('all');

  const unreadCount = messages.filter((item) => item.unread).length;
  const visibleItems = useMemo(
    () => messages.filter((item) => activeTab === 'all' || item.type === activeTab).slice(0, 50),
    [activeTab, messages]
  );

  const handleMessageClick = (item: AdminMessageItem) => {
    if (item.unread) {
      void onMarkRead?.(item.id, item);
    }

    if (item.href) {
      onNavigate?.(item.href);
      setOpen(false);
    }
  };

  return (
    <>
      <AdminButton
        aria-label="消息"
        className="admin-message-center__trigger"
        icon={<MessageBellIcon />}
        type="text"
        onClick={() => setOpen(true)}
      >
        {unreadCount > 0 ? <span className="admin-message-center__trigger-dot" /> : null}
      </AdminButton>

      <AdminDrawer
        className="admin-message-center-drawer"
        destroyOnHidden
        open={open}
        placement="right"
        title="消息"
        width={420}
        extra={
          <div className="admin-message-center__drawer-extra">
            <span>
              {unreadCount > 0 ? (
                <>
                  <em>{unreadCount}</em>
                  {' 条未读'}
                </>
              ) : '暂无未读'}
            </span>
            <AdminButton
              adminVariant="subtle"
              disabled={unreadCount === 0}
              size="small"
              onClick={() => { void onMarkAllRead?.(); }}
            >
              全部已读
            </AdminButton>
          </div>
        }
        onClose={() => setOpen(false)}
      >
        <div className="admin-message-center">
          <AdminSegmented<MessageTab>
            adminVariant="filter"
            block
            className="admin-message-center__tabs"
            options={tabOptions}
            size="small"
            value={activeTab}
            onChange={setActiveTab}
          />

          <div className="admin-message-center__list">
            {loading ? (
              <AdminEmptyState className="admin-message-center__empty" description="消息加载中..." />
            ) : visibleItems.length > 0 ? visibleItems.map((item) => {
              const meta = messageTypeMeta[item.type];

              return (
                <button
                  className={['admin-message-center__item', item.unread ? 'is-unread' : ''].filter(Boolean).join(' ')}
                  key={item.id}
                  type="button"
                  onClick={() => handleMessageClick(item)}
                >
                  <span className="admin-message-center__item-main">
                    <span className="admin-message-center__item-title">
                      {item.unread ? <i aria-hidden="true" /> : null}
                      <strong>{item.title}</strong>
                      <AdminTag className={['admin-message-center__type', meta.className].join(' ')}>
                        {meta.label}
                      </AdminTag>
                    </span>
                    <span className="admin-message-center__item-desc">{item.description}</span>
                  </span>
                  <span className="admin-message-center__item-time">{item.time}</span>
                </button>
              );
            }) : (
              <AdminEmptyState className="admin-message-center__empty" description="暂无新消息" />
            )}
          </div>

        </div>
      </AdminDrawer>
    </>
  );
}
