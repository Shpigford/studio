import { useEffect, useRef, type RefObject } from "react";
import p5 from "p5";

interface UseP5Options {
  animated?: boolean;
}

/**
 * Mount a p5.js instance in a container element.
 *
 * - settingsRef is kept in sync with the latest settings every render.
 * - For static sketches (animated=false, the default), calls redraw() on settings change.
 * - sketchFn must be stable — wrap in useCallback or define outside the component.
 */
export function useP5<T>(
  containerRef: RefObject<HTMLDivElement | null>,
  sketchFn: (p: p5, settingsRef: RefObject<T>) => void,
  settings: T,
  options?: UseP5Options,
): RefObject<p5 | null> {
  const instanceRef = useRef<p5 | null>(null);
  const settingsRef = useRef<T>(settings);

  // Keep settingsRef in sync
  settingsRef.current = settings;

  // Mount / unmount p5 instance
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clean up any leftover canvases from previous mounts (StrictMode double-mount)
    container.querySelectorAll("canvas").forEach((c) => c.remove());

    const instance = new p5((p: p5) => {
      sketchFn(p, settingsRef);
    }, container);

    instanceRef.current = instance;

    return () => {
      // p5 v2: async constructor may not have finished setup yet.
      // Set hitCriticalError to prevent deferred canvas creation.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (instance as any).hitCriticalError = true;
      instance.remove();
      // Remove any canvases that were already created
      container.querySelectorAll("canvas").forEach((c) => c.remove());
      instanceRef.current = null;
    };
    // sketchFn must be stable — intentionally not in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

  // Trigger redraw on settings change (static mode only).
  // Throttle to one redraw per animation frame so rapid slider drags
  // don't queue multiple expensive synchronous redraws.
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!options?.animated && instanceRef.current) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        instanceRef.current?.redraw();
      });
    }
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [settings, options?.animated]);

  return instanceRef;
}
