import {
  Bell,
  ChevronDown,
  ChevronUp,
  Drum,
  Eye,
  Lightbulb,
  Music2,
  Sun,
  Volume2,
} from 'lucide-react';
import {
  LIGHT_EXPERIMENT_INFO,
  MEDIUM_INFO,
  type AcousticWallType,
  type CameraPreset,
  type LabState,
  type LabTab,
  type LightExperiment,
  type MaterialSlabType,
  type SoundMedium,
} from '../types/lab';

interface ControlDockProps {
  state: LabState;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onTabChange: (tab: LabTab) => void;
  onSelectExperiment: (exp: LightExperiment) => void;
  onToggleFlashlight: () => void;
  onBrightnessChange: (val: number) => void;
  onMirrorAngleChange: (deg: number) => void;
  onMaterialSlabChange: (type: MaterialSlabType) => void;
  onTriggerSound: (id: 'garpu_tala' | 'gendang' | 'bel_vakum') => void;
  onMediumChange: (medium: SoundMedium) => void;
  onFrequencyChange: (hz: number) => void;
  onAmplitudeChange: (pct: number) => void;
  onAcousticWallChange: (wall: AcousticWallType) => void;
  onCameraPreset: (preset: CameraPreset) => void;
}

const EXPERIMENTS: LightExperiment[] = ['lurus', 'pantul', 'bening', 'bias', 'dispersi'];
const MEDIUMS: SoundMedium[] = ['udara', 'air', 'padat', 'vakum'];
const SLABS: { id: MaterialSlabType; label: string }[] = [
  { id: 'bening', label: 'Bening' },
  { id: 'buram', label: 'Buram' },
  { id: 'gelap', label: 'Gelap' },
];

export function ControlDock({
  state,
  collapsed,
  onToggleCollapse,
  onTabChange,
  onSelectExperiment,
  onToggleFlashlight,
  onBrightnessChange,
  onMirrorAngleChange,
  onMaterialSlabChange,
  onTriggerSound,
  onMediumChange,
  onFrequencyChange,
  onAmplitudeChange,
  onAcousticWallChange,
  onCameraPreset,
}: ControlDockProps) {
  return (
    <div
      className="fixed bottom-4 left-1/2 z-20 w-[min(940px,95vw)] -translate-x-1/2 pointer-events-none flex flex-col items-center"
      aria-label="Panel Kontrol Eksperimen 3D"
    >
      {/* Collapsible Drawer Handle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="pointer-events-auto mb-1.5 inline-flex items-center gap-1.5 rounded-t-lg border border-b-0 border-slate-700/90 bg-[#111b2e] px-3.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-[#1a2944] hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-amber-400"
        title="Tekan tombol H untuk menyembunyikan atau menampilkan panel"
      >
        {collapsed ? (
          <>
            <ChevronUp className="h-3.5 w-3.5 text-amber-400" />
            <span>Tampilkan Kontrol</span>
          </>
        ) : (
          <>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            <span>Sembunyikan Kontrol</span>
          </>
        )}
      </button>

      {/* Collapsible Dock Container */}
      <div
        className={`pointer-events-auto w-full rounded-xl border border-slate-700/90 bg-[#0f172a]/95 shadow-2xl transition-all duration-200 ease-out overflow-hidden ${
          collapsed ? 'max-h-0 border-transparent opacity-0 pointer-events-none' : 'max-h-[340px] opacity-100'
        }`}
      >
        <div className="p-3.5 sm:p-4 space-y-3">
          {/* Top Row: Main Topic Tabs + Camera View Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div className="inline-flex items-center gap-1 rounded-lg bg-[#162238] p-1">
              <button
                type="button"
                onClick={() => onTabChange('cahaya')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  state.activeTab === 'cahaya'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Sun className="h-4 w-4" />
                <span>Cahaya &amp; Sifatnya</span>
              </button>
              <button
                type="button"
                onClick={() => onTabChange('bunyi')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  state.activeTab === 'bunyi'
                    ? 'bg-sky-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Volume2 className="h-4 w-4" />
                <span>Bunyi &amp; Sifatnya</span>
              </button>
            </div>

            {/* Camera Angle Presets */}
            <div className="inline-flex items-center gap-1 text-xs">
              <Eye className="h-3.5 w-3.5 text-slate-400 mr-1 hidden sm:block" />
              <button
                type="button"
                onClick={() => onCameraPreset('overview')}
                className="rounded-md bg-[#162238] px-2.5 py-1.5 font-medium text-slate-200 hover:bg-[#1f304d] hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                Semua Meja
              </button>
              <button
                type="button"
                onClick={() => onCameraPreset('cahaya')}
                className="rounded-md bg-[#162238] px-2.5 py-1.5 font-medium text-slate-200 hover:bg-[#1f304d] hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                Area Cahaya
              </button>
              <button
                type="button"
                onClick={() => onCameraPreset('bunyi')}
                className="rounded-md bg-[#162238] px-2.5 py-1.5 font-medium text-slate-200 hover:bg-[#1f304d] hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                Area Bunyi
              </button>
            </div>
          </div>

          {/* TAB A: CAHAYA */}
          {state.activeTab === 'cahaya' ? (
            <div className="space-y-3">
              {/* Experiment Preset Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                {EXPERIMENTS.map((exp) => {
                  const active = state.lightExperiment === exp;
                  return (
                    <button
                      key={exp}
                      type="button"
                      onClick={() => onSelectExperiment(exp)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                          : 'bg-[#142034] border-slate-700/80 text-slate-300 hover:border-slate-500 hover:text-white'
                      }`}
                    >
                      {LIGHT_EXPERIMENT_INFO[exp].label}
                    </button>
                  );
                })}
              </div>

              {/* Interactive Sliders & Flashlight / Material Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                {/* Flashlight Toggle */}
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={onToggleFlashlight}
                    className={`w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold border transition-colors whitespace-nowrap ${
                      state.flashlightOn
                        ? 'bg-amber-500 border-amber-400 text-slate-950 hover:bg-amber-400'
                        : 'bg-[#162238] border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    <Lightbulb className="h-3.5 w-3.5" />
                    <span>{state.flashlightOn ? 'Senter Nyala' : 'Senter Mati'}</span>
                  </button>
                </div>

                {/* Terang Cahaya Slider */}
                <div className="sm:col-span-4 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="brightness-slider" className="text-slate-300 font-medium">
                      Terang Cahaya
                    </label>
                    <span className="font-mono-num text-amber-300 font-semibold">
                      {state.flashlightOn ? `${state.lightBrightness}%` : '0%'}
                    </span>
                  </div>
                  <input
                    id="brightness-slider"
                    type="range"
                    min={10}
                    max={100}
                    step={1}
                    value={state.lightBrightness}
                    onChange={(e) => onBrightnessChange(Number(e.target.value))}
                    className="lab-slider w-full"
                  />
                </div>

                {/* Mirror Angle Slider */}
                <div className="sm:col-span-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="mirror-angle-slider" className="text-slate-300 font-medium">
                      Sudut Cermin
                    </label>
                    <span className="font-mono-num text-amber-300 font-semibold">
                      {state.mirrorAngle > 0 ? `+${state.mirrorAngle}°` : `${state.mirrorAngle}°`}
                    </span>
                  </div>
                  <input
                    id="mirror-angle-slider"
                    type="range"
                    min={-55}
                    max={55}
                    step={5}
                    value={state.mirrorAngle}
                    onChange={(e) => onMirrorAngleChange(Number(e.target.value))}
                    className="lab-slider w-full"
                  />
                </div>

                {/* Material Slab Switcher */}
                <div className="sm:col-span-3 space-y-1">
                  <div className="text-xs text-slate-300 font-medium">Bahan Benda Uji</div>
                  <div className="grid grid-cols-3 gap-1 rounded-lg bg-[#162238] p-0.5">
                    {SLABS.map((slab) => (
                      <button
                        key={slab.id}
                        type="button"
                        onClick={() => onMaterialSlabChange(slab.id)}
                        className={`rounded-md py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                          state.materialSlab === slab.id
                            ? 'bg-amber-500 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {slab.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* TAB B: BUNYI */
            <div className="space-y-3">
              {state.soundMedium === 'vakum' && (
                <div className="rounded-lg border border-rose-500/40 bg-rose-950/60 px-3 py-1.5 text-[11px] text-rose-200">
                  Mode Ruang Hampa (Vakum) aktif: bunyi tidak dapat merambat tanpa medium. Pilih Udara, Air, atau Padat untuk mendengarkan suara.
                </div>
              )}
              {/* Instrument Triggers & Acoustic Wall Switch */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => onTriggerSound('garpu_tala')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Music2 className="h-3.5 w-3.5" />
                    <span>Pukul Garpu Tala</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onTriggerSound('gendang')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#182742] border border-sky-500/40 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-[#1f3357] transition-colors whitespace-nowrap shrink-0"
                  >
                    <Drum className="h-3.5 w-3.5 text-sky-400" />
                    <span>Tabuh Gendang</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onTriggerSound('bel_vakum')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#182742] border border-sky-500/40 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-[#1f3357] transition-colors whitespace-nowrap shrink-0"
                  >
                    <Bell className="h-3.5 w-3.5 text-sky-400" />
                    <span>Bunyikan Bel</span>
                  </button>
                </div>

                {/* Acoustic Wall Mode Toggle */}
                <div className="inline-flex items-center gap-1 rounded-lg bg-[#162238] p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => onAcousticWallChange('pantul')}
                    className={`rounded-md px-2.5 py-1 font-semibold transition-colors whitespace-nowrap ${
                      state.acousticWall === 'pantul'
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Dinding Beton
                  </button>
                  <button
                    type="button"
                    onClick={() => onAcousticWallChange('serap')}
                    className={`rounded-md px-2.5 py-1 font-semibold transition-colors whitespace-nowrap ${
                      state.acousticWall === 'serap'
                        ? 'bg-sky-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Busa Peredam
                  </button>
                </div>
              </div>

              {state.soundMedium !== 'vakum' && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                  <span className="text-sky-300 font-medium">Gelombang Biru → Datang</span>
                  <span aria-hidden="true">·</span>
                  {state.acousticWall === 'pantul' ? (
                    <span className="text-amber-300 font-medium">
                      Gelombang Emas ← Pantul / Gema (Reverb Dinding Beton aktif)
                    </span>
                  ) : (
                    <span className="text-slate-300">
                      Busa Peredam aktif: gelombang diserap tanpa pantulan gema
                    </span>
                  )}
                </div>
              )}

              {/* Medium Selector + Frequency & Amplitude Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                {/* Medium Propagation Selector */}
                <div className="sm:col-span-6 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">Medium Perambatan</span>
                    <span className="font-mono-num text-sky-300 font-semibold">
                      {MEDIUM_INFO[state.soundMedium].speedLabel}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 rounded-lg bg-[#162238] p-0.5">
                    {MEDIUMS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => onMediumChange(m)}
                        className={`rounded-md py-1.5 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                          state.soundMedium === m
                            ? m === 'vakum'
                              ? 'bg-rose-500 text-white'
                              : 'bg-sky-500 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {m === 'udara'
                          ? 'Udara'
                          : m === 'air'
                            ? 'Air'
                            : m === 'padat'
                              ? 'Padat'
                              : 'Vakum'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Frequency / Pitch Slider */}
                <div className="sm:col-span-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="freq-slider" className="text-slate-300 font-medium">
                      Nada (Frekuensi)
                    </label>
                    <span className="font-mono-num text-sky-300 font-semibold">
                      {state.soundFrequency} Hz
                    </span>
                  </div>
                  <input
                    id="freq-slider"
                    type="range"
                    min={220}
                    max={880}
                    step={20}
                    value={state.soundFrequency}
                    onChange={(e) => onFrequencyChange(Number(e.target.value))}
                    className="lab-slider slider-cyan w-full"
                  />
                </div>

                {/* Amplitude / Loudness Slider */}
                <div className="sm:col-span-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="amp-slider" className="text-slate-300 font-medium">
                      Kuat Bunyi
                    </label>
                    <span className="font-mono-num text-sky-300 font-semibold">
                      {state.soundAmplitude}%
                    </span>
                  </div>
                  <input
                    id="amp-slider"
                    type="range"
                    min={20}
                    max={100}
                    step={5}
                    value={state.soundAmplitude}
                    onChange={(e) => onAmplitudeChange(Number(e.target.value))}
                    className="lab-slider slider-cyan w-full"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
