import { useEffect, useState } from 'react';

// Files dropped anywhere on the window; returns whether a drag is over it
export function useFileDrop(onFile: (file: File) => void): boolean {
  const [dropping, setDropping] = useState(false);
  useEffect(() => {
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files');
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDropping(true);
    };
    const leave = (e: DragEvent) => !e.relatedTarget && setDropping(false);
    const drop = (e: DragEvent) => {
      setDropping(false);
      const file = e.dataTransfer?.files[0];
      if (!file) return;
      e.preventDefault();
      onFile(file);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [onFile]);
  return dropping;
}
