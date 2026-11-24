export type LabTab = 'cahaya' | 'bunyi';

export type LightExperiment =
  | 'lurus'
  | 'pantul'
  | 'bening'
  | 'bias'
  | 'dispersi';

export type MaterialSlabType = 'bening' | 'buram' | 'gelap';

export type SoundMedium = 'udara' | 'air' | 'padat' | 'vakum';

export type AcousticWallType = 'pantul' | 'serap';

export type InteractiveObjectId =
  | 'senter'
  | 'cermin'
  | 'prisma'
  | 'gelas'
  | 'benda_uji'
  | 'layar'
  | 'garpu_tala'
  | 'gendang'
  | 'bel_vakum'
  | 'dinding_akustik';

export type CameraPreset = 'overview' | 'cahaya' | 'bunyi' | 'fokus_alat';

export type PerformanceMode = 'ringan' | 'detail';

/** Automatically pick lightweight mode on mobile phones, tablets, touch PID boards, or low-core devices */
export function detectDefaultPerformanceMode(): PerformanceMode {
  if (typeof window === 'undefined') return 'ringan';
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = Math.min(window.innerWidth, window.innerHeight) < 820;
  const isHuge4KBoard = window.innerWidth >= 2200 || window.innerHeight >= 1400;
  const lowCores = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
  const highDpr = (window.devicePixelRatio || 1) >= 2.25;
  if (isTouch || isSmallScreen || isHuge4KBoard || lowCores || highDpr) {
    return 'ringan';
  }
  return 'ringan'; // Default to lightweight everywhere for instant responsiveness; users can opt into Detail anytime
}

export interface LabState {
  activeTab: LabTab;
  performanceMode: PerformanceMode;
  // Light properties (Topik A)
  flashlightOn: boolean;
  lightBrightness: number; // 0 - 100
  lightExperiment: LightExperiment;
  mirrorAngle: number; // -55 to 55 deg
  materialSlab: MaterialSlabType;
  // Sound properties (Topik B)
  soundMedium: SoundMedium;
  soundFrequency: number; // 220 - 880 Hz
  soundAmplitude: number; // 20 - 100 %
  acousticWall: AcousticWallType;
  audioMuted: boolean;
  voiceOverEnabled: boolean;
  // Selection
  selectedObject: InteractiveObjectId | null;
}

export const OBJECT_ORDER: InteractiveObjectId[] = [
  'senter',
  'cermin',
  'prisma',
  'gelas',
  'benda_uji',
  'layar',
  'garpu_tala',
  'gendang',
  'bel_vakum',
  'dinding_akustik',
];

export interface ConceptInfo {
  id: InteractiveObjectId;
  title: string;
  topicLabel: string;
  principle: string;
  summary: string;
  interactionHint: string;
  draggable: boolean;
  actionLabel?: string;
  voiceOverCode: string;
  voiceOverAudioUrl: string;
  voiceOverScript: string;
}

export const MEDIUM_INFO: Record<
  SoundMedium,
  { label: string; speedLabel: string; speedFactor: number; description: string }
> = {
  udara: {
    label: 'Udara (Gas)',
    speedLabel: '343 m/s',
    speedFactor: 1.0,
    description: 'Partikel udara berjauhan sehingga bunyi merambat dengan kecepatan sedang.',
  },
  air: {
    label: 'Air (Cair)',
    speedLabel: '1.480 m/s',
    speedFactor: 1.85,
    description: 'Partikel air lebih rapat dari udara sehingga bunyi merambat lebih cepat.',
  },
  padat: {
    label: 'Besi / Kayu (Padat)',
    speedLabel: '5.100 m/s',
    speedFactor: 2.8,
    description: 'Partikel zat padat sangat rapat sehingga rambatan getaran bunyi paling cepat.',
  },
  vakum: {
    label: 'Ruang Hampa',
    speedLabel: '0 m/s',
    speedFactor: 0,
    description: 'Tidak ada partikel penghantar di ruang hampa, sehingga bunyi tidak dapat terdengar.',
  },
};

export const LIGHT_EXPERIMENT_INFO: Record<
  LightExperiment,
  {
    label: string;
    shortTitle: string;
    focusObject: InteractiveObjectId;
  }
> = {
  lurus: {
    label: 'Merambat Lurus',
    shortTitle: 'Cahaya Merambat Lurus',
    focusObject: 'senter',
  },
  pantul: {
    label: 'Dipantulkan',
    shortTitle: 'Cahaya Dapat Dipantulkan',
    focusObject: 'cermin',
  },
  bening: {
    label: 'Menembus Bening',
    shortTitle: 'Menembus Benda Bening',
    focusObject: 'benda_uji',
  },
  bias: {
    label: 'Dibiaskan',
    shortTitle: 'Cahaya Dapat Dibiaskan',
    focusObject: 'gelas',
  },
  dispersi: {
    label: 'Diuraikan (Pelangi)',
    shortTitle: 'Cahaya Dapat Diuraikan',
    focusObject: 'prisma',
  },
};

export const CONCEPT_DETAILS: Record<InteractiveObjectId, ConceptInfo> = {
  senter: {
    id: 'senter',
    title: 'Senter Optik Laboratorium',
    topicLabel: 'Topik A · Sifat Cahaya',
    principle: 'Cahaya Merambat Lurus & Terang Cahaya',
    summary:
      'Cahaya dari senter selalu merambat dalam garis lurus. Semakin besar intensitas (terang cahaya), berkas sinar makin kuat dan bayangan benda gelap terlihat makin tegas.',
    interactionHint: 'Sentuh untuk menyalakan/mematikan, atau seret untuk menggeser posisi sinar.',
    draggable: true,
    actionLabel: 'Sakelar Senter',
    voiceOverCode: 'VO_01_SENTER',
    voiceOverAudioUrl: '/assets/aistudio/vo_01_senter_64c4bb04.wav',
    voiceOverScript:
      'Ini adalah senter optik laboratorium. Sifat pertama cahaya adalah selalu merambat dalam garis lurus. Coba geser pengatur terang cahaya di panel bawah, lalu amati bagaimana sinar menjadi semakin kuat dan jelas saat intensitasnya dinaikkan.',
  },
  cermin: {
    id: 'cermin',
    title: 'Cermin Datar Optik',
    topicLabel: 'Topik A · Pemantulan Cahaya',
    principle: 'Cahaya Dapat Dipantulkan',
    summary:
      'Saat sinar mengenai permukaan cermin yang rata dan mengilap, cahaya dipantulkan teratur dengan sudut pantul sama besar dengan sudut datangnya.',
    interactionHint: 'Seret cermin masuk ke berkas cahaya, lalu atur sudut kemiringannya di panel bawah.',
    draggable: true,
    actionLabel: 'Putar Cermin +15°',
    voiceOverCode: 'VO_02_CERMIN',
    voiceOverAudioUrl: '/assets/aistudio/vo_02_cermin_0deec3a4.wav',
    voiceOverScript:
      'Kamu sedang memilih cermin datar optik. Ketika cahaya mengenai permukaan yang rata dan mengilap seperti cermin, cahaya akan dipantulkan secara teratur. Sudut sinar yang datang selalu sama besar dengan sudut sinar yang dipantulkan. Coba ubah kemiringan cermin dan perhatikan arah pantulannya!',
  },
  prisma: {
    id: 'prisma',
    title: 'Prisma Kaca Segitiga',
    topicLabel: 'Topik A · Penguraian Cahaya',
    principle: 'Cahaya Putih Dapat Diuraikan (Dispersi)',
    summary:
      'Cahaya putih sebenarnya gabungan 7 warna pelangi (Me-Ji-Ku-Hi-Bi-Ni-U). Prisma kaca membelokkan tiap warna dengan sudut berbeda sehingga terurai seperti pelangi.',
    interactionHint: 'Seret prisma tepat ke tengah berkas sinar senter untuk melihat pelangi di layar.',
    draggable: true,
    voiceOverCode: 'VO_03_PRISMA',
    voiceOverAudioUrl: '/assets/aistudio/vo_03_prisma_3c216bd1.wav',
    voiceOverScript:
      'Ini adalah prisma kaca segitiga. Tahukah kamu bahwa cahaya putih sebenarnya gabungan dari tujuh warna pelangi? Saat melewati prisma kaca, cahaya putih terurai menjadi merah, jingga, kuning, hijau, biru, nila, dan ungu. Peristiwa penguraian cahaya ini disebut dispersi.',
  },
  gelas: {
    id: 'gelas',
    title: 'Gelas Air & Pensil',
    topicLabel: 'Topik A · Pembiasan Cahaya',
    principle: 'Cahaya Dapat Dibiaskan (Dibelokkan)',
    summary:
      'Cahaya merambat melalui dua medium berbeda kerapatan (udara ke air) sehingga arahnya membelok. Akibatnya, pensil di dalam air tampak patah atau bengkok.',
    interactionHint: 'Seret gelas ke jalur cahaya dan putar kamera (drag layar) untuk mengamati pensil dari samping.',
    draggable: true,
    voiceOverCode: 'VO_04_GELAS_AIR',
    voiceOverAudioUrl: '/assets/aistudio/vo_04_gelas_air_3767e504.wav',
    voiceOverScript:
      'Perhatikan pensil di dalam gelas berisi air ini. Pensil terlihat seolah-olah bengkok atau patah, bukan? Itu terjadi karena cahaya merambat melewati dua zat berbeda, yaitu dari udara ke air, sehingga arah sinarnya membelok. Sifat cahaya ini disebut pembiasan.',
  },
  benda_uji: {
    id: 'benda_uji',
    title: 'Bingkai Benda Uji Cahaya',
    topicLabel: 'Topik A · Sifat Medium Benda',
    principle: 'Benda Bening, Buram, dan Gelap',
    summary:
      'Kaca bening meneruskan cahaya hampir seluruhnya, kaca buram menyebarkan sebagian cahaya, sedangkan kayu gelap menghalangi cahaya hingga membentuk bayangan.',
    interactionHint: 'Sentuh bingkai untuk mengganti bahan (Bening → Buram → Gelap) atau seret ke jalur sinar.',
    draggable: true,
    actionLabel: 'Ganti Bahan Uji',
    voiceOverCode: 'VO_05_BENDA_UJI',
    voiceOverAudioUrl: '/assets/aistudio/vo_05_benda_uji_a900d1f8.wav',
    voiceOverScript:
      'Bingkai benda uji ini menunjukkan cara cahaya menembus bahan yang berbeda. Benda bening seperti kaca meneruskan hampir seluruh cahaya. Benda buram hanya meneruskan sebagian cahaya, sedangkan benda gelap seperti kayu menghalangi cahaya dan membentuk bayangan di belakangnya.',
  },
  layar: {
    id: 'layar',
    title: 'Layar Proyeksi Optik',
    topicLabel: 'Topik A · Pengamatan Cahaya',
    principle: 'Menangkap Sinar, Spektrum & Bayangan',
    summary:
      'Layar putih buram membantu mata kita mengamati hasil rambatan cahaya, mulai dari titik terang, bayangan benda gelap, hingga spektrum warna pelangi.',
    interactionHint: 'Arahkan sinar senter atau pantulan cermin menuju layar untuk melihat hasilnya.',
    draggable: false,
    voiceOverCode: 'VO_06_LAYAR',
    voiceOverAudioUrl: '/assets/aistudio/vo_06_layar_f5a34ccb.wav',
    voiceOverScript:
      'Ini adalah layar proyeksi optik. Permukaan putih layar berfungsi menangkap berkas cahaya agar mudah diamati oleh mata kita. Arahkan sinar senter, pantulan cermin, atau cahaya dari prisma ke layar ini untuk melihat titik terang, bayangan, maupun warna pelangi.',
  },
  garpu_tala: {
    id: 'garpu_tala',
    title: 'Garpu Tala & Kotak Resonansi',
    topicLabel: 'Topik B · Sumber & Nada Bunyi',
    principle: 'Bunyi Berasal dari Getaran (Frekuensi)',
    summary:
      'Saat dipukul, kedua cabang garpu tala bergetar cepat dan menghasilkan nada murni. Makin tinggi frekuensi (Hz), nada bunyi makin melengking dan rapatan gelombang makin rapat.',
    interactionHint: 'Sentuh garpu tala untuk memukulnya dengan palu karet dan dengarkan getarannya.',
    draggable: false,
    actionLabel: 'Pukul Garpu Tala',
    voiceOverCode: 'VO_07_GARPU_TALA',
    voiceOverAudioUrl: '/assets/aistudio/vo_07_garpu_tala_e8ec54de.wav',
    voiceOverScript:
      'Ini adalah garpu tala dan kotak resonansi. Bunyi selalu berasal dari benda yang bergetar. Saat dipukul, cabang garpu tala bergetar cepat dan menghasilkan nada. Coba ubah pengatur frekuensi atau nada di panel bawah: semakin tinggi frekuensinya, bunyi terdengar semakin melengking.',
  },
  gendang: {
    id: 'gendang',
    title: 'Gendang Akustik & Butiran Beras',
    topicLabel: 'Topik B · Kuat Lemah Bunyi',
    principle: 'Amplitudo Getaran & Kuat Bunyi',
    summary:
      'Membran gendang yang ditabuh bergetar naik-turun sehingga butiran beras di atasnya ikut melompat. Semakin kuat tabuhan (amplitudo besar), bunyi makin keras dan lompatan makin tinggi.',
    interactionHint: 'Sentuh permukaan gendang untuk menabuhnya dan amati lompatan butiran beras.',
    draggable: false,
    actionLabel: 'Tabuh Gendang',
    voiceOverCode: 'VO_08_GENDANG',
    voiceOverAudioUrl: '/assets/aistudio/vo_08_gendang_58b1d8a1.wav',
    voiceOverScript:
      'Lihatlah butiran beras di atas membran gendang ini! Ketika gendang ditabuh, kulit gendang bergetar naik dan turun sehingga butiran beras ikut melompat. Semakin kuat kita menabuh gendang, amplitudo getarannya makin besar, bunyi terdengar makin keras, dan butiran beras melompat makin tinggi.',
  },
  bel_vakum: {
    id: 'bel_vakum',
    title: 'Bel Listrik dalam Sungkup Vakum',
    topicLabel: 'Topik B · Medium Perambatan Bunyi',
    principle: 'Bunyi Memerlukan Medium Perambatan',
    summary:
      'Bunyi dapat merambat melalui zat padat, cair, dan gas, tetapi TIDAK dapat merambat di ruang hampa (vakum). Ubah medium ke Ruang Hampa lalu bunyikan bel untuk membuktikannya!',
    interactionHint: 'Sentuh bel untuk membunyikannya, lalu bandingkan hasilnya pada medium Udara, Air, Padat, dan Vakum.',
    draggable: false,
    actionLabel: 'Bunyikan Bel',
    voiceOverCode: 'VO_09_BEL_VAKUM',
    voiceOverAudioUrl: '/assets/aistudio/vo_09_bel_vakum_e748c24e.wav',
    voiceOverScript:
      'Ini adalah percobaan bel listrik di dalam sungkup kaca vakum. Bunyi memerlukan medium atau zat perantara untuk merambat, yaitu zat padat, cair, atau gas. Coba pilih medium Ruang Hampa lalu bunyikan bel: pemukul bel tetap bergetar, tetapi suaranya tidak terdengar karena tidak ada udara penghantar.',
  },
  dinding_akustik: {
    id: 'dinding_akustik',
    title: 'Dinding Beton & Busa Peredam',
    topicLabel: 'Topik B · Pemantulan & Penyerapan',
    principle: 'Gema (Pemantulan Dinding Beton) vs Penyerapan',
    summary:
      'Permukaan keras seperti Dinding Beton memantulkan kembali gelombang bunyi (tampak sebagai gelombang emas yang memantul balik) sehingga menghasilkan gema/reverb. Sebaliknya, busa akustik berpori menyerap bunyi agar tidak bergaung.',
    interactionHint: 'Sentuh dinding untuk berganti antara Dinding Beton (Gema) dan Busa Peredam, lalu bunyikan alat musik.',
    draggable: false,
    actionLabel: 'Ganti Permukaan',
    voiceOverCode: 'VO_10_DINDING_AKUSTIK',
    voiceOverAudioUrl: '/assets/aistudio/vo_10_dinding_akustik_9409d32e.wav',
    voiceOverScript:
      'Panel ini membuktikan sifat pemantulan dan penyerapan bunyi. Saat memilih Dinding Beton yang keras, gelombang bunyi akan memantul kembali dan menghasilkan gema yang terdengar jelas. Sebaliknya, jika diganti menjadi Busa Peredam yang lunak dan berpori, bunyi akan diserap agar ruangan tidak bergaung.',
  },
};

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question:
      'Ketika sebuah pensil dimasukkan ke dalam gelas berisi air jernih, pensil tampak seolah-olah patah. Peristiwa ini membuktikan sifat cahaya yaitu...',
    options: [
      'Cahaya dapat dipantulkan',
      'Cahaya dapat dibiaskan',
      'Cahaya dapat diuraikan',
      'Cahaya merambat lurus',
    ],
    correctIndex: 1,
    explanation:
      'Cahaya yang melewati udara menuju air mengalami pembelokan arah rambat (pembiasan), sehingga pensil terlihat bengkok atau patah.',
  },
  {
    id: 2,
    question:
      'Cahaya putih dari senter yang melewati prisma kaca akan terurai menjadi warna pelangi (Mejikuhibiniu). Sifat cahaya tersebut disebut...',
    options: [
      'Pemantulan teratur',
      'Pembiasan cahaya',
      'Penguraian (dispersi) cahaya',
      'Penyerapan cahaya',
    ],
    correctIndex: 2,
    explanation:
      'Prisma kaca menguraikan (dispersi) cahaya putih menjadi spektrum 7 warna penyusunnya: Merah, Jingga, Kuning, Hijau, Biru, Nila, dan Ungu.',
  },
  {
    id: 3,
    question:
      'Mengapa bel listrik yang terus bergetar di dalam sungkup kaca ruang hampa (vakum) tidak dapat kita dengar suaranya?',
    options: [
      'Karena kaca memantulkan semua suara ke dalam',
      'Karena bel tidak cukup kuat bergetar',
      'Karena bunyi memerlukan medium (zat perantara) untuk merambat',
      'Karena frekuensi bel terlalu tinggi untuk telinga',
    ],
    correctIndex: 2,
    explanation:
      'Bunyi adalah gelombang mekanik yang butuh partikel zat (padat, cair, atau gas) untuk merambat. Di ruang hampa tidak ada partikel penghantar.',
  },
  {
    id: 4,
    question:
      'Urutan kecepatan perambatan bunyi dari yang PALING CEPAT hingga paling lambat adalah...',
    options: [
      'Gas → Cair → Padat',
      'Cair → Gas → Padat',
      'Padat → Cair → Gas',
      'Gas → Padat → Cair',
    ],
    correctIndex: 2,
    explanation:
      'Susunan partikel zat padat paling rapat sehingga getaran berpindah paling cepat (padat > cair > gas).',
  },
  {
    id: 5,
    question:
      'Ruang studio musik atau bioskop sering dilapisi busa berpori dan karpet tebal pada dindingnya. Tujuan utamanya adalah...',
    options: [
      'Memperkeras gema di dalam ruangan',
      'Menyerap bunyi agar tidak terjadi gaung',
      'Membuat cahaya lampu makin terang',
      'Mempercepat rambatan bunyi di udara',
    ],
    correctIndex: 1,
    explanation:
      'Bahan lunak dan berpori seperti busa akustik, karpet, dan wol berfungsi menyerap gelombang bunyi sehingga mencegah pantulan yang mengganggu (gaung).',
  },
];
