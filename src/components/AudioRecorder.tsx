import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, X } from "lucide-react";

interface AudioRecorderProps {
  onClose: () => void;
  onRecordingComplete: (file: File) => void;
}

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const AudioRecorder = ({ onClose, onRecordingComplete }: AudioRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const shouldSaveRef = useRef(true);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === "recording") {
        shouldSaveRef.current = false;
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      shouldSaveRef.current = true;

      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setError(
          "Браузер не поддерживает запись с микрофона. Откройте сайт по HTTPS в Safari или Chrome.",
        );
        return;
      }
      if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") {
        setError("Этот браузер не поддерживает запись аудио (MediaRecorder).");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Android Chrome: webm/opus; iOS Safari: mp4/aac; Firefox: ogg
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4;codecs=mp4a.40.2",
        "audio/mp4",
        "audio/aac",
      ];
      const isSupported = (t: string) =>
        typeof MediaRecorder !== "undefined" &&
        typeof MediaRecorder.isTypeSupported === "function" &&
        MediaRecorder.isTypeSupported(t);
      const mimeType = candidates.find(isSupported) || "";

      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
      } catch {
        // На некоторых устройствах конструктор падает с указанным mimeType — пробуем без него
        mediaRecorder = new MediaRecorder(stream);
      }
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      const actualMime = mediaRecorder.mimeType || mimeType || "audio/webm";
      const ext = actualMime.includes("mp4")
        ? "m4a"
        : actualMime.includes("aac")
          ? "aac"
          : actualMime.includes("ogg")
            ? "ogg"
            : "webm";

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        if (shouldSaveRef.current && chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: actualMime });
          const timestamp = new Date()
            .toISOString()
            .slice(0, 19)
            .replace(/[T:]/g, "-");
          const file = new File([blob], `recording-${timestamp}.${ext}`, {
            type: actualMime,
          });
          onRecordingComplete(file);
        }
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      mediaRecorder.onerror = (ev: Event) => {
        const errEvent = ev as Event & { error?: { name?: string; message?: string } };
        setError(
          `Ошибка записи: ${errEvent.error?.message || errEvent.error?.name || "неизвестная ошибка"}`,
        );
      };

      // Периодический сбор чанков нужен для Android Chrome — иначе ondataavailable
      // может не сработать до stop() и запись окажется пустой.
      try {
        mediaRecorder.start(1000);
      } catch {
        mediaRecorder.start();
      }
      setIsRecording(true);
      setDuration(0);
      timerRef.current = window.setInterval(
        () => setDuration((d) => d + 1),
        1000
      );
    } catch (e) {
      const err = e as { name?: string; message?: string };
      if (err?.name === "NotAllowedError" || err?.name === "SecurityError") {
        setError("Доступ к микрофону запрещён. Разрешите его в настройках браузера.");
      } else if (err?.name === "NotFoundError" || err?.name === "OverconstrainedError") {
        setError("Микрофон не найден на устройстве.");
      } else if (err?.name === "NotReadableError") {
        setError("Микрофон занят другим приложением. Закройте его и повторите.");
      } else {
        setError(
          `Не удалось получить доступ к микрофону: ${err?.message || "неизвестная ошибка"}`,
        );
      }
    }
  }, [onRecordingComplete]);

  const stopRecording = useCallback(() => {
    shouldSaveRef.current = true;
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = 0;
    }
    onClose();
  }, [onClose]);

  const handleClose = useCallback(() => {
    if (isRecording && mediaRecorderRef.current) {
      shouldSaveRef.current = false;
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    onClose();
  }, [isRecording, onClose]);

  return (
    <div className="rounded-xl bg-card border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif font-semibold text-foreground">
          Запись аудио
        </h3>
        <button
          onClick={handleClose}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      <div className="flex flex-col items-center gap-4">
        {isRecording && (
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-2xl font-mono text-foreground">
              {formatDuration(duration)}
            </span>
          </div>
        )}

        <div className="flex gap-3">
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors font-medium"
            >
              <Mic className="w-5 h-5" />
              Начать запись
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-navy hover:bg-navy-light text-primary-foreground transition-colors font-medium"
            >
              <Square className="w-4 h-4" />
              Остановить и расшифровать
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioRecorder;