import { useContext } from "react";
import { TranscriptionQueueContext } from "@/contexts/TranscriptionQueueContext";

export function useSharedTranscriptionQueue() {
  const ctx = useContext(TranscriptionQueueContext);
  if (!ctx) {
    throw new Error(
      "useSharedTranscriptionQueue must be used within TranscriptionQueueProvider",
    );
  }
  return ctx;
}
