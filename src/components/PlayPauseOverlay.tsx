import { useState, useEffect, useRef } from "react";
import { Play, Pause } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface PlayPauseOverlayProps {
  isPlaying: boolean;
  triggerKey?: number;
}

export function PlayPauseOverlay({
  isPlaying,
  triggerKey,
}: PlayPauseOverlayProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const prevTrigger = useRef(triggerKey);

  useEffect(() => {
    if (triggerKey === prevTrigger.current) return;
    prevTrigger.current = triggerKey;

    setVisible(true);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(false), 700);

    return () => clearTimeout(timeoutRef.current);
  }, [triggerKey]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
        >
          <div className="bg-foreground/20 backdrop-blur-sm rounded-full p-6">
            {isPlaying ? (
              <Play className="w-12 h-12 text-foreground fill-foreground" />
            ) : (
              <Pause className="w-12 h-12 text-foreground fill-foreground" />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
