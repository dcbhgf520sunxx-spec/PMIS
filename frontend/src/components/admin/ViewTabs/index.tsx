import './index.css';

export type ViewTabItem<T extends string = string> = {
  label: React.ReactNode;
  value: T;
  count?: number;
};

type ViewTabsProps<T extends string = string> = {
  items: ViewTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function ViewTabs<T extends string = string>({ items, value, onChange }: ViewTabsProps<T>) {
  return (
    <div className="admin-view-tabs" role="tablist">
      {items.map((item) => (
        <button
          className={item.value === value ? 'admin-view-tabs__item is-active' : 'admin-view-tabs__item'}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          key={item.value}
          onClick={() => onChange(item.value)}
        >
          <span>{item.label}</span>
          {typeof item.count === 'number' ? <span className="admin-view-tabs__count">{item.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
