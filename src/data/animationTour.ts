import type {
  AcousticWallType,
  CameraPreset,
  InteractiveObjectId,
  LabState,
  LightExperiment,
  MaterialSlabType,
  SoundMedium,
} from '../types/lab';

export interface TourMicroEvent {
  /** Delay in milliseconds from step start */
  delayMs: number;
  /** Partial LabState update to animate live in 3D */
  patch?: Partial<LabState>;
  /** Optional sound instrument to strike/ring at this moment */
  triggerSound?: 'garpu_tala' | 'gendang' | 'bel_vakum';
  /** Optional camera preset transition */
  camera?: CameraPreset;
}

export interface AnimationTourStep {
  id: string;
  topic: 'cahaya' | 'bunyi';
  title: string;
  subtitle: string;
  objectId: InteractiveObjectId;
  camera: CameraPreset;
  /** Initial state applied when entering this chapter */
  initialPatch: {
    activeTab: 'cahaya' | 'bunyi';
    flashlightOn?: boolean;
    lightBrightness?: number;
    lightExperiment?: LightExperiment;
    mirrorAngle?: number;
    materialSlab?: MaterialSlabType;
    soundMedium?: SoundMedium;
    soundFrequency?: number;
    soundAmplitude?: number;
    acousticWall?: AcousticWallType;
  };
  /** Optional sound triggered right as the step begins */
  initialSound?: 'garpu_tala' | 'gendang' | 'bel_vakum';
  /** Live 3D choreography while the voice-over explains the concept */
  microEvents?: TourMicroEvent[];
  /** Fallback duration in ms when audio is muted or voice-over unavailable */
  fallbackDurationMs: number;
}

export const ANIMATION_TOUR_STEPS: AnimationTourStep[] = [
  {
    id: 'cahaya-lurus',
    topic: 'cahaya',
    title: 'Cahaya Merambat Lurus',
    subtitle: 'Senter optik memancarkan berkas sinar lurus menuju layar',
    objectId: 'senter',
    camera: 'cahaya',
    initialPatch: {
      activeTab: 'cahaya',
      flashlightOn: true,
      lightExperiment: 'lurus',
      lightBrightness: 62,
    },
    microEvents: [
      { delayMs: 2600, patch: { lightBrightness: 100 } },
      { delayMs: 5200, patch: { lightBrightness: 45 } },
      { delayMs: 7400, patch: { lightBrightness: 92 } },
    ],
    fallbackDurationMs: 9500,
  },
  {
    id: 'cahaya-pantul',
    topic: 'cahaya',
    title: 'Cahaya Dapat Dipantulkan',
    subtitle: 'Cermin datar memantulkan sinar dengan sudut datang = sudut pantul',
    objectId: 'cermin',
    camera: 'cahaya',
    initialPatch: {
      activeTab: 'cahaya',
      flashlightOn: true,
      lightBrightness: 92,
      lightExperiment: 'pantul',
      mirrorAngle: -20,
    },
    microEvents: [
      { delayMs: 2400, patch: { mirrorAngle: 15 } },
      { delayMs: 5000, patch: { mirrorAngle: 35 } },
      { delayMs: 7600, patch: { mirrorAngle: 20 } },
    ],
    fallbackDurationMs: 10500,
  },
  {
    id: 'cahaya-bening',
    topic: 'cahaya',
    title: 'Menembus Benda Bening, Buram & Gelap',
    subtitle: 'Bandingkan kaca bening, kaca buram, dan papan kayu gelap',
    objectId: 'benda_uji',
    camera: 'cahaya',
    initialPatch: {
      activeTab: 'cahaya',
      flashlightOn: true,
      lightBrightness: 92,
      lightExperiment: 'bening',
      materialSlab: 'bening',
    },
    microEvents: [
      { delayMs: 3400, patch: { materialSlab: 'buram' } },
      { delayMs: 6800, patch: { materialSlab: 'gelap' } },
    ],
    fallbackDurationMs: 11000,
  },
  {
    id: 'cahaya-bias',
    topic: 'cahaya',
    title: 'Cahaya Dapat Dibiaskan',
    subtitle: 'Sinar membelok dari udara ke air sehingga pensil tampak patah',
    objectId: 'gelas',
    camera: 'cahaya',
    initialPatch: {
      activeTab: 'cahaya',
      flashlightOn: true,
      lightBrightness: 90,
      lightExperiment: 'bias',
    },
    microEvents: [{ delayMs: 3200, camera: 'fokus_alat' }],
    fallbackDurationMs: 10000,
  },
  {
    id: 'cahaya-dispersi',
    topic: 'cahaya',
    title: 'Cahaya Putih Diuraikan (Pelangi)',
    subtitle: 'Prisma kaca menguraikan sinar putih menjadi 7 warna Mejikuhibiniu',
    objectId: 'prisma',
    camera: 'cahaya',
    initialPatch: {
      activeTab: 'cahaya',
      flashlightOn: true,
      lightBrightness: 96,
      lightExperiment: 'dispersi',
    },
    fallbackDurationMs: 10500,
  },
  {
    id: 'bunyi-garpu-tala',
    topic: 'bunyi',
    title: 'Sumber & Tinggi Rendah Nada Bunyi',
    subtitle: 'Getaran garpu tala menghasilkan nada sesuai frekuensinya (Hz)',
    objectId: 'garpu_tala',
    camera: 'bunyi',
    initialPatch: {
      activeTab: 'bunyi',
      soundMedium: 'udara',
      soundFrequency: 360,
      soundAmplitude: 80,
      acousticWall: 'serap',
    },
    initialSound: 'garpu_tala',
    microEvents: [
      { delayMs: 4200, patch: { soundFrequency: 720 }, triggerSound: 'garpu_tala' },
    ],
    fallbackDurationMs: 11000,
  },
  {
    id: 'bunyi-gendang',
    topic: 'bunyi',
    title: 'Amplitudo & Kuat Lemah Bunyi',
    subtitle: 'Tabuhan kuat membuat membran bergetar hebat dan beras melompat tinggi',
    objectId: 'gendang',
    camera: 'bunyi',
    initialPatch: {
      activeTab: 'bunyi',
      soundMedium: 'udara',
      soundAmplitude: 95,
      acousticWall: 'serap',
    },
    initialSound: 'gendang',
    microEvents: [
      { delayMs: 4200, patch: { soundAmplitude: 95 }, triggerSound: 'gendang' },
    ],
    fallbackDurationMs: 11000,
  },
  {
    id: 'bunyi-vakum',
    topic: 'bunyi',
    title: 'Bunyi Memerlukan Medium Perambatan',
    subtitle: 'Terdengar di udara, namun senyap saat udara dipompa ke ruang hampa',
    objectId: 'bel_vakum',
    camera: 'bunyi',
    initialPatch: {
      activeTab: 'bunyi',
      soundMedium: 'udara',
      soundAmplitude: 85,
      acousticWall: 'serap',
    },
    initialSound: 'bel_vakum',
    microEvents: [
      { delayMs: 4800, patch: { soundMedium: 'vakum' }, triggerSound: 'bel_vakum' },
    ],
    fallbackDurationMs: 11500,
  },
  {
    id: 'bunyi-pantul-serap',
    topic: 'bunyi',
    title: 'Pemantulan (Gema) & Penyerapan Bunyi',
    subtitle: 'Dinding beton memantulkan gelombang emas bergema, busa meredamnya',
    objectId: 'dinding_akustik',
    camera: 'bunyi',
    initialPatch: {
      activeTab: 'bunyi',
      soundMedium: 'udara',
      soundAmplitude: 90,
      acousticWall: 'pantul',
    },
    initialSound: 'gendang',
    microEvents: [
      { delayMs: 2600, triggerSound: 'garpu_tala' },
      { delayMs: 6500, patch: { acousticWall: 'serap' }, triggerSound: 'gendang' },
    ],
    fallbackDurationMs: 12000,
  },
];
