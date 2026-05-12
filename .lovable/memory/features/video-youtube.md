---
name: Video and YouTube support
description: Поддержка видеофайлов (MP4, MOV, AVI, MKV) и YouTube ссылок для расшифровки
type: feature
---
- Видеофайлы принимаются напрямую — ElevenLabs scribe_v2 поддерживает видеоформаты нативно
- YouTube: edge function `youtube-transcribe` извлекает аудио через cobalt API (fallback: Invidious) и отправляет на ElevenLabs
- QueueItem теперь имеет опциональные поля: isYouTube, youtubeUrl, file может быть null
