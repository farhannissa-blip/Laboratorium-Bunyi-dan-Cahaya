/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpenCheck,
  Hand,
  Headphones,
  Mic,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
  VolumeX,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  voiceOverEngine,
  type VoiceOverPlaybackState,
  type VoiceOverTrackMeta,
} from './audio/voiceOverEngine';
import { ConceptCard } from './components/ConceptCard';
import { ControlDock } from './components/ControlDock';
import { QuizModal } from './components/QuizModal';
import { VoiceOverModal } from './components/VoiceOverModal';
import { ANIMATION_TOUR_STEPS } from './data/animationTour';
import { LabSceneManager } from './scene/LabSceneManager';
import {
  CONCEPT_DETAILS,
  LIGHT_EXPERIMENT_INFO,
  detectDefaultPerformanceMode,
  type AcousticWallType,
  type CameraPreset,
  type InteractiveObjectId,
  type LabState,
  type LabTab,
  type LightExperiment,
  type MaterialSlabType,
  type PerformanceMode,
  type SoundMedium,
} from './types/lab';

const INITIAL_STATE: LabState = {
  activeTab: 'cahaya',
  performanceMode: detectDefaultPerformanceMode(),
  flashlightOn: true,
  lightBrightness: 88,
  lightExperiment: 'dispersi',
  mirrorAngle: 25,
  materialSlab: 'bening',
  soundMedium: 'udara',
  soundFrequency: 440,
  soundAmplitude: 75,
  acousticWall: 'pantul',
  audioMuted: false,
  voiceOverEnabled: true,
  selectedObject: null,
};

const SOUND_INSTRUMENT_IDS = new Set<InteractiveObjectId>([
  'garpu_tala',
  'gendang',
  'bel_vakum',
]);

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<LabSceneManager | null>(null);

  const [labState, setLabState] = useState<LabState>(INITIAL_STATE);
  const labStateRef = useRef<LabState>(INITIAL_STATE);
  labStateRef.current = labState;

  const prevExperimentRef = useRef<LightExperiment>(INITIAL_STATE.lightExperiment);
  const prevPerfModeRef = useRef<PerformanceMode>(INITIAL_STATE.performanceMode);
  const voTimerRef = useRef<number | null>(null);

  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [voModalOpen, setVoModalOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<InteractiveObjectId | null>(null);
  const [webglError, setWebglError] = useState(false);

  const [tourActive, setTourActive] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const tourRunIdRef = useRef(0);
  const tourTimersRef = useRef<number[]>([]);

  const [voPlayback, setVoPlayback] = useState<VoiceOverPlaybackState>({
    playingId: null,
    source: null,
  });
  const [voTracks, setVoTracks] = useState<
    Partial<Record<InteractiveObjectId, VoiceOverTrackMeta>>
  >({});

  const clearTourTimers = useCallback(() => {
    for (const tid of tourTimersRef.current) {
      window.clearTimeout(tid);
    }
    tourTimersRef.current = [];
  }, []);

  const clearPendingVoiceOver = useCallback(() => {
    if (voTimerRef.current !== null) {
      window.clearTimeout(voTimerRef.current);
      voTimerRef.current = null;
    }
  }, []);

  const stopTour = useCallback(
    (resetOverview = false) => {
      tourRunIdRef.current += 1;
      clearTourTimers();
      clearPendingVoiceOver();
      voiceOverEngine.stop();
      setTourActive(false);
      if (resetOverview) {
        setLabState((prev) => ({ ...prev, selectedObject: null }));
        sceneRef.current?.setCameraPreset('overview');
      }
    },
    [clearPendingVoiceOver, clearTourTimers]
  );

  const runTourStep = useCallback(
    (stepIdx: number) => {
      if (stepIdx < 0 || stepIdx >= ANIMATION_TOUR_STEPS.length) {
        stopTour(true);
        return;
      }

      const runId = ++tourRunIdRef.current;
      clearTourTimers();
      clearPendingVoiceOver();
      voiceOverEngine.stop();

      const step = ANIMATION_TOUR_STEPS[stepIdx];
      setTourActive(true);
      setTourStepIndex(stepIdx);

      // Apply step's initial 3D experiment state
      setLabState((prev) => ({
        ...prev,
        ...step.initialPatch,
        selectedObject: step.objectId,
      }));
      sceneRef.current?.setCameraPreset(step.camera);

      // Trigger initial sound instrument if this step opens with a sound demo
      if (step.initialSound) {
        const soundId = step.initialSound;
        const soundTimer = window.setTimeout(() => {
          if (tourRunIdRef.current !== runId) return;
          sceneRef.current?.triggerSoundInstrument(soundId);
        }, 220);
        tourTimersRef.current.push(soundTimer);
      }

      // Schedule live 3D micro-animations (mirror sweep, slab cycling, vacuum switch, etc.)
      if (step.microEvents) {
        for (const ev of step.microEvents) {
          const evTimer = window.setTimeout(() => {
            if (tourRunIdRef.current !== runId) return;
            if (ev.patch) {
              setLabState((prev) => ({ ...prev, ...ev.patch }));
            }
            if (ev.camera) {
              sceneRef.current?.setCameraPreset(ev.camera);
            }
            if (ev.triggerSound) {
              const sid = ev.triggerSound;
              const strikeDelay = window.setTimeout(() => {
                if (tourRunIdRef.current !== runId) return;
                sceneRef.current?.triggerSoundInstrument(sid);
              }, 120);
              tourTimersRef.current.push(strikeDelay);
            }
          }, ev.delayMs);
          tourTimersRef.current.push(evTimer);
        }
      }

      let advanced = false;
      const advanceNext = (delayMs: number) => {
        if (advanced || tourRunIdRef.current !== runId) return;
        advanced = true;
        const nextTimer = window.setTimeout(() => {
          if (tourRunIdRef.current !== runId) return;
          runTourStep(stepIdx + 1);
        }, delayMs);
        tourTimersRef.current.push(nextTimer);
      };

      const concept = CONCEPT_DETAILS[step.objectId];
      const latest = labStateRef.current;
      const shouldPlayVo = !latest.audioMuted && Boolean(concept);

      if (shouldPlayVo && concept) {
        const voStartDelay = step.initialSound ? 900 : 350;
        const voStartTimer = window.setTimeout(() => {
          if (tourRunIdRef.current !== runId) return;
          void voiceOverEngine.play(
            step.objectId,
            concept.voiceOverScript,
            concept.voiceOverAudioUrl,
            () => {
              if (tourRunIdRef.current !== runId) return;
              advanceNext(1100);
            }
          );
        }, voStartDelay);
        tourTimersRef.current.push(voStartTimer);

        // Safety fallback ceiling in case audio playback is blocked or stalls
        const safetyTimer = window.setTimeout(() => {
          advanceNext(0);
        }, Math.max(step.fallbackDurationMs + 14000, 25000));
        tourTimersRef.current.push(safetyTimer);
      } else {
        const visualTimer = window.setTimeout(() => {
          advanceNext(0);
        }, step.fallbackDurationMs);
        tourTimersRef.current.push(visualTimer);
      }
    },
    [clearPendingVoiceOver, clearTourTimers, stopTour]
  );

  const handleToggleTour = useCallback(() => {
    if (tourActive) {
      stopTour(false);
    } else {
      // Collapse panel so students have a full unobstructed view (blinking round icon stays ready below)
      setDockCollapsed(true);
      setQuizOpen(false);
      setVoModalOpen(false);
      runTourStep(0);
    }
  }, [runTourStep, stopTour, tourActive]);

  const scheduleVoiceOverForObject = useCallback(
    (id: InteractiveObjectId | null) => {
      clearPendingVoiceOver();
      if (!id) {
        voiceOverEngine.stop();
        return;
      }

      const { voiceOverEnabled, audioMuted } = labStateRef.current;
      if (!voiceOverEnabled || audioMuted) return;

      const concept = CONCEPT_DETAILS[id];
      if (!concept) return;

      // Let sound instruments (gendang, garpu tala, bel) ring briefly before narration begins
      if (SOUND_INSTRUMENT_IDS.has(id)) {
        voiceOverEngine.stop();
        voTimerRef.current = window.setTimeout(() => {
          voTimerRef.current = null;
          const latest = labStateRef.current;
          if (!latest.audioMuted && latest.voiceOverEnabled && latest.selectedObject === id) {
            void voiceOverEngine.play(id, concept.voiceOverScript, concept.voiceOverAudioUrl);
          }
        }, 850);
      } else {
        void voiceOverEngine.play(id, concept.voiceOverScript, concept.voiceOverAudioUrl);
      }
    },
    [clearPendingVoiceOver]
  );

  // Load saved uploaded voice-over tracks and subscribe to playback state
  useEffect(() => {
    const unsubscribe = voiceOverEngine.subscribe(setVoPlayback);
    void voiceOverEngine.loadMetadata().then((meta) => {
      setVoTracks(meta);
    });
    return () => {
      unsubscribe();
      tourRunIdRef.current += 1;
      clearTourTimers();
      clearPendingVoiceOver();
      voiceOverEngine.stop();
    };
  }, [clearPendingVoiceOver, clearTourTimers]);

  // Stop narration whenever audio is muted or Voice-Over guidance is turned off
  useEffect(() => {
    if (labState.audioMuted || !labState.voiceOverEnabled) {
      clearPendingVoiceOver();
      voiceOverEngine.stop();
    }
  }, [labState.audioMuted, labState.voiceOverEnabled, clearPendingVoiceOver]);

  // Stable handlers for scene pointer callbacks
  const handleToggleFlashlight = useCallback(() => {
    setLabState((prev) => ({ ...prev, flashlightOn: !prev.flashlightOn }));
  }, []);

  const handleCycleMaterialSlab = useCallback(() => {
    setLabState((prev) => {
      const order: MaterialSlabType[] = ['bening', 'buram', 'gelap'];
      const next = order[(order.indexOf(prev.materialSlab) + 1) % order.length];
      return { ...prev, materialSlab: next };
    });
  }, []);

  const handleToggleAcousticWall = useCallback(() => {
    setLabState((prev) => ({
      ...prev,
      acousticWall: prev.acousticWall === 'pantul' ? 'serap' : 'pantul',
    }));
  }, []);

  const handleSelectObject = useCallback(
    (id: InteractiveObjectId | null) => {
      stopTour(false);
      setLabState((prev) => {
        const nextTab: LabTab =
          id === 'garpu_tala' || id === 'gendang' || id === 'bel_vakum' || id === 'dinding_akustik'
            ? 'bunyi'
            : id
              ? 'cahaya'
              : prev.activeTab;
        return { ...prev, selectedObject: id, activeTab: nextTab };
      });
      scheduleVoiceOverForObject(id);
    },
    [scheduleVoiceOverForObject, stopTour]
  );

  // Mount Three.js WebGL scene once inside isolated ref container
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    let manager: LabSceneManager | null = null;
    try {
      manager = new LabSceneManager(container, INITIAL_STATE, {
        onSelectObject: handleSelectObject,
        onToggleFlashlight: handleToggleFlashlight,
        onCycleMaterialSlab: handleCycleMaterialSlab,
        onToggleAcousticWall: handleToggleAcousticWall,
        onDragStatusChange: setDraggingId,
        onWebGLUnavailable: () => setWebglError(true),
      });
      sceneRef.current = manager;
    } catch {
      setWebglError(true);
    }

    return () => {
      manager?.dispose();
      sceneRef.current = null;
    };
  }, [handleCycleMaterialSlab, handleSelectObject, handleToggleAcousticWall, handleToggleFlashlight]);

  // Sync React state updates into Three.js without re-creating the canvas
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.updateState(labState, prevExperimentRef.current, prevPerfModeRef.current);
    prevExperimentRef.current = labState.lightExperiment;
    prevPerfModeRef.current = labState.performanceMode;
  }, [labState]);

  // Keyboard shortcuts: H (toggle HUD), + / - (zoom), R (reset camera)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((c) => !c);
      } else if (e.key === '+' || e.key === '=') {
        sceneRef.current?.zoomStep('in');
      } else if (e.key === '-' || e.key === '_') {
        sceneRef.current?.zoomStep('out');
      } else if (e.key === 'r' || e.key === 'R') {
        sceneRef.current?.setCameraPreset('overview');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleTabChange = (tab: LabTab) => {
    if (tourActive) stopTour(false);
    setLabState((prev) => ({ ...prev, activeTab: tab }));
    sceneRef.current?.setCameraPreset(tab);
  };

  const handleSelectExperiment = (exp: LightExperiment) => {
    if (tourActive) stopTour(false);
    const focusObj = LIGHT_EXPERIMENT_INFO[exp].focusObject;
    setLabState((prev) => ({
      ...prev,
      activeTab: 'cahaya',
      flashlightOn: true,
      lightExperiment: exp,
      selectedObject: focusObj,
    }));
    sceneRef.current?.setCameraPreset('cahaya');
    scheduleVoiceOverForObject(focusObj);
  };

  const handleTriggerSound = (id: 'garpu_tala' | 'gendang' | 'bel_vakum') => {
    if (tourActive) stopTour(false);
    setLabState((prev) => ({ ...prev, activeTab: 'bunyi', selectedObject: id }));
    sceneRef.current?.triggerSoundInstrument(id);
    scheduleVoiceOverForObject(id);
  };

  const handleConceptAction = (id: InteractiveObjectId) => {
    if (id === 'senter') {
      handleToggleFlashlight();
    } else if (id === 'cermin') {
      setLabState((prev) => {
        const nextAngle = prev.mirrorAngle >= 45 ? -45 : prev.mirrorAngle + 15;
        return { ...prev, mirrorAngle: nextAngle };
      });
    } else if (id === 'benda_uji') {
      handleCycleMaterialSlab();
    } else if (id === 'garpu_tala' || id === 'gendang' || id === 'bel_vakum') {
      sceneRef.current?.triggerSoundInstrument(id);
    } else if (id === 'dinding_akustik') {
      handleToggleAcousticWall();
    }
  };

  const handleToggleVoiceOverPlayback = (id: InteractiveObjectId) => {
    clearPendingVoiceOver();
    if (voPlayback.playingId === id) {
      voiceOverEngine.stop();
      return;
    }
    if (labState.audioMuted) {
      setLabState((prev) => ({ ...prev, audioMuted: false }));
    }
    const concept = CONCEPT_DETAILS[id];
    if (!concept) return;
    void voiceOverEngine.play(id, concept.voiceOverScript, concept.voiceOverAudioUrl);
  };

  const handleUploadVoiceOver = async (id: InteractiveObjectId, file: File) => {
    const meta = await voiceOverEngine.uploadAudio(id, file);
    setVoTracks((prev) => ({ ...prev, [id]: meta }));
  };

  const handleRemoveVoiceOver = async (id: InteractiveObjectId) => {
    await voiceOverEngine.removeAudio(id);
    setVoTracks((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleCameraPreset = (preset: CameraPreset) => {
    sceneRef.current?.setCameraPreset(preset);
  };

  const handleCloseConceptCard = () => {
    if (tourActive) {
      stopTour(false);
    } else {
      clearPendingVoiceOver();
      voiceOverEngine.stop();
    }
    setLabState((prev) => ({ ...prev, selectedObject: null }));
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0f172a]">
      {/* Isolated WebGL 3D Viewport Container */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 h-full w-full"
        aria-label="Kanvas Laboratorium 3D Cahaya dan Bunyi"
      />

      {/* Graceful WebGL Fallback */}
      {webglError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0f172a] p-6">
          <div className="max-w-md rounded-xl border border-slate-700 bg-[#142034] p-6 text-center space-y-3">
            <h1 className="text-lg font-bold text-white">Tampilan 3D WebGL Tidak Tersedia</h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Perangkat atau peramban Anda saat ini menonaktifkan akselerasi WebGL. Aktifkan WebGL pada pengaturan peramban lalu muat ulang halaman.
            </p>
          </div>
        </div>
      )}

      {/* Top Minimal Header Bar (Unobtrusive, Zero Viewport Occlusion) */}
      <header className="fixed top-2 left-2.5 right-2.5 sm:top-3 sm:left-4 sm:right-4 z-20 flex items-center sm:items-start justify-between gap-2 sm:gap-4 pointer-events-none">
        {/* Left: Clean Brand Title & Unboxed Curriculum Metadata */}
        <div className="pointer-events-auto rounded-xl border border-slate-700/80 bg-[#0f172a]/92 px-2.5 py-1.5 sm:px-3.5 sm:py-2 shadow-lg min-w-0">
          <h1 className="text-xs sm:text-base font-bold tracking-tight text-slate-50 whitespace-nowrap truncate">
            <span className="sm:hidden">Lab 3D IPAS</span>
            <span className="hidden sm:inline">Lab 3D Cahaya &amp; Bunyi</span>
          </h1>
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 whitespace-nowrap">
            <span>IPAS Kelas 5 SD</span>
            <span aria-hidden="true">·</span>
            <span>Kurikulum Merdeka</span>
          </div>
        </div>

        {/* Center Live Drag Indicator (Only visible while actively dragging a 3D object) */}
        {draggingId && (
          <div className="hidden lg:flex items-center gap-2 rounded-lg border border-amber-400/60 bg-[#0f172a]/95 px-3 py-1.5 text-xs font-medium text-amber-200 shadow-lg">
            <Hand className="h-3.5 w-3.5 text-amber-400" />
            <span>Menggeser {CONCEPT_DETAILS[draggingId].title}</span>
          </div>
        )}

        {/* Right: Compact Zoom, Voice-Over, Mode, Audio & Mini Quiz Utilities */}
        <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 shrink-0">
          <div className="hidden sm:inline-flex items-center rounded-xl border border-slate-700/80 bg-[#0f172a]/92 p-1 shadow-lg">
            <button
              type="button"
              onClick={() => sceneRef.current?.zoomStep('in')}
              aria-label="Perbesar tampilan (Zoom In)"
              title="Zoom In (+)"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-200 hover:bg-[#1a2944] hover:text-white transition-colors"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => sceneRef.current?.zoomStep('out')}
              aria-label="Perkecil tampilan (Zoom Out)"
              title="Zoom Out (-)"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-200 hover:bg-[#1a2944] hover:text-white transition-colors"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handleCameraPreset('overview')}
              aria-label="Reset posisi kamera"
              title="Reset Kamera (R)"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-200 hover:bg-[#1a2944] hover:text-white transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleToggleTour}
            aria-label={
              tourActive
                ? 'Hentikan animasi penjelasan cahaya dan bunyi'
                : 'Putar animasi penjelasan cahaya dan bunyi'
            }
            title={
              tourActive
                ? 'Hentikan Animasi Penjelasan'
                : 'Putar Animasi Penjelasan Cahaya & Bunyi'
            }
            className={`inline-flex h-9 w-9 sm:h-11 sm:w-auto items-center justify-center gap-1.5 rounded-xl border sm:px-3 text-xs font-bold shadow-lg transition-colors whitespace-nowrap shrink-0 ${
              tourActive
                ? 'border-rose-400/80 bg-rose-500 text-white hover:bg-rose-400'
                : 'border-emerald-400/70 bg-emerald-500 text-slate-950 hover:bg-emerald-400'
            }`}
          >
            {tourActive ? (
              <Square className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
            <span className="hidden sm:inline">
              {tourActive ? 'Hentikan' : 'Putar Animasi'}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setLabState((prev) => ({ ...prev, voiceOverEnabled: !prev.voiceOverEnabled }))
            }
            aria-label={
              labState.voiceOverEnabled
                ? 'Matikan panduan suara otomatis'
                : 'Aktifkan panduan suara otomatis'
            }
            title={
              labState.voiceOverEnabled
                ? 'Panduan Suara Otomatis Aktif (klik untuk mematikan)'
                : 'Panduan Suara Otomatis Mati (klik untuk mengaktifkan)'
            }
            className={`inline-flex h-9 w-9 sm:h-11 sm:w-auto items-center justify-center gap-1.5 rounded-xl border sm:px-3 text-xs font-semibold shadow-lg transition-colors whitespace-nowrap shrink-0 ${
              labState.voiceOverEnabled && !labState.audioMuted
                ? 'border-sky-500/60 bg-[#0f172a]/92 text-sky-300 hover:bg-[#162840]'
                : 'border-slate-700/80 bg-[#0f172a]/92 text-slate-400 hover:bg-[#1a2944] hover:text-slate-200'
            }`}
          >
            <Headphones className="h-4 w-4" />
            <span className="hidden lg:inline">
              {labState.voiceOverEnabled ? 'Panduan Aktif' : 'Panduan Mati'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setVoModalOpen(true)}
            aria-label="Kelola Naskah dan Upload Voice-Over"
            title="Lihat Naskah & Upload Rekaman Voice-Over"
            className="inline-flex h-9 w-9 sm:h-11 sm:w-auto items-center justify-center gap-1.5 rounded-xl border border-slate-700/80 bg-[#0f172a]/92 sm:px-3 text-xs font-semibold text-slate-200 hover:bg-[#1a2944] hover:text-white shadow-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Mic className="h-4 w-4 text-amber-300" />
            <span className="hidden lg:inline">Naskah VO</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setLabState((prev) => ({
                ...prev,
                performanceMode: prev.performanceMode === 'ringan' ? 'detail' : 'ringan',
              }))
            }
            title={
              labState.performanceMode === 'ringan'
                ? 'Mode Ringan aktif (hemat daya & lancar di HP/PID). Klik untuk Mode Detail.'
                : 'Mode Detail aktif (resolusi & bayangan penuh). Klik untuk Mode Ringan.'
            }
            className={`inline-flex h-9 w-9 sm:h-11 sm:w-auto items-center justify-center gap-1.5 rounded-xl border sm:px-3 text-xs font-semibold shadow-lg transition-colors whitespace-nowrap shrink-0 ${
              labState.performanceMode === 'ringan'
                ? 'border-emerald-500/60 bg-[#0f172a]/92 text-emerald-300 hover:bg-[#162840]'
                : 'border-slate-700/80 bg-[#0f172a]/92 text-slate-200 hover:bg-[#1a2944]'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            <span className="hidden md:inline">
              {labState.performanceMode === 'ringan' ? 'Ringan' : 'Detail'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setLabState((prev) => ({ ...prev, audioMuted: !prev.audioMuted }))}
            aria-label={labState.audioMuted ? 'Nyalakan suara' : 'Bisukan suara'}
            title={labState.audioMuted ? 'Nyalakan Suara' : 'Bisukan Suara'}
            className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl border border-slate-700/80 bg-[#0f172a]/92 text-slate-200 hover:bg-[#1a2944] hover:text-white shadow-lg transition-colors shrink-0"
          >
            {labState.audioMuted ? (
              <VolumeX className="h-4 w-4 text-rose-400" />
            ) : (
              <Volume2 className="h-4 w-4 text-sky-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setQuizOpen(true)}
            className="inline-flex h-9 sm:h-11 items-center justify-center gap-1.5 rounded-xl border border-amber-500/70 bg-amber-500 px-2.5 sm:px-3.5 text-xs font-bold text-slate-950 hover:bg-amber-400 shadow-lg transition-colors whitespace-nowrap shrink-0"
          >
            <BookOpenCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Uji Paham</span>
          </button>
        </div>
      </header>

      {/* Subtle Gesture Tip (Only when no concept card is open and dock is visible) */}
      {!labState.selectedObject && !dockCollapsed && (
        <div className="fixed left-4 top-[74px] z-10 pointer-events-none hidden sm:block">
          <p className="rounded-lg border border-slate-800 bg-[#0f172a]/88 px-3 py-1.5 text-[11px] text-slate-300">
            Sentuh alat untuk mencoba &amp; mendengar penjelasan · Seret alat cahaya ke sinar · Cubit/gulir untuk zoom
          </p>
        </div>
      )}

      {/* Contextual Dismissible Concept Explanation Card */}
      <ConceptCard
        selectedObject={labState.selectedObject}
        soundMedium={labState.soundMedium}
        isPlayingVoiceOver={
          labState.selectedObject !== null && voPlayback.playingId === labState.selectedObject
        }
        hasCustomVoiceOver={
          labState.selectedObject !== null && Boolean(voTracks[labState.selectedObject])
        }
        audioMuted={labState.audioMuted}
        onClose={handleCloseConceptCard}
        onTriggerAction={handleConceptAction}
        onToggleVoiceOverPlayback={handleToggleVoiceOverPlayback}
        onOpenVoiceOverManager={() => setVoModalOpen(true)}
      />

      {/* Compact Guided Animation Progress Bar (Visible while Animation Tour is running) */}
      {tourActive && (() => {
        const currentStep = ANIMATION_TOUR_STEPS[tourStepIndex];
        if (!currentStep) return null;
        const pct = Math.round(((tourStepIndex + 1) / ANIMATION_TOUR_STEPS.length) * 100);
        const isLight = currentStep.topic === 'cahaya';
        return (
          <div
            className={`fixed left-1/2 -translate-x-1/2 z-20 w-[min(560px,92vw)] transition-all duration-200 ${
              dockCollapsed ? 'bottom-[64px] sm:bottom-[72px]' : 'bottom-[38vh] sm:bottom-[308px]'
            }`}
            aria-live="polite"
          >
            <div className="overflow-hidden rounded-xl border border-slate-700/90 bg-[#0f172a]/94 shadow-2xl">
              {/* Thin Progress Bar */}
              <div className="h-1 w-full bg-slate-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    isLight ? 'bg-amber-400' : 'bg-sky-400'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold">
                    <span
                      className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                        isLight ? 'bg-amber-400' : 'bg-sky-400'
                      }`}
                    />
                    <span className={isLight ? 'text-amber-300' : 'text-sky-300'}>
                      {isLight ? 'Animasi Cahaya' : 'Animasi Bunyi'}
                    </span>
                    <span className="text-slate-500">·</span>
                    <span className="font-mono-num text-slate-400">
                      {tourStepIndex + 1}/{ANIMATION_TOUR_STEPS.length}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-white truncate">
                    {currentStep.title}
                  </p>
                  <p className="hidden sm:block text-[11px] text-slate-300 truncate">
                    {currentStep.subtitle}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => runTourStep(Math.max(0, tourStepIndex - 1))}
                    disabled={tourStepIndex === 0}
                    aria-label="Langkah sebelumnya"
                    title="Sebelumnya"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-[#162238] text-slate-200 hover:bg-[#1f304d] disabled:opacity-35 transition-colors"
                  >
                    <SkipBack className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => runTourStep(tourStepIndex + 1)}
                    aria-label="Langkah berikutnya"
                    title={
                      tourStepIndex < ANIMATION_TOUR_STEPS.length - 1
                        ? 'Berikutnya'
                        : 'Selesaikan Animasi'
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-[#162238] text-slate-200 hover:bg-[#1f304d] transition-colors"
                  >
                    <SkipForward className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => stopTour(false)}
                    aria-label="Hentikan animasi"
                    title="Hentikan Animasi"
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/90 text-white hover:bg-rose-400 transition-colors"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Unified Collapsible Bottom Control Dock */}
      <ControlDock
        state={labState}
        collapsed={dockCollapsed}
        onToggleCollapse={() => setDockCollapsed((c) => !c)}
        onTabChange={handleTabChange}
        onSelectExperiment={handleSelectExperiment}
        onToggleFlashlight={handleToggleFlashlight}
        onBrightnessChange={(val) =>
          setLabState((prev) => ({ ...prev, lightBrightness: val, flashlightOn: true }))
        }
        onMirrorAngleChange={(deg) => setLabState((prev) => ({ ...prev, mirrorAngle: deg }))}
        onMaterialSlabChange={(type) =>
          setLabState((prev) => ({ ...prev, materialSlab: type, lightExperiment: 'bening' }))
        }
        onTriggerSound={handleTriggerSound}
        onMediumChange={(m: SoundMedium) =>
          setLabState((prev) => ({ ...prev, soundMedium: m }))
        }
        onFrequencyChange={(hz) => setLabState((prev) => ({ ...prev, soundFrequency: hz }))}
        onAmplitudeChange={(pct) => setLabState((prev) => ({ ...prev, soundAmplitude: pct }))}
        onAcousticWallChange={(wall: AcousticWallType) =>
          setLabState((prev) => ({ ...prev, acousticWall: wall }))
        }
        onCameraPreset={handleCameraPreset}
      />

      {/* On-Demand Voice-Over Script & Audio Upload Modal */}
      <VoiceOverModal
        open={voModalOpen}
        onClose={() => setVoModalOpen(false)}
        playback={voPlayback}
        tracks={voTracks}
        onPlayOrStop={handleToggleVoiceOverPlayback}
        onUploadAudio={handleUploadVoiceOver}
        onRemoveAudio={handleRemoveVoiceOver}
      />

      {/* On-Demand Mini Quiz Modal */}
      <QuizModal open={quizOpen} onClose={() => setQuizOpen(false)} />
    </div>
  );
}
