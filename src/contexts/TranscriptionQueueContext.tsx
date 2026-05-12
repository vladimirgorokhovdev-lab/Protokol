import { createContext, type ReactNode } from "react";
import { useTranscriptionQueue } from "@/hooks/useTranscriptionQueue";
import type { QueueItem } from "@/hooks/useTranscriptionQueue";

export interface TranscriptionQueueContextType {
  items: QueueItem[];
  addFiles: (files: File[], numSpeakers?: number) => void;
  cancelItem: (id: string) => void;
  removeItem: (id: string) => void;
  retryItem: (id: string) => void;
  renameSpeaker: (
    itemId: string,
    originalName: string,
    newName: string,
  ) => void;
}

export const TranscriptionQueueContext =
  createContext<TranscriptionQueueContextType | null>(null);

export function TranscriptionQueueProvider({
  children,
}: {
  children: ReactNode;
}) {
  const queue = useTranscriptionQueue();
  return (
    <TranscriptionQueueContext.Provider value={queue}>
      {children}
    </TranscriptionQueueContext.Provider>
  );
}
