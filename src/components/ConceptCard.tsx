import { Mic, Move, Sparkles, Square, Volume2, X } from 'lucide-react';
import { CONCEPT_DETAILS, MEDIUM_INFO, type InteractiveObjectId, type SoundMedium } from '../types/lab';

interface ConceptCardProps {
  selectedObject: InteractiveObjectId | null;
  soundMedium: SoundMedium;
  isPlayingVoiceOver: boolean;
  hasCustomVoiceOver: boolean;
  audioMuted: boolean;
  onClose: () => void;
  onTriggerAction: (id: InteractiveObjectId) => void;
  onToggleVoiceOverPlayback: (id: InteractiveObjectId) => void;
  onOpenVoiceOverManager: () => void;
}

export function ConceptCard({
  selectedObject,
  soundMedium,
  isPlayingVoiceOver,
  hasCustomVoiceOver,
  audioMuted,
  onClose,
  onTriggerAction,
  onToggleVoiceOverPlayback,
  onOpenVoiceOverManager,
}: ConceptCardProps) {
  if (!selectedObject) return null;
  const info = CONCEPT_DETAILS[selectedObject];
  if (!info) return null;

  const isVacuumAlert = selectedObject === 'bel_vakum' && soundMedium === 'vakum';

  return (
    <aside
      className="fixed left-4 top-[74px] z-20 w-[min(336px,calc(100vw-32px))] rounded-xl border border-slate-700/90 bg-[#0f172a]/95 p-4 shadow-xl pointer-events-auto"
      aria-label="Penjelasan Materi"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium text-slate-400">{info.topicLabel}</p>
          <h2 className="mt-0.5 text-sm font-bold text-slate-50 leading-snug">{info.title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup penjelasan"
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-2 text-xs font-semibold text-amber-300">{info.principle}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-200">{info.summary}</p>

      {isVacuumAlert && (
        <p className="mt-2 rounded-lg border border-rose-500/40 bg-rose-950/60 px-2.5 py-2 text-[11px] leading-snug text-rose-200">
          Mode Ruang Hampa aktif ({MEDIUM_INFO.vakum.speedLabel}): pemukul bel bergetar, namun suara tidak terdengar karena tidak ada udara penghantar.
        </p>
      )}

      {/* Voice-Over Literacy Bar */}
      <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-2">
        <button
          type="button"
          onClick={() => onToggleVoiceOverPlayback(info.id)}
          className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
            isPlayingVoiceOver
              ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
              : 'bg-sky-500/20 text-sky-200 border border-sky-400/40 hover:bg-sky-500/30'
          }`}
        >
          {isPlayingVoiceOver ? (
            <>
              <Square className="h-3 w-3 fill-current" />
              <span>Hentikan Suara</span>
            </>
          ) : (
            <>
              <Volume2 className="h-3.5 w-3.5" />
              <span>{audioMuted ? 'Nyalakan & Dengarkan' : 'Dengarkan Penjelasan'}</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onOpenVoiceOverManager}
          title="Lihat naskah atau ganti rekaman voice-over"
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors whitespace-nowrap shrink-0"
        >
          <Mic className="h-3.5 w-3.5 text-amber-300" />
          <span>{hasCustomVoiceOver ? 'VO Khusus' : 'Kelola VO'}</span>
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-800 pt-2.5">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          {info.draggable ? (
            <Move className="h-3.5 w-3.5 text-sky-400 shrink-0" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          )}
          <span className="leading-tight">{info.interactionHint}</span>
        </div>

        {info.actionLabel && (
          <button
            type="button"
            onClick={() => onTriggerAction(info.id)}
            className="rounded-lg bg-slate-800 border border-slate-600 px-2.5 py-1.5 text-[11px] font-semibold text-slate-100 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            {info.actionLabel}
          </button>
        )}
      </div>
    </aside>
  );
}
