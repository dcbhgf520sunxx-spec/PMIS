import type { ReactNode } from 'react';
import type { DetailMetaItem } from '../DetailMetaList';
import { DetailMetaList } from '../DetailMetaList';
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
  titleExtra?: ReactNode;
  actions?: ReactNode;
  statusSection?: TemplateDetailSideSection | null;
  documentSection?: TemplateDetailSideSection | null;
  aside?: ReactNode;
  children: ReactNode;
};

type TemplateDetailSectionProps = {
  title: string;
  inlineExtra?: ReactNode;
  children: ReactNode;
};

export function TemplateDetailPage({
  title,
  loading,
  titleExtra,
  actions,
  statusSection,
  documentSection,
  aside,
  children
}: TemplateDetailPageProps) {
  const standardAside = statusSection || documentSection ? (
    <>
      {statusSection ? <TemplateDetailSideSection section={statusSection} defaultTitle="当前状态" /> : null}
      {documentSection ? <TemplateDetailSideSection section={documentSection} defaultTitle="单据信息" /> : null}
      {aside}
    </>
  ) : aside;

  return (
    <PageShell title={title} compact titleExtra={titleExtra} actions={actions} loading={loading}>
      <div className={standardAside ? 'admin-template-detail-page' : 'admin-template-detail-page is-single'}>
        <div className="admin-template-detail-page__main">
          {children}
        </div>
        {standardAside ? <aside className="admin-template-detail-page__aside">{standardAside}</aside> : null}
      </div>
    </PageShell>
  );
}

export function TemplateDetailSection({ title, inlineExtra, children }: TemplateDetailSectionProps) {
  return (
    <section className="admin-template-detail-page__panel">
      <SectionTitle title={title} inlineExtra={inlineExtra} />
      {children}
    </section>
  );
}

function TemplateDetailSideSection({
  section,
  defaultTitle
}: {
  section: TemplateDetailSideSection;
  defaultTitle: string;
}) {
  return (
    <TemplateDetailSection title={section.title || defaultTitle}>
      {section.children || (
        <DetailMetaList
          columns={section.columns || 2}
          items={section.items || []}
        />
      )}
    </TemplateDetailSection>
  );
}
