import { useEffect, useRef, useState } from 'react';

export function useDataListScrollY(deps: unknown[]) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(520);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let frameId = 0;
    const measure = () => {
      const tableHost = container.querySelector('.admin-data-list-page__table-body') as HTMLElement | null;
      const tableHeader = container.querySelector('.ant-table-header') as HTMLElement | null;
      const hostHeight = tableHost?.clientHeight ?? container.clientHeight;
      const headerHeight = tableHeader?.getBoundingClientRect().height ?? 40;
      const nextScrollY = Math.max(160, Math.floor(hostHeight - headerHeight));

      setScrollY((current) => (current === nextScrollY ? current : nextScrollY));
    };

    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();
    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(container);

    const tableHost = container.querySelector('.admin-data-list-page__table-body');
    if (tableHost) resizeObserver.observe(tableHost);

    window.addEventListener('resize', scheduleMeasure);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { containerRef, scrollY };
}
