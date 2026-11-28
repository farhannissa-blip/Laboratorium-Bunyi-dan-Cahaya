import type { InteractiveObjectId } from '../types/lab';

export type VoiceOverSource = 'custom' | 'bundled' | 'tts' | null;

export interface VoiceOverPlaybackState {
  playingId: InteractiveObjectId | null;
  source: VoiceOverSource;
}

export interface VoiceOverTrackMeta {
  id: InteractiveObjectId;
  fileName: string;
  updatedAt: number;
}

interface StoredVoiceOverRecord {
  id: InteractiveObjectId;
  fileName: string;
  blob: Blob;
  updatedAt: number;
}

type PlaybackListener = (state: VoiceOverPlaybackState) => void;

const DB_NAME = 'lab-cahaya-bunyi-vo-db';
const STORE_NAME = 'tracks';
const DB_VERSION = 1;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

class VoiceOverEngine {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private memoryFallback = new Map<InteractiveObjectId, StoredVoiceOverRecord>();
  private activeAudio: HTMLAudioElement | null = null;
  private activeObjectUrl: string | null = null;
  private playToken = 0;
  private state: VoiceOverPlaybackState = { playingId: null, source: null };
  private listeners = new Set<PlaybackListener>();

  public subscribe(listener: PlaybackListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): VoiceOverPlaybackState {
    return this.state;
  }

  private setState(next: VoiceOverPlaybackState) {
    if (this.state.playingId === next.playingId && this.state.source === next.source) return;
    this.state = next;
    for (const listener of this.listeners) {
      listener(next);
    }
  }

  private openDb(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return Promise.resolve(null);
    }
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve) => {
        try {
          const request = window.indexedDB.open(DB_NAME, DB_VERSION);
          request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    }
    return this.dbPromise;
  }

  public async loadMetadata(): Promise<Partial<Record<InteractiveObjectId, VoiceOverTrackMeta>>> {
    const result: Partial<Record<InteractiveObjectId, VoiceOverTrackMeta>> = {};
    for (const [id, rec] of this.memoryFallback.entries()) {
      result[id] = { id, fileName: rec.fileName, updatedAt: rec.updatedAt };
    }

    const db = await this.openDb();
    if (!db) return result;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const rows = (req.result || []) as StoredVoiceOverRecord[];
          for (const row of rows) {
            result[row.id] = {
              id: row.id,
              fileName: row.fileName,
              updatedAt: row.updatedAt,
            };
          }
          resolve(result);
        };
        req.onerror = () => resolve(result);
      } catch {
        resolve(result);
      }
    });
  }

  private async getTrackRecord(id: InteractiveObjectId): Promise<StoredVoiceOverRecord | null> {
    const inMem = this.memoryFallback.get(id);
    if (inMem) return inMem;

    const db = await this.openDb();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => {
          const row = req.result as StoredVoiceOverRecord | undefined;
          resolve(row ?? null);
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  public async uploadAudio(id: InteractiveObjectId, file: File): Promise<VoiceOverTrackMeta> {
    const isAudioType =
      file.type.startsWith('audio/') ||
      /\.(mp3|wav|m4a|ogg|aac|webm|flac)$/i.test(file.name);
    if (!isAudioType) {
      throw new Error('Format file harus berupa audio (MP3, WAV, M4A, atau OGG).');
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error('Ukuran file terlalu besar (maksimal 25 MB).');
    }

    const record: StoredVoiceOverRecord = {
      id,
      fileName: file.name,
      blob: file,
      updatedAt: Date.now(),
    };

    // Always store in memory fallback for instant playback even if IndexedDB is restricted
    this.memoryFallback.set(id, record);

    const db = await this.openDb();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(record);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }

    if (this.state.playingId === id) {
      this.stop();
    }

    return {
      id,
      fileName: record.fileName,
      updatedAt: record.updatedAt,
    };
  }

  public async removeAudio(id: InteractiveObjectId): Promise<void> {
    this.memoryFallback.delete(id);

    const db = await this.openDb();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).delete(id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }

    if (this.state.playingId === id) {
      this.stop();
    }
  }

  public stop(): void {
    this.playToken += 1;

    if (this.activeAudio) {
      try {
        this.activeAudio.pause();
        this.activeAudio.onended = null;
        this.activeAudio.onerror = null;
        this.activeAudio.src = '';
      } catch {
        // Ignore media teardown errors
      }
      this.activeAudio = null;
    }

    if (this.activeObjectUrl) {
      URL.revokeObjectURL(this.activeObjectUrl);
      this.activeObjectUrl = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore synthesis cancel errors
      }
    }

    this.setState({ playingId: null, source: null });
  }

  private async playAudioUrl(
    id: InteractiveObjectId,
    url: string,
    source: 'custom' | 'bundled',
    isObjectUrl: boolean,
    token: number,
    onDecodeError?: () => void,
    onFinished?: () => void
  ): Promise<void> {
    const audio = new Audio(url);
    audio.preload = 'auto';
    this.activeAudio = audio;
    if (isObjectUrl) {
      this.activeObjectUrl = url;
    }

    const cleanup = (completedNaturally: boolean) => {
      if (this.activeAudio === audio) {
        this.activeAudio = null;
      }
      if (isObjectUrl && this.activeObjectUrl === url) {
        URL.revokeObjectURL(url);
        this.activeObjectUrl = null;
      }
      if (token === this.playToken) {
        this.setState({ playingId: null, source: null });
        if (completedNaturally && onFinished) {
          onFinished();
        }
      }
    };

    audio.onended = () => cleanup(true);
    audio.onerror = () => {
      cleanup(false);
      if (token === this.playToken && onDecodeError) {
        onDecodeError();
      } else if (token === this.playToken && onFinished) {
        onFinished();
      }
    };

    this.setState({ playingId: id, source });
    try {
      await audio.play();
    } catch {
      cleanup(false);
      if (token === this.playToken && onFinished) {
        onFinished();
      }
    }
  }

  public async play(
    id: InteractiveObjectId,
    fallbackScript: string,
    bundledAudioUrl?: string,
    onFinished?: () => void
  ): Promise<void> {
    this.stop();
    const token = this.playToken;

    const record = await this.getTrackRecord(id);
    if (token !== this.playToken) return;

    // 1. Prefer user-uploaded custom replacement if present
    if (record && record.blob) {
      const objectUrl = URL.createObjectURL(record.blob);
      await this.playAudioUrl(
        id,
        objectUrl,
        'custom',
        true,
        token,
        () => {
          if (bundledAudioUrl) {
            void this.playAudioUrl(
              id,
              bundledAudioUrl,
              'bundled',
              false,
              token,
              () => {
                this.speakTts(id, fallbackScript, token, onFinished);
              },
              onFinished
            );
          } else {
            this.speakTts(id, fallbackScript, token, onFinished);
          }
        },
        onFinished
      );
      return;
    }

    // 2. Play built-in recorded Voice-Over audio file
    if (bundledAudioUrl) {
      await this.playAudioUrl(
        id,
        bundledAudioUrl,
        'bundled',
        false,
        token,
        () => {
          this.speakTts(id, fallbackScript, token, onFinished);
        },
        onFinished
      );
      return;
    }

    // 3. Fallback to Indonesian SpeechSynthesis
    this.speakTts(id, fallbackScript, token, onFinished);
  }

  private pickIndonesianVoice(): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    return (
      voices.find((v) => v.lang.toLowerCase() === 'id-id') ||
      voices.find((v) => v.lang.toLowerCase().startsWith('id')) ||
      null
    );
  }

  private speakTts(
    id: InteractiveObjectId,
    text: string,
    token: number,
    onFinished?: () => void
  ) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) {
      this.setState({ playingId: null, source: null });
      if (token === this.playToken && onFinished) {
        onFinished();
      }
      return;
    }

    try {
      const synth = window.speechSynthesis;
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.rate = 0.96;
      utterance.pitch = 1.0;

      const idVoice = this.pickIndonesianVoice();
      if (idVoice) {
        utterance.voice = idVoice;
      }

      utterance.onend = () => {
        if (token === this.playToken) {
          this.setState({ playingId: null, source: null });
          if (onFinished) onFinished();
        }
      };

      utterance.onerror = () => {
        if (token === this.playToken) {
          this.setState({ playingId: null, source: null });
          if (onFinished) onFinished();
        }
      };

      this.setState({ playingId: id, source: 'tts' });
      synth.speak(utterance);
    } catch {
      this.setState({ playingId: null, source: null });
      if (token === this.playToken && onFinished) {
        onFinished();
      }
    }
  }
}

export const voiceOverEngine = new VoiceOverEngine();
