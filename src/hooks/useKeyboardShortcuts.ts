import { useEffect } from "react";

interface ShortcutHandlers {
  onTogglePlay?: () => void;
  onSkipForward?: () => void;
  onSkipBackward?: () => void;
}

export function useKeyboardShortcuts({
  onTogglePlay,
  onSkipForward,
  onSkipBackward,
}: ShortcutHandlers) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;

      if (e.code === "Space") {
        e.preventDefault();
        onTogglePlay?.();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        onSkipForward?.();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        onSkipBackward?.();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onTogglePlay, onSkipForward, onSkipBackward]);
}
