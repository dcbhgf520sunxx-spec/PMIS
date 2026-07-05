type ComponentEntryProps = {
  name: string;
  label?: string;
};

export function ComponentEntry({ name, label = '组件入口' }: ComponentEntryProps) {
  return (
    <div className="design-system-page__component-entry">
      <span>{label}</span>
      <code>{name}</code>
    </div>
  );
}
