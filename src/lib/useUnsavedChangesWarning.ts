import { useEffect } from 'react';

/**
 * Warns the user via the browser's native "leave site?" prompt if they try to
 * close the tab or refresh while unsaved edits exist (e.g. a topic rewrite or
 * flashcard edit that hasn't been saved yet). In-app navigation stays an
 * explicit, revertible "Cancel" action rather than being silently blocked.
 */
export function useUnsavedChangesWarning(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);
}
