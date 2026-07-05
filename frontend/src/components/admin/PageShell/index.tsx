import type { ReactNode } from 'react';
import { Breadcrumb, Spin } from 'antd';
import './index.css';

type PageShellProps = {
  title: string;
  description?: string;
  titleExtra?: ReactNode;
  actions?: ReactNode;
  loading?: boolean;
  compact?: boolean;
  children: ReactNode;
};

export function PageShell({
  title,
  description,
  titleExtra,
  actions,
  loading,
  compact = false,
  children
}: PageShellProps) {
  return (
    <section className={compact ? 'page-shell is-compact' : 'page-shell'}>
      <header className="page-shell__header">
        <div className="page-shell__title-area">
          <Breadcrumb items={[{ title: '首页' }, { title }]} />
          <div className="page-shell__title-row">
            <h1>{title}</h1>
            {titleExtra ? <div className="page-shell__title-extra">{titleExtra}</div> : null}
          </div>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="page-shell__actions">{actions}</div> : null}
      </header>
      <div className="page-shell__body">
        <Spin spinning={Boolean(loading)}>{children}</Spin>
      </div>
    </section>
  );
}
