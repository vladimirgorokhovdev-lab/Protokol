import { useCallback, useState, useRef, useEffect } from "react";
import { Upload, FileAudio, X, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AudioUploaderProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
  onSeek?: (time: number) => void;
}

const ACCEPTED_TYPES = [
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav",
  "audio/ogg", "audio/flac", "audio/m4a", "audio/x-m4a",
  "audio/mp4", "audio/webm",
  "video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska",
  "video/webm", "video/x-ms-wmv",
];

const formatTime = (seconds: number) => {
  if (!isFinite(seconds) || seconds < 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const AudioUploader = ({ onFileSelect, isProcessing }: AudioUploaderProps) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, [audioUrl]);

  const handleFile = useCallback(
    (file: File) => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setSelectedFile(file);
      setAudioUrl(URL.createObjectURL(file));
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      onFileSelect(file);
    },
    [onFileSelect, audioUrl]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && ACCEPTED_TYPES.includes(file.type)) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const clearFile = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setSelectedFile(null);
    setAudioUrl(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const skip = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = ratio * duration;
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {!selectedFile ? (
          <motion.label
            key="dropzone"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            htmlFor="audio-upload"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`
              flex flex-col items-center justify-center gap-4 p-12 rounded-xl
              border-2 border-dashed cursor-pointer transition-all duration-300
              ${dragOver
                ? "border-gold bg-gold/5 scale-[1.01]"
                : "border-border hover:border-gold/50 hover:bg-muted/50"
              }
            `}
          >
            <div className="w-16 h-16 rounded-full bg-navy/10 flex items-center justify-center">
              <Upload className="w-7 h-7 text-navy" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-foreground">
                Перетащите аудио- или видеофайл сюда
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                или нажмите для выбора · MP3, WAV, MP4, MOV, AVI
              </p>
            </div>
            <input
              id="audio-upload"
              type="file"
              accept="audio/*,video/*"
              className="hidden"
              onChange={handleInputChange}
            />
          </motion.label>
        ) : (
          <motion.div
            key="file-info"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-xl bg-card border border-border overflow-hidden"
          >
            {/* File info row */}
            <div className="flex items-center gap-4 p-4 pb-2">
              <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0">
                <FileAudio className="w-5 h-5 text-gold-dark" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate text-sm">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(selectedFile.size)}</p>
              </div>
              {!isProcessing && (
                <button onClick={clearFile} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
              {isProcessing && (
                <div className="flex items-center gap-2 text-sm text-gold-dark font-medium">
                  <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                  Обработка...
                </div>
              )}
            </div>

            {/* Audio player */}
            {audioUrl && (
              <div className="px-4 pb-4 pt-1">
                {/* Progress bar */}
                <div
                  ref={progressRef}
                  onClick={handleProgressClick}
                  className="group relative w-full h-2 bg-muted rounded-full cursor-pointer mb-3"
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-gold rounded-full transition-[width] duration-100"
                    style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%" }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-gold-dark rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ left: duration > 0 ? `calc(${(currentTime / duration) * 100}% - 7px)` : "0" }}
                  />
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-mono w-16">
                    {formatTime(currentTime)}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => skip(-10)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      title="−10 сек"
                    >
                      <SkipBack className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={togglePlay}
                      className="p-2.5 rounded-full bg-navy hover:bg-navy-light transition-colors"
                      title={isPlaying ? "Пауза" : "Воспроизвести"}
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4 text-primary-foreground" />
                      ) : (
                        <Play className="w-4 h-4 text-primary-foreground ml-0.5" />
                      )}
                    </button>
                    <button
                      onClick={() => skip(10)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      title="+10 сек"
                    >
                      <SkipForward className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1 w-16 justify-end">
                    <button
                      onClick={toggleMute}
                      className="p-1 rounded hover:bg-muted transition-colors"
                      title={isMuted ? "Включить звук" : "Выключить звук"}
                    >
                      {isMuted ? (
                        <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </button>
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatTime(duration)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          className="hidden"
        />
      )}
    </div>
  );
};

export default AudioUploader;
