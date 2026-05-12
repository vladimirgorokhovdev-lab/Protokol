import { useCallback, useState, forwardRef } from "react";
import { Upload, Mic, FolderOpen, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AudioDropZoneProps {
  onFilesSelect: (files: File[], numSpeakers?: number) => void;
  onRecordClick: () => void;
}

const MEDIA_EXTENSIONS = [
  ".mp3",
  ".wav",
  ".ogg",
  ".flac",
  ".m4a",
  ".webm",
  ".aac",
  ".wma",
  ".opus",
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
  ".wmv",
  ".m4v",
];

const isMediaFile = (file: File): boolean => {
  if (file.type.startsWith("audio/") || file.type.startsWith("video/"))
    return true;
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  return MEDIA_EXTENSIONS.includes(ext);
};

const readEntryAsFile = (entry: FileSystemFileEntry): Promise<File> =>
  new Promise((resolve, reject) => entry.file(resolve, reject));

const readDirectoryEntries = (
  reader: FileSystemDirectoryReader,
): Promise<FileSystemEntry[]> =>
  new Promise((resolve, reject) => reader.readEntries(resolve, reject));

const collectMediaFiles = async (entry: FileSystemEntry): Promise<File[]> => {
  if (entry.isFile) {
    const file = await readEntryAsFile(entry as FileSystemFileEntry);
    return isMediaFile(file) ? [file] : [];
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const files: File[] = [];
    let batch: FileSystemEntry[];
    do {
      batch = await readDirectoryEntries(reader);
      for (const child of batch) {
        files.push(...(await collectMediaFiles(child)));
      }
    } while (batch.length > 0);
    return files;
  }
  return [];
};

const UNCOMPRESSED_EXTS = [".wav", ".flac", ".aiff", ".aif"];
const LARGE_FILE_BYTES = 100 * 1024 * 1024;
const VERY_LARGE_FILE_BYTES = 300 * 1024 * 1024;

const formatMb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(0)} МБ`;

const warnAboutLargeFiles = (files: File[]) => {
  for (const f of files) {
    const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
    const isUncompressed = UNCOMPRESSED_EXTS.includes(ext);
    if (isUncompressed && f.size > LARGE_FILE_BYTES) {
      toast({
        title: `Несжатый файл: ${f.name} (${formatMb(f.size)})`,
        description:
          "Рекомендуем сконвертировать в MP3 или M4A — размер уменьшится в 8–10 раз без потери точности расшифровки.",
        duration: 8000,
      });
    } else if (f.size > VERY_LARGE_FILE_BYTES) {
      toast({
        title: `Очень крупный файл: ${f.name} (${formatMb(f.size)})`,
        description: "Расшифровка может занять 10–20 минут.",
        duration: 8000,
      });
    }
  }
};

const AudioDropZone = forwardRef<HTMLInputElement, AudioDropZoneProps>(
  ({ onFilesSelect, onRecordClick }, ref) => {
    const [dragOver, setDragOver] = useState(false);
    const [numSpeakers, setNumSpeakers] = useState<string>("");

    const selectedSpeakers = numSpeakers
      ? parseInt(numSpeakers, 10)
      : undefined;

    const handleDrop = useCallback(
      async (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);

        const items = e.dataTransfer.items;
        const allFiles: File[] = [];

        if (items && items.length > 0) {
          const entries: FileSystemEntry[] = [];
          for (let i = 0; i < items.length; i++) {
            const entry = items[i].webkitGetAsEntry?.();
            if (entry) entries.push(entry);
          }

          if (entries.length > 0) {
            for (const entry of entries) {
              allFiles.push(...(await collectMediaFiles(entry)));
            }
          } else {
            const files = Array.from(e.dataTransfer.files).filter(isMediaFile);
            allFiles.push(...files);
          }
        } else {
          const files = Array.from(e.dataTransfer.files).filter(isMediaFile);
          allFiles.push(...files);
        }

        if (allFiles.length > 0) {
          warnAboutLargeFiles(allFiles);
          onFilesSelect(allFiles, selectedSpeakers);
        }
      },
      [onFilesSelect, selectedSpeakers],
    );

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).filter(isMediaFile);
      if (files.length > 0) {
        warnAboutLargeFiles(files);
        onFilesSelect(files, selectedSpeakers);
      }
      e.target.value = "";
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card border border-border">
          <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <label className="text-sm text-muted-foreground whitespace-nowrap">
            Кол-во спикеров
          </label>
          <input
            type="number"
            min="1"
            max="32"
            placeholder="авто"
            value={numSpeakers}
            onChange={(e) => setNumSpeakers(e.target.value)}
            className="w-20 px-2 py-1 rounded-md border border-border bg-background text-foreground text-sm text-center outline-none focus:ring-2 focus:ring-gold/50"
          />
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Укажите, если знаете точное число участников
          </span>
        </div>

        <div className="flex gap-3">
          <label
            htmlFor="audio-upload-multi"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`
            flex-1 flex flex-col items-center justify-center gap-3 p-8 rounded-xl
            border-2 border-dashed cursor-pointer transition-all duration-300
            ${
              dragOver
                ? "border-gold bg-gold/5 scale-[1.005]"
                : "border-border hover:border-gold/50 hover:bg-muted/50"
            }
          `}
          >
            <div className="w-12 h-12 rounded-full bg-navy/10 flex items-center justify-center">
              <Upload className="w-6 h-6 text-navy" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                Перетащите аудио- или видеофайлы сюда
              </p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                <FolderOpen className="w-3.5 h-3.5" />
                MP3, WAV, OGG, FLAC, M4A, MP4, MOV, AVI, MKV
              </p>
            </div>
            <input
              ref={ref}
              id="audio-upload-multi"
              type="file"
              accept="audio/*,video/*"
              multiple
              className="hidden"
              onChange={handleInputChange}
            />
          </label>

          <button
            onClick={onRecordClick}
            className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-border hover:border-red-400/50 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-all cursor-pointer min-w-[120px]"
          >
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Mic className="w-6 h-6 text-red-500" />
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              Записать
            </p>
          </button>
        </div>
      </div>
    );
  },
);

AudioDropZone.displayName = "AudioDropZone";

export default AudioDropZone;
