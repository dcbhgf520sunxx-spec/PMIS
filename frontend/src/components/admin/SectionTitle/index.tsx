import './index.css';

type SectionTitleProps = {
  title: string;
  description?: string;
  inlineExtra?: React.ReactNode;
  inlineExtraPlacement?: 'after-title';
  extra?: React.ReactNode;
};

export function SectionTitle({ title, description, inlineExtra, inlineExtraPlacement, extra }: SectionTitleProps) {
  return (
    <div className={[
      'admin-section-title',
      inlineExtraPlacement === 'after-title' ? 'is-inline-extra-after-title' : '',
      extra ? 'has-extra' : ''
    ].filter(Boolean).join(' ')}>
      <div className="admin-section-title__content">
        <div className="admin-section-title__text">
          <span>{title}</span>
          {inlineExtra ? <span className="admin-section-title__inline-extra">{inlineExtra}</span> : null}
        </div>
        {description ? <div className="admin-section-title__description">{description}</div> : null}
      </div>
      {extra ? <div className="admin-section-title__extra">{extra}</div> : null}
    </div>
  );
}
