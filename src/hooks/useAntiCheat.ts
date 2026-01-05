import { useEffect } from 'react';

export function useAntiCheat() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Ctrl+F / Cmd+F
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        return false;
      }
      // Block Ctrl+G / Cmd+G (find next)
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        return false;
      }
      // Block F3 (find in some browsers)
      if (e.key === 'F3') {
        e.preventDefault();
        return false;
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);
}
