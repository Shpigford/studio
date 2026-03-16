import { useState, useCallback, useRef, useEffect } from "react";
import { shortcutActions } from "@/lib/shortcut-actions";
import {
  settingsFromBase64Url,
  settingsToBase64Url,
  settingsToDiff,
} from "@/lib/url-settings";

/**
 * Persist tool settings to localStorage with debounced writes.
 *
 * Returns [settings, update, reset]:
 * - update: shallow-merges a patch into current settings
 * - reset: reverts to defaults immediately
 */
export function useSettings<T extends Record<string, unknown>>(
  key: string,
  defaults: T,
): [T, (patch: Partial<T>) => void, () => void] {
  const storageKey = `studio:${key}`;
  const defaultsRef = useRef(defaults);

  const [settings, setSettings] = useState<T>(() => {
    // Priority: URL params > localStorage > defaults
    const urlParams = new URLSearchParams(window.location.search);
    const encoded = urlParams.get("s");
    if (encoded) {
      const decoded = settingsFromBase64Url(encoded);
      if (decoded) {
        const merged = { ...defaults, ...(decoded as Partial<T>) };
        localStorage.setItem(storageKey, JSON.stringify(merged));
        window.history.replaceState({}, "", window.location.pathname);
        return merged;
      }
    }

    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<T>;
        return { ...defaults, ...parsed };
      }
    } catch {
      // corrupted data — fall through to defaults
    }
    return defaults;
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<T | null>(null);

  // Debounced write to localStorage
  const writeToStorage = useCallback(
    (value: T) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      pendingRef.current = value;
      timerRef.current = setTimeout(() => {
        localStorage.setItem(storageKey, JSON.stringify(value));
        pendingRef.current = null;
      }, 200);
    },
    [storageKey],
  );

  // Flush pending write on unmount so settings aren't lost
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        if (pendingRef.current !== null) {
          localStorage.setItem(storageKey, JSON.stringify(pendingRef.current));
        }
      }
    };
  }, [storageKey]);

  // Register copyLink shortcut action
  useEffect(() => {
    shortcutActions.copyLink = () => {
      // Flush pending debounced write
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        if (pendingRef.current !== null) {
          localStorage.setItem(storageKey, JSON.stringify(pendingRef.current));
          pendingRef.current = null;
        }
      }
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      try {
        const current = JSON.parse(raw) as Record<string, unknown>;
        const diff = settingsToDiff(current, defaultsRef.current);
        const hasChanges = Object.keys(diff).length > 0;
        const url = hasChanges
          ? `${window.location.origin}/${key}?s=${settingsToBase64Url(diff)}`
          : `${window.location.origin}/${key}`;
        navigator.clipboard.writeText(url);
        window.dispatchEvent(new CustomEvent("studio:link-copied"));
      } catch {
        // clipboard or encoding failure — silently ignore
      }
    };
    return () => {
      shortcutActions.copyLink = null;
    };
  }, [key, storageKey]);

  const update = useCallback(
    (patch: Partial<T>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        writeToStorage(next);
        return next;
      });
    },
    [writeToStorage],
  );

  const reset = useCallback(() => {
    setSettings(defaults);
    localStorage.setItem(storageKey, JSON.stringify(defaults));
  }, [defaults, storageKey]);

  return [settings, update, reset];
}
