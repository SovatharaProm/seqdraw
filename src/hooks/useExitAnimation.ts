import { useEffect, useRef, useState } from 'react';

// Keep an element mounted while its exit animation plays (duration matches the CSS)
export function useExitAnimation(ms: number) {
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const leave = (done: () => void) => {
    if (leaving) return;
    setLeaving(true);
    timer.current = setTimeout(() => {
      setLeaving(false);
      done();
    }, ms);
  };
  const cancel = () => {
    clearTimeout(timer.current);
    setLeaving(false);
  };
  return { leaving, leave, cancel };
}
