import { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Mic,
  Move,
  Sparkles,
  Square,
  Volume2,
  X,
} from 'lucide-react';
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

function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 640;
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
  // Start collapsed into a slim bar on mobile phones so the 3D scene stays fully visible
  const [expanded, setExpanded] = useState<boolean>(() => !isMobileViewport());

  useEffect(() => {
    if (!selectedObject) return;
    if (isMobileViewport()) {
      setExpanded(false);
    }
  }, [selectedObject]);

  if (!selectedObject) return null;
  const info = CONCEPT_DETAILS[selectedObject];
  if (!info) return null;

  const isVacuumAlert = selectedObject === 'bel_vakum' && soundMedium === 'vakum';

  return (
    <aside
      className={`fixed left-2.5 right-2.5 top-[58px] sm:left-4 sm:right-auto sm:top-[74px] z-20 rounded-xl border border-slate-700/90 bg-[#0f172a]/95 shadow-xl pointer-events-auto transition-all duration-150 ${
        expanded ? 'sm:w-[328px] max-h-[44vh] sm:max-h-[calc(100vh-220px)] flex flex-col' : 'sm:w-[328px]'
      }`}
      aria-label="Penjelasan Materi"
    >
      {/* Always-visible Compact Header & Quick Voice-Over Control */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-3.5 sm:py-2.5">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="min-w-0 flex-1 text-left"
          title={expanded ? 'Ringkas panel materi' : 'Buka penjelasan lengkap'}
        >
          <p className="hidden sm:block text-[11px] font-medium text-slate-400 truncate">
            {info.topicLabel}
          </p>
          <h2 className="text-xs sm:text-sm font-bold text-slate-50 leading-snug truncate">
            {info.title}
          </h2>
          {!expanded && (
            <p className="text-[10px] sm:text-[11px] text-amber-300 truncate">
              {info.principle}
            </p>
          )}
        </button>

        <div className="flex items-center gap-1 shrink-0">
          {/* Quick Play/Stop Voice-Over Button (always reachable even when minimized) */}
          <button
            type="button"
            onClick={() => onToggleVoiceOverPlayback(info.id)}
            aria-label={isPlayingVoiceOver ? 'Hentikan suara narasi' : 'Putar suara narasi'}
            title={isPlayingVoiceOver ? 'Hentikan Suara' : 'Dengarkan Penjelasan'}
            className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
              isPlayingVoiceOver
                ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                : 'bg-sky-500/20 text-sky-200 border border-sky-400/40 hover:bg-sky-500/30'
            }`}
          >
            {isPlayingVoiceOver ? (
              <>
                <Square className="h-3 w-3 fill-current" />
                <span>Stop</span>
              </>
            ) : (
              <>
                <Volume2 className="h-3.5 w-3.5" />
                <span>{audioMuted ? 'Suara' : 'Dengar'}</span>
              </>
            )}
          </button>

          {/* Expand / Collapse Text Details */}
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-label={expanded ? 'Ringkas teks materi' : 'Baca teks materi'}
            title={expanded ? 'Ringkas teks agar layar 3D lebih luas' : 'Baca penjelasan materi'}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/90 px-2 text-[11px] font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Ringkas</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                <span>Baca</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup penjelasan"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expandable Full Explanation Body (Scrollable if tall on small screens) */}
      {expanded && (
        <div className="overflow-y-auto border-t border-slate-800 px-3 pb-3 pt-2.5 sm:px-3.5 sm:pb-3.5">
          <p className="text-xs font-semibold text-amber-300">{info.principle}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-200">{info.summary}</p>

          {isVacuumAlert && (
            <p className="mt-2 rounded-lg border border-rose-500/40 bg-rose-950/60 px-2.5 py-2 text-[11px] leading-snug text-rose-200">
              Mode Ruang Hampa aktif ({MEDIUM_INFO.vakum.speedLabel}): pemukul bel bergetar, namun suara tidak terdengar karena tidak ada udara penghantar.
            </p>
          )}

          {/* Secondary Voice-Over Manager Row */}
          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5">
            <span className="text-[11px] text-slate-300 truncate">
              {isPlayingVoiceOver
                ? 'Sedang memutar panduan suara'
                : hasCustomVoiceOver
                  ? 'Rekaman pengganti aktif'
                  : 'Panduan suara siap diputar'}
            </span>
            <button
              type="button"
              onClick={onOpenVoiceOverManager}
              title="Lihat naskah atau ganti rekaman voice-over"
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-amber-200 hover:bg-slate-800 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Mic className="h-3 w-3 text-amber-300" />
              <span>Kelola VO</span>
            </button>
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-800 pt-2.5">
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
        </div>
      )}
    </aside>
  );
}
