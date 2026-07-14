import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { appendReturnTo, currentRelativePath, resolveReturnTo } from './pageNavigation';

export function usePageReturnNavigation(fallbackPath: string) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = currentRelativePath(location);

  const navigateWithReturn = useCallback((target: string) => {
    navigate(appendReturnTo(target, currentPath));
  }, [currentPath, navigate]);

  const returnToSource = useCallback(() => {
    navigate(resolveReturnTo(location.search, fallbackPath, fallbackPath), { replace: true });
  }, [fallbackPath, location.search, navigate]);

  return {
    currentPath,
    navigateWithReturn,
    returnTarget: resolveReturnTo(location.search, fallbackPath, fallbackPath),
    returnToSource
  };
}
