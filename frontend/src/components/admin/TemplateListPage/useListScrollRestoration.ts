import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

const prefix = 'project-template:list-scroll:';

export function useListScrollRestoration(enabled: boolean) {
  const location = useLocation();
  const key = `${prefix}${location.pathname}${location.search}`;

  useLayoutEffect(() => {
    if (!enabled) return undefined;
    const raw = window.sessionStorage.getItem(key);
    const frame = window.requestAnimationFrame(() => {
      if (!raw) return;
      try {
        const value = JSON.parse(raw) as { top?: number; left?: number };
        window.scrollTo({ top: value.top || 0 });
        const body = document.querySelector<HTMLElement>('.page-shell__body .admin-data-list-page .ant-table-body');
        if (body) body.scrollLeft = value.left || 0;
      } catch {
        window.sessionStorage.removeItem(key);
      }
    });
    return () => {
      window.cancelAnimationFrame(frame);
      const body = document.querySelector<HTMLElement>('.page-shell__body .admin-data-list-page .ant-table-body');
      window.sessionStorage.setItem(key, JSON.stringify({ top: window.scrollY, left: body?.scrollLeft || 0 }));
    };
  }, [enabled, key]);
}
