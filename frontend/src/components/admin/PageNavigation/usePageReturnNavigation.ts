import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { appendReturnTo, currentRelativePath, resolveReturnTo } from './pageNavigation';

export function usePageReturnNavigation(fallbackPath: string) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = currentRelativePath(location);
  const returnTarget = resolveReturnTo(location.search, fallbackPath, fallbackPath, ['/digital-twin']);

  const navigateWithReturn = useCallback((target: string) => {
    navigate(appendReturnTo(target, currentPath));
  }, [currentPath, navigate]);

  const returnToSource = useCallback(() => {
    navigate(returnTarget, { replace: true });
  }, [returnTarget, navigate]);

  return {
    currentPath,
    navigateWithReturn,
    returnTarget,
    backText: new URL(returnTarget, 'http://local').pathname === '/digital-twin' ? '返回数字孪生' : '返回列表',
    returnToSource
  };
}
