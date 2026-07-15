import type { ReactNode } from 'react';
import type { SearchTableProps } from '../SearchTable';
import { SearchTable } from '../SearchTable';
import { TemplateDetailSection, templateDetailSectionMarker } from '../TemplateDetailPage';
import './index.css';

type DetailTableProps<
  T extends Record<string, unknown>,
  P extends Record<string, unknown> = Record<string, unknown>
> = Omit<
  SearchTableProps<T, P>,
  'cardProps' | 'customizable' | 'options' | 'pagination' | 'search' | 'tableAlertRender' | 'toolBarRender'
>;

export type TemplateDetailTableSectionProps<
  T extends Record<string, unknown>,
  P extends Record<string, unknown> = Record<string, unknown>
> = {
  title: string;
  sectionKey?: string;
  summary?: ReactNode;
  extra?: ReactNode;
  table: DetailTableProps<T, P>;
};

function TemplateDetailTableSectionComponent<
  T extends Record<string, unknown>,
  P extends Record<string, unknown> = Record<string, unknown>
>({ title, sectionKey, summary, extra, table }: TemplateDetailTableSectionProps<T, P>) {
  const { className, ...tableProps } = table;
  const summaryNode = summary === undefined || summary === null ? undefined : (
    <span className="admin-template-detail-table-section__summary">{summary}</span>
  );

  return (
    <TemplateDetailSection
      title={title}
      sectionKey={sectionKey}
      inlineExtra={summaryNode}
      inlineExtraPlacement="after-title"
      extra={extra}
    >
      <SearchTable<T, P>
        {...tableProps}
        className={['admin-template-detail-table-section__table', className].filter(Boolean).join(' ')}
        cardProps={false}
        customizable={false}
        options={false}
        pagination={false}
        search={false}
        tableAlertRender={false}
        toolBarRender={false}
      />
    </TemplateDetailSection>
  );
}

export const TemplateDetailTableSection = Object.assign(TemplateDetailTableSectionComponent, {
  [templateDetailSectionMarker]: true
});
