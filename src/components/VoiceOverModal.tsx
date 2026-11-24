import { useRef, useState, type ChangeEvent } from 'react';
import {
  Check,
  Copy,
  Headphones,
  Play,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { VoiceOverPlaybackState, VoiceOverTrackMeta } from '../audio/voiceOverEngine';
import {
  CONCEPT_DETAILS,
  OBJECT_ORDER,
  type InteractiveObjectId,
} from '../types/lab';

interface VoiceOverModalProps {
  open: boolean;
  onClose: () => void;
  playback: VoiceOverPlaybackState;
  tracks: Partial<Record<InteractiveObjectId, VoiceOverTrackMeta>>;
  onPlayOrStop: (id: InteractiveObjectId) => void;
  onUploadAudio: (id: InteractiveObjectId, file: File) => Promise<void>;
  onRemoveAudio: (id: InteractiveObjectId) => Promise<void>;
}

type TopicFilter = 'semua' | 'cahaya' | 'bunyi';

const SOUND_IDS = new Set<InteractiveObjectId>([
  'garpu_tala',
  'gendang',
  'bel_vakum',
  'dinding_akustik',
]);

export function VoiceOverModal({
  open,
  onClose,
  playback,
  tracks,
  onPlayOrStop,
  onUploadAudio,
  onRemoveAudio,
}: VoiceOverModalProps) {
  const [filter, setFilter] = useState<TopicFilter>('semua');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<InteractiveObjectId | null>(null);
  const fileInputRefs = useRef<Partial<Record<InteractiveObjectId, HTMLInputElement | null>>>({});

  if (!open) return null;

  const filteredIds = OBJECT_ORDER.filter((id) => {
    if (filter === 'cahaya') return !SOUND_IDS.has(id);
    if (filter === 'bunyi') return SOUND_IDS.has(id);
    return true;
  });

  const uploadedCount = OBJECT_ORDER.filter((id) => Boolean(tracks[id])).length;

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(key);
      window.setTimeout(() => {
        setCopiedId((prev) => (prev === key ? null : prev));
      }, 2000);
    } catch {
      setUploadError('Gagal menyalin teks ke papan klip peramban.');
    }
  };

  const handleCopyAllScripts = () => {
    const fullText = OBJECT_ORDER.map((id, index) => {
      const item = CONCEPT_DETAILS[id];
      return `${index + 1}. ${item.title} (${item.voiceOverCode}.mp3)\n${item.topicLabel} — ${item.principle}\nNaskah: "${item.voiceOverScript}"`;
    }).join('\n\n');
    void copyText('ALL', `NASKAH VOICE-OVER LAB 3D CAHAYA & BUNYI (IPAS KELAS 5 SD)\n\n${fullText}`);
  };

  const handleFileChange = async (id: InteractiveObjectId, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadError(null);
    setBusyId(id);
    try {
      await onUploadAudio(id, file);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Gagal mengunggah berkas audio.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (id: InteractiveObjectId) => {
    setUploadError(null);
    setBusyId(id);
    try {
      await onRemoveAudio(id);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Kelola Panduan Suara dan Naskah Voice-Over"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-700 bg-[#0f172a] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Headphones className="h-5 w-5 text-sky-400 shrink-0" />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">
                Panduan Suara &amp; Naskah Voice-Over
              </h2>
              <p className="text-[11px] text-slate-400">
                10 dari {OBJECT_ORDER.length} alat terpasang rekaman suara aktif
                {uploadedCount > 0 ? ` (${uploadedCount} audio pengganti khusus)` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyAllScripts}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 text-xs font-semibold text-slate-100 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              {copiedId === 'ALL' ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Semua Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-sky-300" />
                  <span>Salin Semua Naskah</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup jendela panduan suara"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Sub-bar: Topic Filter + Short Info */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-900/60 px-5 py-2.5">
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'semua', label: 'Semua (10)' },
                { id: 'cahaya', label: 'Topik A: Cahaya (6)' },
                { id: 'bunyi', label: 'Topik B: Bunyi (4)' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  filter === tab.id
                    ? 'bg-sky-500 text-slate-950'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <p className="text-[11px] text-slate-400">
            Format pengganti: MP3, WAV, M4A, OGG (tersimpan di peramban ini)
          </p>
        </div>

        {/* Error Alert */}
        {uploadError && (
          <div className="mx-5 mt-3 rounded-lg border border-rose-500/40 bg-rose-950/60 px-3 py-2 text-xs text-rose-200">
            {uploadError}
          </div>
        )}

        {/* Scrollable List of 10 Voice-Over Scripts */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {filteredIds.map((id) => {
            const item = CONCEPT_DETAILS[id];
            const globalIndex = OBJECT_ORDER.indexOf(id) + 1;
            const track = tracks[id];
            const isPlaying = playback.playingId === id;
            const isBusy = busyId === id;

            return (
              <div
                key={id}
                className={`rounded-xl border p-4 transition-colors ${
                  isPlaying
                    ? 'border-sky-400/70 bg-sky-950/25'
                    : 'border-slate-800 bg-slate-900/70'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono-num text-xs font-bold text-amber-300">
                        {String(globalIndex).padStart(2, '0')}
                      </span>
                      <h3 className="text-sm font-bold text-slate-100">{item.title}</h3>
                      <span className="font-mono-num text-[11px] text-slate-400">
                        {item.voiceOverCode}.wav
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {item.topicLabel} ·{' '}
                      {track ? (
                        <span className="text-amber-300 font-medium">
                          Audio pengganti: {track.fileName}
                        </span>
                      ) : (
                        <span className="text-emerald-300 font-medium">
                          Rekaman terpasang ({item.voiceOverCode}.wav)
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Single-line Action Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onPlayOrStop(id)}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        isPlaying
                          ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                          : 'border border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700'
                      }`}
                    >
                      {isPlaying ? (
                        <>
                          <Square className="h-3 w-3 fill-current" />
                          <span>Hentikan</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3 fill-current" />
                          <span>Putar</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => void copyText(id, item.voiceOverScript)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
                    >
                      {copiedId === id ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span>Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 text-slate-400" />
                          <span>Salin</span>
                        </>
                      )}
                    </button>

                    <input
                      ref={(el) => {
                        fileInputRefs.current[id] = el;
                      }}
                      type="file"
                      accept="audio/*,.mp3,.wav,.m4a,.ogg"
                      className="hidden"
                      onChange={(e) => void handleFileChange(id, e)}
                    />
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => fileInputRefs.current[id]?.click()}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-500/15 px-2.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Upload className="h-3 w-3" />
                      <span>Ganti Audio</span>
                    </button>

                    {track && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleRemove(id)}
                        title="Hapus audio pengganti dan kembali ke rekaman bawaan"
                        aria-label={`Kembalikan audio bawaan ${item.title}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/40 bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 disabled:opacity-50 transition-colors shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="mt-2.5 rounded-lg border border-slate-800/90 bg-[#0b1220] px-3 py-2 text-xs leading-relaxed text-slate-200">
                  “{item.voiceOverScript}”
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
