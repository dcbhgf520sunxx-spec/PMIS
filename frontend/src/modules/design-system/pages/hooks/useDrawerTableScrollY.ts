import { useEffect, useRef, useState } from 'react';

export function useDrawerTableScrollY(deps: unknown[]) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(520);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let frameId = 0;

    const measure = () => {
      const tableHost = container.querySelector('.design-system-page__drawer-table-body');
      const tableHeader = container.querySelector('.ant-table-header');
      const hostHeight = tableHost?.getBoundingClientRect().height ?? container.getBoundingClientRect().height;
      const headerHeight = tableHeader?.getBoundingClientRect().height ?? 40;
      const nextScrollY = Math.max(180, Math.floor(hostHeight - headerHeight));

      setScrollY((current) => (current === nextScrollY ? current : nextScrollY));
    };

    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();

    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(container);

    const tableHost = container.querySelector('.design-system-page__drawer-table-body');
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
