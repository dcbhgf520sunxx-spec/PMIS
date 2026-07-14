import { useCallback, useEffect, useRef } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';

type Confirm = (onConfirm: () => void, onCancel: () => void) => void;

export const UNSAVED_CHANGES_MESSAGE = '当前修改尚未保存，确认离开吗？';

export function useUnsavedChangesGuard(dirty: boolean, confirm: Confirm) {
  const allowNavigationRef = useRef(false);
  const confirmingRef = useRef(false);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => (
    dirty
    && !allowNavigationRef.current
    && currentLocation.pathname + currentLocation.search !== nextLocation.pathname + nextLocation.search
  ));

  useBeforeUnload(useCallback((event) => {
    if (!dirty || allowNavigationRef.current) return;
    event.preventDefault();
    event.returnValue = '';
  }, [dirty]));

  useEffect(() => {
    if (blocker.state !== 'blocked' || confirmingRef.current) return;
    confirmingRef.current = true;
    confirm(
      () => {
        allowNavigationRef.current = true;
        confirmingRef.current = false;
        blocker.proceed();
      },
      () => {
        confirmingRef.current = false;
        blocker.reset();
      }
    );
  }, [blocker, confirm]);

  const confirmDiscard = useCallback((action: () => void) => {
    if (!dirty || allowNavigationRef.current) {
      action();
      return;
    }
    confirm(() => {
      allowNavigationRef.current = true;
      action();
    }, () => undefined);
  }, [confirm, dirty]);

  return {
    allowNextNavigation: () => { allowNavigationRef.current = true; },
    blockNextNavigation: () => { allowNavigationRef.current = false; },
    confirmDiscard
  };
}
