import { Children, Fragment, isValidElement, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { ActionBar } from '../ActionBar';
import { AdminEmptyState } from '../AdminEmptyState';
import { AdminButton } from '../AdminPrimitives';
import { AdminSelect } from '../AdminSelect';
import type { DetailMetaItem } from '../DetailMetaList';
import { DetailMetaList } from '../DetailMetaList';
import { HistoryTimeline, type HistoryTimelineItem } from '../HistoryTimeline';
import { AdminTextAction } from '../AdminTextAction';
import { PageShell } from '../PageShell';
import { SectionTitle } from '../SectionTitle';
import './index.css';

type TemplateDetailSideSection = {
  title?: string;
  items?: DetailMetaItem[];
  columns?: 2 | 3 | 4;
  children?: ReactNode;
};

type TemplateDetailPageProps = {
  title: string;
  loading?: boolean;
  error?: ReactNode;
  notFound?: boolean;
  onRetry?: () => void;
  onBack?: () => void;
  backText?: string;
  titleTags?: ReactNode;
  titleCenter?: ReactNode;
  actions?: ReactNode;
  statusSection?: TemplateDetailSideSection | null;
  statusAction?: ReactNode;
  documentSection?: TemplateDetailSideSection | null;
  aside?: ReactNode;
  sectionNavigation?: boolean;
  children: ReactNode;
};

type TemplateDetailSectionProps = {
  title: string;
  sectionKey?: string;
  inlineExtra?: ReactNode;
  children: ReactNode;
};

type DetailSectionNavigationItem = {
  key: string;
  title: string;
};

function collectSectionNavigationItems(children: ReactNode): DetailSectionNavigationItem[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return [];
    if (child.type === Fragment) {
      return collectSectionNavigationItems((child.props as { children?: ReactNode }).children);
    }
    if (child.type === HistoryTimelineSection) {
      const section = child as ReactElement<{ sectionKey?: string }>;
      return section.props.sectionKey ? [{ key: section.props.sectionKey, title: '变更历史' }] : [];
    }
    if (child.type !== TemplateDetailSection) return [];
    const section = child as ReactElement<TemplateDetailSectionProps>;
    return section.props.sectionKey ? [{ key: section.props.sectionKey, title: section.props.title }] : [];
  });
}

export function TemplateDetailPage({
  title,
  loading,
  error,
  notFound,
  onRetry,
  onBack,
  backText = '返回列表',
  titleTags,
  titleCenter,
  actions,
  statusSection,
  statusAction,
  documentSection,
  aside,
  sectionNavigation = false,
  children
}: TemplateDetailPageProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const navigationTargetRef = useRef<string | null>(null);
  const navigationItems = useMemo(
    () => sectionNavigation ? collectSectionNavigationItems(children) : [],
    [children, sectionNavigation]
  );
  const [activeSectionKey, setActiveSectionKey] = useState('');
  const isUnavailable = Boolean(error) || Boolean(notFound);
  const standardAside = statusSection || documentSection ? (
    <>
      {statusSection ? <TemplateDetailSideSection section={statusSection} defaultTitle="当前状态" action={statusAction} /> : null}
      {documentSection ? <TemplateDetailSideSection section={documentSection} defaultTitle="单据信息" /> : null}
      {aside}
    </>
  ) : aside;
  const headerActions = onBack || actions ? (
    <ActionBar>
      {onBack ? <AdminButton onClick={onBack}>{backText}</AdminButton> : null}
      {!isUnavailable ? actions : null}
    </ActionBar>
  ) : null;

  useEffect(() => {
    if (!navigationItems.length) {
      setActiveSectionKey('');
      return;
    }
    setActiveSectionKey(navigationItems[0].key);
    const root = scrollContainerRef.current;
    if (!root) return;
    const syncActiveSection = () => {
      if (navigationTargetRef.current) {
        setActiveSectionKey(navigationTargetRef.current);
        return;
      }
      if (root.scrollHeight - root.scrollTop - root.clientHeight <= 8) {
        setActiveSectionKey(navigationItems[navigationItems.length - 1].key);
        return;
      }
      const navigationHeight = root.querySelector<HTMLElement>('.admin-template-detail-page__section-navigation')?.offsetHeight || 0;
      const activationLine = root.scrollTop + navigationHeight + 12;
      const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-detail-section-key]'));
      let activeSection = sections[0];
      for (const section of sections) {
        if (section.offsetTop > activationLine) break;
        activeSection = section;
      }
      const sectionKey = activeSection?.getAttribute('data-detail-section-key');
      if (sectionKey) setActiveSectionKey(sectionKey);
    };
    syncActiveSection();
    root.addEventListener('scroll', syncActiveSection, { passive: true });
    window.addEventListener('resize', syncActiveSection);
    return () => {
      root.removeEventListener('scroll', syncActiveSection);
      window.removeEventListener('resize', syncActiveSection);
    };
  }, [navigationItems]);

  const navigateToSection = (sectionKey: string) => {
    navigationTargetRef.current = sectionKey;
    setActiveSectionKey(sectionKey);
    const root = scrollContainerRef.current;
    const target = document.getElementById(`detail-section-${sectionKey}`);
    if (!root || !target) return;
    const navigationHeight = root.querySelector<HTMLElement>('.admin-template-detail-page__section-navigation')?.offsetHeight || 0;
    scrollContainerRef.current?.scrollTo({
      top: Math.max(target.offsetTop - navigationHeight - 10, 0),
      behavior: 'auto'
    });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      navigationTargetRef.current = null;
    }));
  };

  return (
    <PageShell title={title} compact titleExtra={titleTags} titleCenter={titleCenter} actions={headerActions} loading={loading}>
      {isUnavailable ? (
        <div className="admin-template-detail-page__state">
          <AdminEmptyState description={notFound ? '记录不存在或已被删除' : error}>
            {onRetry ? <AdminButton type="primary" onClick={onRetry}>重新加载</AdminButton> : null}
          </AdminEmptyState>
        </div>
      ) : (
        <div ref={scrollContainerRef} className={standardAside ? 'admin-template-detail-page' : 'admin-template-detail-page is-single'}>
          {navigationItems.length ? (
            <div className="admin-template-detail-page__section-navigation">
              <nav className="admin-template-detail-page__section-tabs" aria-label="详情分类导航">
                {navigationItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={item.key === activeSectionKey ? 'is-active' : ''}
                    onClick={() => navigateToSection(item.key)}
                  >
                    {item.title}
                  </button>
                ))}
              </nav>
              <div className="admin-template-detail-page__section-select">
                <AdminSelect
                  aria-label="详情分类导航"
                  value={activeSectionKey || undefined}
                  options={navigationItems.map((item) => ({ label: item.title, value: item.key }))}
                  onChange={(value) => navigateToSection(String(value))}
                />
              </div>
            </div>
          ) : null}
          <div className="admin-template-detail-page__main">
            {children}
          </div>
          {standardAside ? <aside className="admin-template-detail-page__aside">{standardAside}</aside> : null}
        </div>
      )}
    </PageShell>
  );
}

export function TemplateDetailSection({ title, sectionKey, inlineExtra, children }: TemplateDetailSectionProps) {
  return (
    <section
      id={sectionKey ? `detail-section-${sectionKey}` : undefined}
      data-detail-section-key={sectionKey}
      className="admin-template-detail-page__panel"
    >
      <SectionTitle title={title} inlineExtra={inlineExtra} />
      {children}
    </section>
  );
}

export function HistoryTimelineSection({ items, sectionKey }: { items: HistoryTimelineItem[]; sectionKey?: string }) {
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const expandableKeys = items.filter((item) => item.changes?.length).map((item) => item.id);
  const isAllExpanded = expandableKeys.length > 0 && expandableKeys.every((key) => expandedKeys.includes(key));
  return (
    <TemplateDetailSection
      title="变更历史"
      sectionKey={sectionKey}
      inlineExtra={expandableKeys.length ? (
        <AdminTextAction onClick={() => setExpandedKeys(isAllExpanded ? [] : expandableKeys)}>
          {isAllExpanded ? '全部收起' : '全部展开'}
        </AdminTextAction>
      ) : null}
    >
      <HistoryTimeline items={items} expandedKeys={expandedKeys} onExpandedKeysChange={setExpandedKeys} showBulkToggle={false} />
    </TemplateDetailSection>
  );
}

function TemplateDetailSideSection({
  section,
  defaultTitle,
  action
}: {
  section: TemplateDetailSideSection;
  defaultTitle: string;
  action?: ReactNode;
}) {
  return (
    <TemplateDetailSection title={section.title || defaultTitle}>
      {section.children || (
        <DetailMetaList
          columns={section.columns || 2}
          items={section.items || []}
        />
      )}
      {action ? <div className="admin-template-detail-page__status-action">{action}</div> : null}
    </TemplateDetailSection>
  );
}
