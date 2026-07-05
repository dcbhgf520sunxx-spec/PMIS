import './index.css';

type MetricTone = 'blue' | 'cyan' | 'green' | 'orange' | 'red' | 'purple' | 'gray';

export type MetricCardItem = {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: MetricTone;
  onClick?: () => void;
};

type MetricCardProps = {
  title: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  overdue?: React.ReactNode;
  items?: MetricCardItem[];
  onClick?: () => void;
};

export function MetricCard({ title, value, unit, overdue, items = [], onClick }: MetricCardProps) {
  const Root = onClick ? 'button' : 'div';

  return (
    <Root className={onClick ? 'admin-metric-card admin-metric-card--button' : 'admin-metric-card'} onClick={onClick}>
      <div className="admin-metric-card__header">
        <span>{title}</span>
        {overdue ? <span className="admin-metric-card__overdue">{overdue}</span> : null}
      </div>
      <div className="admin-metric-card__value">
        <strong>{value}</strong>
        {unit ? <span>{unit}</span> : null}
      </div>
      {items.length > 0 ? (
        <div className="admin-metric-card__items">
          {items.map((item, index) => (
            <button
              className="admin-metric-card__item"
              type="button"
              key={`${String(item.label)}-${index}`}
              onClick={(event) => {
                event.stopPropagation();
                item.onClick?.();
              }}
            >
              <span className={`admin-metric-card__dot admin-metric-card__dot--${item.tone || 'gray'}`} />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </button>
          ))}
        </div>
      ) : null}
    </Root>
  );
}
