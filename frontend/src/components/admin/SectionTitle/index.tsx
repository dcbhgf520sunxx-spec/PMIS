import './index.css';

type SectionTitleProps = {
  title: string;
  description?: string;
  inlineExtra?: React.ReactNode;
  extra?: React.ReactNode;
};

export function SectionTitle({ title, description, inlineExtra, extra }: SectionTitleProps) {
  return (
    <div className="admin-section-title">
      <div>
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
