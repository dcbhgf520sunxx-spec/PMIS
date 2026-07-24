import { Children, Fragment, isValidElement, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { ActionBar } from '../ActionBar';
import { AdminEmptyState } from '../AdminEmptyState';
import { AdminButton } from '../AdminPrimitives';
import { AdminSelect } from '../AdminSelect';
import type { DetailMetaItem } from '../DetailMetaList';
import { DetailMetaList } from '../DetailMetaList';
import { HistoryTimeline, type HistoryTimelineItem } from '../HistoryTimeline';
import { ExpandToggleButton } from '../ExpandToggleButton';
import { PageShell } from '../PageShell';
import { SectionTitle } from '../SectionTitle';
import { visibleStatusTitleItems } from './statusTitleItems';
import './index.css';

type TemplateDetailSideSection = {
  title?: string;
  items?: DetailMetaItem[];
  columns?: 2 | 3 | 4;
  children?: ReactNode;
};

type TemplateDetailStatusSection = {
  title?: string;
  items: DetailMetaItem[];
};

type TemplateDetailNavigationConfig = {
  items: DetailSectionNavigationItem[];
  activeKey: string;
  onChange: (key: string) => void;
};

type TemplateDetailPageProps = {
  title: string;
  loading?: boolean;
  error?: ReactNode;
  notFound?: boolean;
  onRetry?: () => void;
  onBack?: () => void;
  backText?: string;
  titleCode?: ReactNode;
  titleCenter?: ReactNode;
  actions?: ReactNode;
  statusSection?: TemplateDetailStatusSection | null;
  statusAction?: ReactNode;
  documentSection?: TemplateDetailSideSection | null;
  aside?: ReactNode;
  sectionNavigation?: boolean | TemplateDetailNavigationConfig;
  children: ReactNode;
};

type TemplateDetailSectionProps = {
  title: string;
  sectionKey?: string;
  inlineExtra?: ReactNode;
  inlineExtraPlacement?: 'after-title';
  extra?: ReactNode;
  children: ReactNode;
};

export const templateDetailSectionMarker = Symbol('template-detail-section');

export type DetailSectionNavigationItem<T extends string = string> = {
  key: T;
  title: string;
};

type DetailSectionNavigationProps<T extends string = string> = {
  items: DetailSectionNavigationItem<T>[];
  activeKey: T;
  onChange: (key: T) => void;
  ariaLabel?: string;
  sticky?: boolean;
};

export function DetailSectionNavigation<T extends string = string>({
  items,
  activeKey,
  onChange,
  ariaLabel = '分类导航',
  sticky = true
}: DetailSectionNavigationProps<T>) {
  return (
    <div className={sticky ? 'admin-template-detail-page__section-navigation' : 'admin-template-detail-page__section-navigation is-static'}>
      <nav className="admin-template-detail-page__section-tabs" aria-label={ariaLabel}>
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={item.key === activeKey ? 'is-active' : ''}
            onClick={() => onChange(item.key)}
          >
            {item.title}
          </button>
        ))}
      </nav>
      <div className="admin-template-detail-page__section-select">
        <AdminSelect
          aria-label={ariaLabel}
          value={activeKey || undefined}
          options={items.map((item) => ({ label: item.title, value: item.key }))}
          onChange={(value) => onChange(String(value) as T)}
        />
      </div>
    </div>
  );
}

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
    const componentType = child.type as { [templateDetailSectionMarker]?: boolean };
    if (child.type !== TemplateDetailSection && !componentType[templateDetailSectionMarker]) return [];
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
  titleCode,
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
  const controlledNavigation = typeof sectionNavigation === 'object' ? sectionNavigation : null;
  const navigationItems = useMemo(
    () => controlledNavigation?.items || (sectionNavigation ? collectSectionNavigationItems(children) : []),
    [children, controlledNavigation, sectionNavigation]
  );
  const [activeSectionKey, setActiveSectionKey] = useState('');
  const resolvedActiveSectionKey = controlledNavigation?.activeKey || activeSectionKey;
  const isUnavailable = Boolean(error) || Boolean(notFound);
  const standardAside = statusSection || documentSection ? (
    <>
      {statusSection ? <TemplateDetailStatusSection section={statusSection} action={statusAction} /> : null}
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
  const visibleTitleStatusItems = visibleStatusTitleItems(statusSection?.items || []);
  const resolvedTitleTags = titleCode || visibleTitleStatusItems.length ? (
    <div className="admin-template-detail-page__title-extra">
      {titleCode ? <span className="admin-template-detail-page__code">{titleCode}</span> : null}
      {visibleTitleStatusItems.map((item) => <Fragment key={item.label}>{item.value}</Fragment>)}
    </div>
  ) : null;

  useEffect(() => {
    if (controlledNavigation) return;
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
  }, [controlledNavigation, navigationItems]);

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

  const handleNavigationChange = (sectionKey: string) => {
    if (controlledNavigation) {
      controlledNavigation.onChange(sectionKey);
      return;
    }
    navigateToSection(sectionKey);
  };

  return (
    <PageShell title={title} compact titleExtra={resolvedTitleTags} titleCenter={titleCenter} actions={headerActions} loading={loading}>
      {isUnavailable ? (
        <div className="admin-template-detail-page__state">
          <AdminEmptyState description={notFound ? '记录不存在或已被删除' : error}>
            {onRetry ? <AdminButton type="primary" onClick={onRetry}>重新加载</AdminButton> : null}
          </AdminEmptyState>
        </div>
      ) : (
        <div ref={scrollContainerRef} className={standardAside ? 'admin-template-detail-page' : 'admin-template-detail-page is-single'}>
          {navigationItems.length ? (
            <DetailSectionNavigation
              items={navigationItems}
              activeKey={resolvedActiveSectionKey}
              onChange={handleNavigationChange}
              ariaLabel="详情分类导航"
            />
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

export function TemplateDetailSection({
  title,
  sectionKey,
  inlineExtra,
  inlineExtraPlacement,
  extra,
  children
}: TemplateDetailSectionProps) {
  return (
    <section
      id={sectionKey ? `detail-section-${sectionKey}` : undefined}
      data-detail-section-key={sectionKey}
      className="admin-template-detail-page__panel"
    >
      <SectionTitle
        title={title}
        inlineExtra={inlineExtra}
        inlineExtraPlacement={inlineExtraPlacement}
        extra={extra}
      />
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
      inlineExtraPlacement="after-title"
      inlineExtra={(
        <ExpandToggleButton
          collapseLabel="全部收起"
          disabled={expandableKeys.length === 0}
          expandLabel="全部展开"
          expanded={isAllExpanded}
          variant="square"
          onClick={() => setExpandedKeys(isAllExpanded ? [] : expandableKeys)}
        />
      )}
    >
      <HistoryTimeline items={items} expandedKeys={expandedKeys} onExpandedKeysChange={setExpandedKeys} showBulkToggle={false} />
    </TemplateDetailSection>
  );
}

function TemplateDetailStatusSection({
  section,
  action
}: {
  section: TemplateDetailStatusSection;
  action?: ReactNode;
}) {
  return (
    <TemplateDetailSection title={section.title || '当前状态'}>
      <div className="admin-template-detail-page__status-list">
        {section.items.map((item) => (
          <div className="admin-template-detail-page__status-item" key={item.label}>
            <span>{item.label}</span>
            <div>{item.value}</div>
          </div>
        ))}
      </div>
      {action ? <div className="admin-template-detail-page__status-action">{action}</div> : null}
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
