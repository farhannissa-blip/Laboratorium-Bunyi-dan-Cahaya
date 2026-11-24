import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { soundEngine } from '../audio/soundEngine';
import type {
  CameraPreset,
  InteractiveObjectId,
  LabState,
  LightExperiment,
  PerformanceMode,
  SoundMedium,
} from '../types/lab';
import {
  createAcousticWallModel,
  createBeakerModel,
  createDrumModel,
  createFlashlightModel,
  createLabMaterials,
  createLabWorkbench,
  createMaterialStandModel,
  createMirrorModel,
  createPrismModel,
  createProjectionScreenModel,
  createTuningForkModel,
  createVacuumBellModel,
  type AcousticWallRig,
  type BeakerRig,
  type DrumRig,
  type FlashlightRig,
  type MaterialStandRig,
  type MirrorRig,
  type ProjectionScreenRig,
  type TuningForkRig,
  type VacuumBellRig,
} from './models';

// Pre-allocated scratch math helpers (zero GC inside animation loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _mat4 = new THREE.Matrix4();
const _scale = new THREE.Vector3();
const _pointer = new THREE.Vector2();
const _dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _dragHit = new THREE.Vector3();
const _dragOffset = new THREE.Vector3();

const RAINBOW_HEX = [
  0xef4444, // Merah
  0xf97316, // Jingga
  0xeab308, // Kuning
  0x22c55e, // Hijau
  0x3b82f6, // Biru
  0x6366f1, // Nila
  0xa855f7, // Ungu
];

interface SoundPulse {
  origin: THREE.Vector3;
  age: number;
  maxAge: number;
  speed: number;
  frequencyHz: number;
  amplitude: number;
  medium: SoundMedium;
  wallMode: 'pantul' | 'serap';
  echoSpawned: boolean;
  isEcho: boolean;
  mesh: THREE.Mesh;
}

export interface SceneCallbacks {
  onSelectObject: (id: InteractiveObjectId | null) => void;
  onToggleFlashlight: () => void;
  onCycleMaterialSlab: () => void;
  onToggleAcousticWall: () => void;
  onDragStatusChange: (draggingId: InteractiveObjectId | null) => void;
  onWebGLUnavailable?: () => void;
}

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class LabSceneManager {
  private container: HTMLElement;
  private callbacks: SceneCallbacks;
  private isSoftwareGl: boolean;
  private disposed = false;
  private frameId = 0;

  // Smart idle-sleep loop state (saves huge battery/heat on HP & 4K PID smartboards)
  private loopRunning = false;
  private idleTimer = 1.6;
  private elapsedTotal = 0;
  private lastTickTime = 0;
  private mediumWasActive = false;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;

  // Lighting
  private keyLight!: THREE.DirectionalLight;
  private beamSpotLight!: THREE.SpotLight;
  private beamPointLight!: THREE.PointLight;

  // Instrument rigs
  private flashlight!: FlashlightRig;
  private mirror!: MirrorRig;
  private prism!: THREE.Group;
  private beaker!: BeakerRig;
  private materialStand!: MaterialStandRig;
  private screen!: ProjectionScreenRig;
  private tuningFork!: TuningForkRig;
  private drum!: DrumRig;
  private vacuumBell!: VacuumBellRig;
  private acousticWall!: AcousticWallRig;

  private objectMap = new Map<InteractiveObjectId, THREE.Group>();
  private draggableTargets = new Map<InteractiveObjectId, THREE.Vector3>();

  // Dynamic optical beam meshes
  private beamGroup = new THREE.Group();
  private primaryBeamMesh!: THREE.Mesh;
  private secondaryBeamMesh!: THREE.Mesh;
  private diffusedConeMesh!: THREE.Mesh;
  private normalGuideLine!: THREE.Line;
  private rainbowBeams: THREE.Mesh[] = [];
  private dustParticles!: THREE.Points;

  // Dynamic acoustic visuals (shared geometries to avoid GPU buffer churn on HP/PID)
  private soundWaveGroup = new THREE.Group();
  private sharedRingGeo = new THREE.TorusGeometry(0.18, 0.026, 8, 26);
  private sharedEchoRingGeo = new THREE.TorusGeometry(0.22, 0.036, 8, 28);
  private sharedArrowGeo = new THREE.ConeGeometry(0.075, 0.22, 8);
  private activePulses: SoundPulse[] = [];
  private wallImpactMesh!: THREE.Mesh;
  private wallImpactTimer = 0;
  private wallImpactIsAbsorb = false;
  private incomingArrows: THREE.Mesh[] = [];
  private reflectedArrows: THREE.Mesh[] = [];
  private incomingArrowEnergy = 0;
  private echoEnergy = 0;
  private mediumParticles!: THREE.InstancedMesh;
  private mediumBasePositions!: Float32Array;
  private readonly mediumParticleCount = 64; // 4x4x4 clean grid for light GPU footprint
  private mediumMat!: THREE.MeshStandardMaterial;

  // Animation state
  private forkEnergy = 0;
  private forkMalletTimer = 0;
  private drumEnergy = 0;
  private drumStickTimer = 0;
  private bellTimer = 0;
  private gaugeAngleCurrent = -0.8;
  private bounceTimers = new Map<InteractiveObjectId, number>();

  // Camera transition targets (damped smoothly, cancelled on user input)
  private camTransitionActive = false;
  private camTargetPos = new THREE.Vector3(0, 5.4, 9.6);
  private camTargetLook = new THREE.Vector3(0, 0.72, 0);

  // Pointer & drag state
  private raycaster = new THREE.Raycaster();
  private hoveredId: InteractiveObjectId | null = null;
  private pointerDownPos = { x: 0, y: 0 };
  private pointerDownObject: { id: InteractiveObjectId; draggable: boolean; root: THREE.Group } | null = null;
  private isDraggingObject = false;
  private lastHoverCheck = 0;

  // Synced React state mirror
  private state: LabState;

  constructor(container: HTMLElement, initialState: LabState, callbacks: SceneCallbacks) {
    this.container = container;
    this.state = { ...initialState };
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.raycaster.layers.set(1);

    const lowPowerInit = this.isSoftwareGl || initialState.performanceMode === 'ringan';

    // 1. Renderer setup with HP/PID mobile-friendly defaults
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && !lowPowerInit,
      powerPreference: lowPowerInit ? 'low-power' : 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    container.appendChild(canvas);

    // 2. Scene & Horizon-Matched Fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a);
    this.scene.fog = new THREE.FogExp2(0x0f172a, 0.026);

    // Studio IBL reflections via RoomEnvironment (computed once at startup!)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // 3. Camera & OrbitControls (Touch + Wheel Zoom + Pan + Orbit)
    const aspect = (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 90);
    this.camera.position.set(-1.6, 4.9, 8.8);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(-0.6, 0.72, 0);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.085;
    this.controls.enableRotate = true;
    this.controls.enableZoom = true;
    this.controls.enablePan = true;
    this.controls.minDistance = 2.8;
    this.controls.maxDistance = 16.5;
    this.controls.minPolarAngle = 0.18;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    this.controls.addEventListener('start', () => {
      this.camTransitionActive = false;
      this.wake(1.2);
    });
    this.controls.addEventListener('change', () => {
      this.wake(0.8);
    });
    this.controls.update();

    // 4. Build Lighting, Bench, Instruments, Beams & Sound Visuals
    this.setupLighting();
    this.buildSceneObjects();
    this.setupOpticalBeams();
    this.setupMediumParticles();

    // Apply adaptive HP/PID resolution & shadow budget
    this.applyPerformanceProfile(this.state.performanceMode);

    // Arrange initial experiment layout
    this.applyExperimentLayout(this.state.lightExperiment, true);
    this.applyStateToScene(this.state);

    // Pre-warm shaders on GPU
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // 5. Bind Events & Wake Initial Frames
    this.bindEvents();
    this.wake(1.5);
  }

  /** Scale internal canvas resolution & shadow maps for smooth performance on HP & 4K PID boards */
  private applyPerformanceProfile(mode: PerformanceMode) {
    const isLight = mode === 'ringan' || this.isSoftwareGl;
    const cssW = this.container.clientWidth || window.innerWidth;
    const cssH = this.container.clientHeight || window.innerHeight;

    // Cap backing buffer width so 4K interactive boards (3840x2160) don't choke mobile ARM GPUs
    const maxLogicalWidth = isLight ? 1280 : 1920;
    const resScale = cssW > maxLogicalWidth ? maxLogicalWidth / cssW : 1;
    const renderW = Math.max(320, Math.round(cssW * resScale));
    const renderH = Math.max(240, Math.round(cssH * resScale));

    const targetDpr = isLight ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(targetDpr);
    this.renderer.setSize(renderW, renderH, false);

    // Shadows: rely on crisp pre-baked radial contact shadows in Ringan mode; enable 512px PCF in Detail mode
    const enableShadows = !isLight && !this.isSoftwareGl;
    this.renderer.shadowMap.enabled = enableShadows;
    if (this.keyLight) {
      this.keyLight.castShadow = enableShadows;
    }
    this.renderer.shadowMap.needsUpdate = true;

    this.camera.aspect = cssW / cssH;
    this.camera.updateProjectionMatrix();
    this.wake(0.6);
  }

  private setupLighting() {
    const hemi = new THREE.HemisphereLight(0xc8deff, 0x3b2c1e, 0.92);
    hemi.position.set(0, 12, 0);
    this.scene.add(hemi);

    this.keyLight = new THREE.DirectionalLight(0xfff1d6, 1.45);
    this.keyLight.position.set(5.5, 9.5, 6.2);
    this.keyLight.castShadow = false;
    this.keyLight.shadow.mapSize.set(512, 512);
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 26;
    const d = 7.2;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    const rim = new THREE.DirectionalLight(0x8ec5ff, 0.72);
    rim.position.set(-6, 5.5, -7);
    this.scene.add(rim);

    this.beamSpotLight = new THREE.SpotLight(0xffe9a8, 4.0, 9.5, Math.PI / 7, 0.55, 1.5);
    this.beamSpotLight.position.set(-3.7, 0.94, 0);
    this.beamSpotLight.target.position.set(0.3, 0.94, 0);
    this.scene.add(this.beamSpotLight, this.beamSpotLight.target);

    this.beamPointLight = new THREE.PointLight(0xffdd80, 1.2, 4.2, 2);
    this.beamPointLight.position.set(-2.0, 1.15, 0);
    this.scene.add(this.beamPointLight);
  }

  private buildSceneObjects() {
    // Cap anisotropy to 4 for mobile memory bandwidth savings while keeping markings sharp
    const maxAniso = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    const mats = createLabMaterials(this.isSoftwareGl, maxAniso);

    const workbench = createLabWorkbench(mats, maxAniso);
    this.scene.add(workbench);

    // --- LEFT SIDE: CAHAYA (OPTICS) ---
    this.flashlight = createFlashlightModel(mats);
    this.flashlight.group.position.set(-4.35, 0, 0);
    this.registerInstrument('senter', this.flashlight.group, true);

    this.mirror = createMirrorModel(mats, maxAniso);
    this.mirror.group.position.set(-2.1, 0, -1.45);
    this.registerInstrument('cermin', this.mirror.group, true);

    this.prism = createPrismModel(mats, maxAniso);
    this.prism.position.set(-2.1, 0, 1.45);
    this.registerInstrument('prisma', this.prism, true);

    this.beaker = createBeakerModel(mats, maxAniso);
    this.beaker.group.position.set(-3.15, 0, 1.45);
    this.registerInstrument('gelas', this.beaker.group, true);

    this.materialStand = createMaterialStandModel(mats);
    this.materialStand.group.position.set(-1.1, 0, -1.45);
    this.registerInstrument('benda_uji', this.materialStand.group, true);

    this.screen = createProjectionScreenModel(mats, maxAniso);
    this.screen.group.position.set(0.28, 0, 0);
    this.registerInstrument('layar', this.screen.group, false);

    // --- RIGHT SIDE: BUNYI (ACOUSTICS) ---
    this.tuningFork = createTuningForkModel(mats);
    this.tuningFork.group.position.set(1.85, 0, -1.15);
    this.registerInstrument('garpu_tala', this.tuningFork.group, false);

    this.drum = createDrumModel(mats, maxAniso);
    this.drum.group.position.set(1.85, 0, 1.1);
    this.registerInstrument('gendang', this.drum.group, false);

    this.vacuumBell = createVacuumBellModel(mats, maxAniso);
    this.vacuumBell.group.position.set(3.2, 0, 0);
    this.registerInstrument('bel_vakum', this.vacuumBell.group, false);

    this.acousticWall = createAcousticWallModel(mats, maxAniso);
    this.acousticWall.group.position.set(4.65, 0, 0);
    this.registerInstrument('dinding_akustik', this.acousticWall.group, false);

    this.scene.add(this.beamGroup);
    this.scene.add(this.soundWaveGroup);
  }

  private registerInstrument(id: InteractiveObjectId, group: THREE.Group, draggable: boolean) {
    this.objectMap.set(id, group);
    if (draggable) {
      this.draggableTargets.set(id, group.position.clone());
    }
    this.scene.add(group);
  }

  private setupOpticalBeams() {
    const unitCyl = new THREE.CylinderGeometry(0.068, 0.068, 1, 12, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffeb99,
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.primaryBeamMesh = new THREE.Mesh(unitCyl, beamMat);
    this.primaryBeamMesh.renderOrder = 8;
    this.beamGroup.add(this.primaryBeamMesh);

    const secondaryMat = beamMat.clone();
    this.secondaryBeamMesh = new THREE.Mesh(unitCyl, secondaryMat);
    this.secondaryBeamMesh.renderOrder = 8;
    this.secondaryBeamMesh.visible = false;
    this.beamGroup.add(this.secondaryBeamMesh);

    const coneGeo = new THREE.CylinderGeometry(0.08, 0.36, 1, 16, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xffe49c,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.diffusedConeMesh = new THREE.Mesh(coneGeo, coneMat);
    this.diffusedConeMesh.renderOrder = 8;
    this.diffusedConeMesh.visible = false;
    this.beamGroup.add(this.diffusedConeMesh);

    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-1, 0, 0),
    ]);
    const lineMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 0.08,
      gapSize: 0.06,
      transparent: true,
      opacity: 0.75,
    });
    this.normalGuideLine = new THREE.Line(lineGeo, lineMat);
    this.normalGuideLine.visible = false;
    this.beamGroup.add(this.normalGuideLine);

    const rayGeo = new THREE.CylinderGeometry(0.024, 0.044, 1, 10, 1, true);
    RAINBOW_HEX.forEach((hex) => {
      const mat = new THREE.MeshBasicMaterial({
        color: hex,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(rayGeo, mat);
      mesh.visible = false;
      mesh.renderOrder = 9;
      this.rainbowBeams.push(mesh);
      this.beamGroup.add(mesh);
    });

    const moteCount = 28;
    const positions = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      positions[i * 3] = -4.2 + Math.random() * 4.4;
      positions[i * 3 + 1] = 0.55 + Math.random() * 0.85;
      positions[i * 3 + 2] = -0.6 + Math.random() * 1.2;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const moteMat = new THREE.PointsMaterial({
      color: 0xfff3c4,
      size: 0.05,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.dustParticles = new THREE.Points(moteGeo, moteMat);
    this.beamGroup.add(this.dustParticles);
  }

  private setupMediumParticles() {
    const geo = new THREE.SphereGeometry(0.04, 8, 6);
    this.mediumMat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.35,
      roughness: 0.3,
      metalness: 0.15,
      transparent: true,
      opacity: 0.55,
    });
    this.mediumParticles = new THREE.InstancedMesh(geo, this.mediumMat, this.mediumParticleCount);
    this.mediumParticles.frustumCulled = false;

    this.mediumBasePositions = new Float32Array(this.mediumParticleCount * 3);
    let idx = 0;
    // 4 x 4 x 4 grid = 64 particles
    for (let ix = 0; ix < 4; ix++) {
      for (let iy = 0; iy < 4; iy++) {
        for (let iz = 0; iz < 4; iz++) {
          if (idx >= this.mediumParticleCount) break;
          this.mediumBasePositions[idx * 3] = 1.75 + ix * 0.78;
          this.mediumBasePositions[idx * 3 + 1] = 0.54 + iy * 0.34;
          this.mediumBasePositions[idx * 3 + 2] = -1.05 + iz * 0.7;
          idx++;
        }
      }
    }
    this.resetMediumParticleMatrices();
    this.scene.add(this.mediumParticles);

    // Wall surface reflection impact ripple ring (blooms on Dinding Beton when sound bounces!)
    const impactGeo = new THREE.RingGeometry(0.14, 0.25, 32);
    const impactMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.wallImpactMesh = new THREE.Mesh(impactGeo, impactMat);
    this.wallImpactMesh.rotation.y = -Math.PI / 2;
    this.wallImpactMesh.position.set(4.52, 0.95, 0);
    this.wallImpactMesh.visible = false;
    this.wallImpactMesh.renderOrder = 10;
    this.soundWaveGroup.add(this.wallImpactMesh);

    // 3D directional wave flow arrows above acoustic zone (Cyan → Incoming | Gold ← Reflected Echo)
    for (let i = 0; i < 3; i++) {
      const inMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const inArrow = new THREE.Mesh(this.sharedArrowGeo, inMat);
      inArrow.rotation.z = -Math.PI / 2; // Pointing +X toward Dinding Beton
      inArrow.position.set(2.35 + i * 0.78, 1.66, 0);
      inArrow.visible = false;
      this.incomingArrows.push(inArrow);
      this.soundWaveGroup.add(inArrow);

      const outMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const outArrow = new THREE.Mesh(this.sharedArrowGeo, outMat);
      outArrow.rotation.z = Math.PI / 2; // Pointing -X bouncing back from Dinding Beton
      outArrow.position.set(3.95 - i * 0.78, 1.44, 0);
      outArrow.visible = false;
      this.reflectedArrows.push(outArrow);
      this.soundWaveGroup.add(outArrow);
    }
  }

  /** Write resting particle positions once (avoid per-frame matrix uploads when silent) */
  private resetMediumParticleMatrices() {
    const { soundMedium } = this.state;
    const baseScale = soundMedium === 'padat' ? 1.15 : soundMedium === 'air' ? 0.94 : 0.76;
    _quat.identity();
    _scale.set(baseScale, baseScale, baseScale);
    for (let i = 0; i < this.mediumParticleCount; i++) {
      _v1.set(
        this.mediumBasePositions[i * 3],
        this.mediumBasePositions[i * 3 + 1],
        this.mediumBasePositions[i * 3 + 2],
      );
      _mat4.compose(_v1, _quat, _scale);
      this.mediumParticles.setMatrixAt(i, _mat4);
    }
    this.mediumParticles.instanceMatrix.needsUpdate = true;
  }

  private placeBeamSegment(mesh: THREE.Mesh, start: THREE.Vector3, end: THREE.Vector3, radiusScale = 1) {
    _dir.subVectors(end, start);
    const len = _dir.length();
    if (len < 0.01) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    _dir.divideScalar(len);
    _quat.setFromUnitVectors(_up, _dir);
    mesh.quaternion.copy(_quat);
    mesh.scale.set(radiusScale, len, radiusScale);
  }

  public applyExperimentLayout(experiment: LightExperiment, immediate = false) {
    const layout: Record<InteractiveObjectId, [number, number]> = {
      senter: [-4.35, 0],
      cermin: [-2.1, -1.45],
      prisma: [-2.1, 1.45],
      gelas: [-3.2, 1.45],
      benda_uji: [-1.15, -1.45],
      layar: [0.28, 0],
      garpu_tala: [1.85, -1.15],
      gendang: [1.85, 1.1],
      bel_vakum: [3.2, 0],
      dinding_akustik: [4.65, 0],
    };

    if (experiment === 'pantul') {
      layout.cermin = [-1.95, 0];
    } else if (experiment === 'dispersi') {
      layout.prisma = [-2.05, 0];
    } else if (experiment === 'bias') {
      layout.gelas = [-2.15, 0];
    } else if (experiment === 'bening') {
      layout.benda_uji = [-2.05, 0];
    }

    (['senter', 'cermin', 'prisma', 'gelas', 'benda_uji'] as InteractiveObjectId[]).forEach((id) => {
      const [tx, tz] = layout[id];
      const target = this.draggableTargets.get(id);
      if (target) target.set(tx, 0, tz);
      if (immediate) {
        const obj = this.objectMap.get(id);
        if (obj) obj.position.set(tx, 0, tz);
      }
    });
    this.wake(1.2);
  }

  public triggerSoundInstrument(id: 'garpu_tala' | 'gendang' | 'bel_vakum') {
    const { soundFrequency, soundAmplitude, soundMedium, acousticWall } = this.state;
    const ampNorm = soundAmplitude / 100;

    if (id === 'garpu_tala') {
      this.forkEnergy = Math.max(this.forkEnergy, 0.55 + ampNorm * 0.65);
      this.forkMalletTimer = 0.42;
      soundEngine.playTuningFork(soundFrequency, soundAmplitude, soundMedium, acousticWall);
      this.spawnSoundWave(new THREE.Vector3(1.85, 1.15, -1.15));
    } else if (id === 'gendang') {
      this.drumEnergy = Math.max(this.drumEnergy, 0.6 + ampNorm * 0.75);
      this.drumStickTimer = 0.35;
      soundEngine.playDrum(soundFrequency, soundAmplitude, soundMedium, acousticWall);
      this.spawnSoundWave(new THREE.Vector3(1.85, 1.05, 1.1));
    } else if (id === 'bel_vakum') {
      this.bellTimer = 0.95;
      soundEngine.playVacuumBell(soundFrequency, soundAmplitude, soundMedium, acousticWall);
      this.spawnSoundWave(new THREE.Vector3(3.2, 0.85, 0));
    }

    this.bounceTimers.set(id, 0.25);
    this.wake(2.4);
  }

  private spawnSoundWave(origin: THREE.Vector3, isEcho = false) {
    const { soundMedium, soundFrequency, soundAmplitude, acousticWall } = this.state;
    if (soundMedium === 'vakum') return;

    if (isEcho) {
      this.echoEnergy = 1.0;
    } else {
      this.incomingArrowEnergy = 1.0;
    }

    const speedFactor = soundMedium === 'padat' ? 2.4 : soundMedium === 'air' ? 1.65 : 1.05;
    const ringCount = isEcho ? 3 : 3;
    const freqNorm = (soundFrequency - 220) / 660;
    const waveGap = (isEcho ? 0.19 : 0.16) - freqNorm * 0.06;

    for (let i = 0; i < ringCount; i++) {
      // Clear color coding: Incoming = Sky Cyan (0x38bdf8), Reflected Echo = Bright Gold (0xfbbf24)
      const color = isEcho ? 0xfbbf24 : 0x38bdf8;

      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: isEcho ? 0.92 : 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      // Reuse shared TorusGeometry — zero GPU geometry upload overhead!
      const mesh = new THREE.Mesh(isEcho ? this.sharedEchoRingGeo : this.sharedRingGeo, mat);
      mesh.rotation.y = Math.PI / 2;
      mesh.position.copy(origin);
      this.soundWaveGroup.add(mesh);

      this.activePulses.push({
        origin: origin.clone(),
        age: -i * waveGap,
        maxAge: isEcho ? 2.15 : 2.35,
        speed: (isEcho ? 1.48 : 1.58) * speedFactor,
        frequencyHz: soundFrequency,
        amplitude: soundAmplitude / 100,
        medium: soundMedium,
        wallMode: acousticWall,
        echoSpawned: isEcho,
        isEcho,
        mesh,
      });
    }
    this.wake(2.8);
  }

  public updateState(next: LabState, prevExperiment?: LightExperiment, prevPerfMode?: PerformanceMode) {
    const experimentChanged = prevExperiment && prevExperiment !== next.lightExperiment;
    const perfChanged = prevPerfMode && prevPerfMode !== next.performanceMode;
    const mediumChanged = this.state.soundMedium !== next.soundMedium;
    this.state = { ...next };

    if (perfChanged) {
      this.applyPerformanceProfile(next.performanceMode);
    }
    if (experimentChanged) {
      this.applyExperimentLayout(next.lightExperiment, false);
    }
    this.applyStateToScene(next);
    if (mediumChanged) {
      this.resetMediumParticleMatrices();
    }
    this.wake(1.2);
  }

  private applyStateToScene(s: LabState) {
    soundEngine.setMuted(s.audioMuted);
    this.materialStand.setMaterialType(s.materialSlab);
    this.acousticWall.setMode(s.acousticWall);

    if (s.soundMedium === 'vakum') {
      this.mediumParticles.visible = false;
    } else {
      this.mediumParticles.visible = true;
      if (s.soundMedium === 'udara') {
        this.mediumMat.color.setHex(0x93c5fd);
        this.mediumMat.emissive.setHex(0x0284c7);
        this.mediumMat.opacity = 0.42;
      } else if (s.soundMedium === 'air') {
        this.mediumMat.color.setHex(0x38bdf8);
        this.mediumMat.emissive.setHex(0x0ea5e9);
        this.mediumMat.opacity = 0.68;
      } else {
        this.mediumMat.color.setHex(0xfbbf24);
        this.mediumMat.emissive.setHex(0xd97706);
        this.mediumMat.opacity = 0.78;
      }
    }

    this.updateSelectionRings();
  }

  private updateSelectionRings() {
    this.objectMap.forEach((group, id) => {
      const ring = group.getObjectByName('selectionRing') as THREE.Mesh | undefined;
      if (!ring) return;
      const mat = ring.material as THREE.MeshBasicMaterial;
      if (id === this.state.selectedObject) {
        mat.color.setHex(0xf59e0b);
        mat.opacity = 0.85;
      } else if (id === this.hoveredId) {
        mat.color.setHex(0x38bdf8);
        mat.opacity = 0.55;
      } else {
        mat.opacity = 0;
      }
    });
  }

  public setCameraPreset(preset: CameraPreset) {
    this.camTransitionActive = true;
    if (preset === 'overview') {
      this.camTargetPos.set(0.0, 5.4, 9.6);
      this.camTargetLook.set(0.0, 0.72, 0.0);
    } else if (preset === 'cahaya') {
      this.camTargetPos.set(-2.2, 3.6, 5.9);
      this.camTargetLook.set(-2.1, 0.82, 0.0);
    } else if (preset === 'bunyi') {
      this.camTargetPos.set(3.0, 3.6, 5.8);
      this.camTargetLook.set(2.85, 0.82, 0.0);
    } else if (preset === 'fokus_alat' && this.state.selectedObject) {
      const obj = this.objectMap.get(this.state.selectedObject);
      if (obj) {
        this.camTargetLook.set(obj.position.x, 0.85, obj.position.z);
        this.camTargetPos.set(obj.position.x - 0.6, 2.55, obj.position.z + 3.4);
      }
    }
    this.wake(1.5);
  }

  public zoomStep(direction: 'in' | 'out') {
    _v1.copy(this.camera.position).sub(this.controls.target);
    const currentDist = _v1.length();
    const factor = direction === 'in' ? 0.76 : 1.3;
    const nextDist = THREE.MathUtils.clamp(currentDist * factor, this.controls.minDistance, this.controls.maxDistance);
    _v1.normalize().multiplyScalar(nextDist);
    this.camTargetPos.copy(this.controls.target).add(_v1);
    this.camTargetLook.copy(this.controls.target);
    this.camTransitionActive = true;
    this.wake(1.2);
  }

  private updateOptics(dt: number, elapsed: number): boolean {
    let moving = false;
    const { flashlightOn, lightBrightness, mirrorAngle, materialSlab } = this.state;
    const intensity = flashlightOn ? lightBrightness / 100 : 0;

    const targetMirrorRad = THREE.MathUtils.degToRad(mirrorAngle);
    if (Math.abs(this.mirror.rotator.rotation.y - targetMirrorRad) > 0.002) {
      this.mirror.rotator.rotation.y = THREE.MathUtils.damp(
        this.mirror.rotator.rotation.y,
        targetMirrorRad,
        10,
        dt,
      );
      moving = true;
    } else {
      this.mirror.rotator.rotation.y = targetMirrorRad;
    }

    this.draggableTargets.forEach((targetPos, id) => {
      if (this.isDraggingObject && this.pointerDownObject?.id === id) {
        moving = true;
        return;
      }
      const obj = this.objectMap.get(id);
      if (!obj) return;
      const dx = Math.abs(obj.position.x - targetPos.x);
      const dz = Math.abs(obj.position.z - targetPos.z);
      if (dx > 0.003 || dz > 0.003) {
        obj.position.x = THREE.MathUtils.damp(obj.position.x, targetPos.x, 8, dt);
        obj.position.z = THREE.MathUtils.damp(obj.position.z, targetPos.z, 8, dt);
        moving = true;
      } else {
        obj.position.x = targetPos.x;
        obj.position.z = targetPos.z;
      }
    });

    this.beaker.waterSurface.position.y = 0.932 + Math.sin(elapsed * 2.4) * 0.004;

    this.flashlight.bulbMat.emissiveIntensity = intensity * 3.4;
    this.beamSpotLight.intensity = intensity * 6.5;
    this.beamPointLight.intensity = intensity * 1.9;
    this.keyLight.intensity = 1.15 + intensity * 0.45;
    (this.dustParticles.material as THREE.PointsMaterial).opacity = intensity * 0.44;

    const startX = this.flashlight.group.position.x + 0.44;
    const startY = 0.94;
    const startZ = this.flashlight.group.position.z;
    this.beamSpotLight.position.set(startX, startY, startZ);
    this.beamSpotLight.target.position.set(this.screen.group.position.x, startY, startZ);

    this.secondaryBeamMesh.visible = false;
    this.diffusedConeMesh.visible = false;
    this.normalGuideLine.visible = false;
    this.rainbowBeams.forEach((r) => (r.visible = false));

    if (intensity <= 0.01) {
      this.primaryBeamMesh.visible = false;
      this.screen.controller.update({ mode: 'none', intensity: 0, hitY: 0, hitZ: 0 });
      return moving;
    }

    const screenX = this.screen.group.position.x - 0.02;

    type ObstacleId = 'cermin' | 'prisma' | 'gelas' | 'benda_uji';
    const candidates: { id: ObstacleId; x: number; z: number; halfZ: number }[] = [
      { id: 'cermin', x: this.mirror.group.position.x, z: this.mirror.group.position.z, halfZ: 0.48 },
      { id: 'prisma', x: this.prism.position.x, z: this.prism.position.z, halfZ: 0.42 },
      { id: 'gelas', x: this.beaker.group.position.x, z: this.beaker.group.position.z, halfZ: 0.4 },
      {
        id: 'benda_uji',
        x: this.materialStand.group.position.x,
        z: this.materialStand.group.position.z,
        halfZ: 0.46,
      },
    ];

    let hit: (typeof candidates)[number] | null = null;
    for (const c of candidates) {
      if (c.x > startX + 0.25 && c.x < screenX - 0.15 && Math.abs(c.z - startZ) <= c.halfZ) {
        if (!hit || c.x < hit.x) hit = c;
      }
    }

    const beamRadius = 0.72 + intensity * 0.42;
    const primaryMat = this.primaryBeamMesh.material as THREE.MeshBasicMaterial;
    primaryMat.opacity = 0.16 + intensity * 0.52;

    _v1.set(startX, startY, startZ);

    if (!hit) {
      _v2.set(screenX, startY, startZ);
      this.placeBeamSegment(this.primaryBeamMesh, _v1, _v2, beamRadius);
      this.beamPointLight.position.set(screenX - 0.3, startY, startZ);
      const normZ = THREE.MathUtils.clamp(startZ / 0.92, -1, 1);
      this.screen.controller.update({ mode: 'spot', intensity, hitY: -0.15, hitZ: normZ });
      return moving;
    }

    _v2.set(hit.x, startY, startZ);
    this.placeBeamSegment(this.primaryBeamMesh, _v1, _v2, beamRadius);
    this.beamPointLight.position.set(hit.x, startY + 0.18, startZ);

    if (hit.id === 'cermin') {
      const theta = this.mirror.rotator.rotation.y;
      const nx = -Math.cos(theta);
      const nz = Math.sin(theta);
      const dot = nx;
      const rx = 1 - 2 * dot * nx;
      const rz = -2 * dot * nz;

      const reflectLen = 2.65;
      _v3.set(hit.x + rx * reflectLen, startY, startZ + rz * reflectLen);
      this.placeBeamSegment(this.secondaryBeamMesh, _v2, _v3, beamRadius * 0.92);
      const secMat = this.secondaryBeamMesh.material as THREE.MeshBasicMaterial;
      secMat.color.setHex(0xffeb99);
      secMat.opacity = 0.15 + intensity * 0.5;

      const posAttr = this.normalGuideLine.geometry.getAttribute('position') as THREE.BufferAttribute;
      posAttr.setXYZ(0, hit.x, startY, startZ);
      posAttr.setXYZ(1, hit.x + nx * 1.15, startY, startZ + nz * 1.15);
      posAttr.needsUpdate = true;
      this.normalGuideLine.computeLineDistances();
      this.normalGuideLine.visible = true;

      this.screen.controller.update({ mode: 'none', intensity: 0, hitY: 0, hitZ: 0 });
    } else if (hit.id === 'prisma') {
      const exitX = hit.x + 0.18;
      const span = Math.max(0.6, screenX - exitX);
      RAINBOW_HEX.forEach((_, idx) => {
        const t = (idx - 3) / 3;
        const spreadZ = startZ + t * 0.42 + 0.08;
        const spreadY = startY - t * 0.05;
        _v2.set(exitX, startY, startZ);
        _v3.set(exitX + span, spreadY, spreadZ);
        this.placeBeamSegment(this.rainbowBeams[idx], _v2, _v3, 0.78 + intensity * 0.35);
        (this.rainbowBeams[idx].material as THREE.MeshBasicMaterial).opacity = 0.25 + intensity * 0.65;
      });
      const normZ = THREE.MathUtils.clamp((startZ + 0.08) / 0.92, -1, 1);
      this.screen.controller.update({ mode: 'rainbow', intensity, hitY: -0.15, hitZ: normZ });
    } else if (hit.id === 'gelas') {
      const bendY = startY - 0.22;
      const bendZ = startZ + 0.28;
      _v3.set(screenX, bendY, bendZ);
      this.placeBeamSegment(this.secondaryBeamMesh, _v2, _v3, beamRadius * 0.88);
      const secMat = this.secondaryBeamMesh.material as THREE.MeshBasicMaterial;
      secMat.color.setHex(0xbae6fd);
      secMat.opacity = 0.18 + intensity * 0.46;

      const normZ = THREE.MathUtils.clamp(bendZ / 0.92, -1, 1);
      this.screen.controller.update({ mode: 'refracted', intensity: intensity * 0.9, hitY: -0.35, hitZ: normZ });
    } else if (hit.id === 'benda_uji') {
      const normZ = THREE.MathUtils.clamp(startZ / 0.92, -1, 1);
      if (materialSlab === 'bening') {
        _v3.set(screenX, startY, startZ);
        this.placeBeamSegment(this.secondaryBeamMesh, _v2, _v3, beamRadius * 0.95);
        const secMat = this.secondaryBeamMesh.material as THREE.MeshBasicMaterial;
        secMat.color.setHex(0xffeb99);
        secMat.opacity = 0.15 + intensity * 0.48;
        this.screen.controller.update({ mode: 'spot', intensity: intensity * 0.95, hitY: -0.15, hitZ: normZ });
      } else if (materialSlab === 'buram') {
        _v3.set(screenX, startY, startZ);
        this.placeBeamSegment(this.diffusedConeMesh, _v2, _v3, 1.0 + intensity * 0.25);
        (this.diffusedConeMesh.material as THREE.MeshBasicMaterial).opacity = 0.08 + intensity * 0.24;
        this.screen.controller.update({ mode: 'diffused', intensity: intensity * 0.72, hitY: -0.15, hitZ: normZ });
      } else {
        this.screen.controller.update({ mode: 'shadow', intensity, hitY: -0.15, hitZ: normZ });
      }
    }

    return moving;
  }

  private updateAcoustics(dt: number, elapsed: number): boolean {
    let active = false;
    const { soundFrequency, soundAmplitude, soundMedium } = this.state;
    const freqScale = 0.7 + ((soundFrequency - 220) / 660) * 1.8;

    // 1. Vacuum gauge needle animation
    const targetGauge = soundMedium === 'vakum' ? 0.95 : -0.82;
    if (Math.abs(this.gaugeAngleCurrent - targetGauge) > 0.004) {
      this.gaugeAngleCurrent = THREE.MathUtils.damp(this.gaugeAngleCurrent, targetGauge, 6, dt);
      this.vacuumBell.gaugeNeedle.rotation.z = this.gaugeAngleCurrent;
      active = true;
    } else {
      this.vacuumBell.gaugeNeedle.rotation.z = targetGauge;
    }

    // 2. Tuning fork prongs & mallet swing
    if (this.forkMalletTimer > 0) {
      this.forkMalletTimer = Math.max(0, this.forkMalletTimer - dt);
      const strike = Math.sin((this.forkMalletTimer / 0.42) * Math.PI);
      this.tuningFork.malletPivot.rotation.z = -0.22 + strike * 0.56;
      active = true;
    } else if (Math.abs(this.tuningFork.malletPivot.rotation.z + 0.22) > 0.003) {
      this.tuningFork.malletPivot.rotation.z = THREE.MathUtils.damp(
        this.tuningFork.malletPivot.rotation.z,
        -0.22,
        10,
        dt,
      );
      active = true;
    }

    if (this.forkEnergy > 0.005) {
      this.forkEnergy = Math.max(0, this.forkEnergy - dt * 0.42);
      const vib = Math.sin(elapsed * 44 * freqScale) * 0.075 * this.forkEnergy;
      this.tuningFork.prongLeft.rotation.z = vib;
      this.tuningFork.prongRight.rotation.z = -vib;
      active = true;
    } else {
      this.tuningFork.prongLeft.rotation.z = 0;
      this.tuningFork.prongRight.rotation.z = 0;
    }

    // 3. Acoustic drum stick, membrane pulse & bouncing rice grains (zero GC!)
    if (this.drumStickTimer > 0) {
      this.drumStickTimer = Math.max(0, this.drumStickTimer - dt);
      const beat = Math.sin((this.drumStickTimer / 0.35) * Math.PI);
      this.drum.drumstickPivot.rotation.z = -0.35 + beat * 0.36;
      active = true;
    } else if (Math.abs(this.drum.drumstickPivot.rotation.z + 0.35) > 0.003) {
      this.drum.drumstickPivot.rotation.z = THREE.MathUtils.damp(
        this.drum.drumstickPivot.rotation.z,
        -0.35,
        10,
        dt,
      );
      active = true;
    }

    if (this.drumEnergy > 0.005) {
      this.drumEnergy = Math.max(0, this.drumEnergy - dt * 0.72);
      const membraneBounce = Math.sin(elapsed * 38) * 0.018 * this.drumEnergy;
      this.drum.membrane.position.y = 1.015 + membraneBounce;

      _scale.set(1, 1, 1);
      for (let i = 0; i < this.drum.riceCount; i++) {
        const bx = this.drum.riceBaseOffsets[i * 3];
        const bz = this.drum.riceBaseOffsets[i * 3 + 1];
        const phase = this.drum.riceBaseOffsets[i * 3 + 2];
        const hop =
          Math.abs(Math.sin(elapsed * 18 + phase)) * 0.28 * this.drumEnergy * (0.4 + soundAmplitude / 120);
        _v1.set(bx, 1.038 + hop, bz);
        _euler.set(hop * 4.5 * Math.cos(phase), phase + elapsed * 3 * this.drumEnergy, hop * 3.5);
        _quat.setFromEuler(_euler);
        _mat4.compose(_v1, _quat, _scale);
        this.drum.riceInstanced.setMatrixAt(i, _mat4);
      }
      this.drum.riceInstanced.instanceMatrix.needsUpdate = true;
      active = true;
    } else {
      this.drum.membrane.position.y = 1.015;
    }

    // 4. Vacuum electric bell clapper oscillation
    if (this.bellTimer > 0) {
      this.bellTimer = Math.max(0, this.bellTimer - dt);
      this.vacuumBell.clapperPivot.rotation.z = 0.2 + Math.sin(elapsed * 52) * 0.36;
      this.vacuumBell.bellDome.rotation.z = Math.sin(elapsed * 70) * 0.025;
      active = true;
    } else if (Math.abs(this.vacuumBell.clapperPivot.rotation.z - 0.2) > 0.003) {
      this.vacuumBell.clapperPivot.rotation.z = THREE.MathUtils.damp(
        this.vacuumBell.clapperPivot.rotation.z,
        0.2,
        12,
        dt,
      );
      this.vacuumBell.bellDome.rotation.z = 0;
      active = true;
    }

    // 5. Expanding 3D sound wave rings + Concrete Wall Reflection Ripple & Directional Arrows
    const wallX = this.acousticWall.group.position.x - 0.14;
    if (this.activePulses.length > 0) active = true;

    for (let i = this.activePulses.length - 1; i >= 0; i--) {
      const p = this.activePulses[i];
      p.age += dt;
      if (p.age < 0) {
        p.mesh.visible = false;
        continue;
      }
      if (p.age >= p.maxAge || soundMedium === 'vakum') {
        this.soundWaveGroup.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.activePulses.splice(i, 1);
        continue;
      }

      p.mesh.visible = true;
      const travel = p.age * p.speed;
      const dirSign = p.isEcho ? -1 : 1;
      const currX = p.origin.x + dirSign * travel;

      // Incoming wave hits Dinding Beton or Busa Peredam
      if (!p.isEcho && currX >= wallX) {
        this.wallImpactMesh.position.set(wallX - 0.03, p.origin.y, p.origin.z);
        this.wallImpactTimer = 0.55;
        this.wallImpactIsAbsorb = p.wallMode === 'serap';

        if (!p.echoSpawned && p.wallMode === 'pantul') {
          p.echoSpawned = true;
          this.spawnSoundWave(new THREE.Vector3(wallX - 0.08, p.origin.y, p.origin.z), true);
        }
        this.soundWaveGroup.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.activePulses.splice(i, 1);
        continue;
      }

      // Stop reflected echo waves cleanly before crossing into the Optics (Cahaya) side
      if (p.isEcho && currX < 0.85) {
        this.soundWaveGroup.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.activePulses.splice(i, 1);
        continue;
      }

      const progress = p.age / p.maxAge;
      const ringScale = p.isEcho ? 0.95 + travel * 0.88 : 0.72 + travel * 0.9;
      p.mesh.position.set(currX, p.origin.y, p.origin.z);
      p.mesh.scale.set(ringScale, ringScale, 1);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity =
        (1 - progress * 0.92) * (p.isEcho ? 0.92 : 0.85) * (0.5 + p.amplitude * 0.5);
    }

    // 5b. Concrete wall surface impact ring (golden bounce vs teal absorption collapse)
    if (this.wallImpactTimer > 0) {
      this.wallImpactTimer = Math.max(0, this.wallImpactTimer - dt);
      const t = 1 - this.wallImpactTimer / 0.55;
      this.wallImpactMesh.visible = true;
      const mat = this.wallImpactMesh.material as THREE.MeshBasicMaterial;
      if (this.wallImpactIsAbsorb) {
        mat.color.setHex(0x64748b);
        const shrink = Math.max(0.2, 1.4 - t * 1.1);
        this.wallImpactMesh.scale.set(shrink, shrink, 1);
        mat.opacity = (1 - t) * 0.45;
      } else {
        mat.color.setHex(0xfbbf24);
        const expand = 0.75 + t * 2.5;
        this.wallImpactMesh.scale.set(expand, expand, 1);
        mat.opacity = (1 - t) * 0.9;
      }
      active = true;
    } else {
      this.wallImpactMesh.visible = false;
    }

    // 5c. 3D directional flow arrows (Incoming Cyan → & Reflected Gold ←)
    if (this.incomingArrowEnergy > 0.01 && soundMedium !== 'vakum') {
      this.incomingArrowEnergy = Math.max(0, this.incomingArrowEnergy - dt * 0.85);
      this.incomingArrows.forEach((arrow, idx) => {
        arrow.visible = true;
        const pulse = 0.5 + 0.5 * Math.sin(elapsed * 10 - idx * 1.15);
        (arrow.material as THREE.MeshBasicMaterial).opacity = this.incomingArrowEnergy * (0.28 + 0.62 * pulse);
        arrow.position.x = 2.25 + idx * 0.78 + pulse * 0.1;
      });
      active = true;
    } else {
      this.incomingArrows.forEach((a) => (a.visible = false));
    }

    if (this.echoEnergy > 0.01 && soundMedium !== 'vakum' && this.state.acousticWall === 'pantul') {
      this.echoEnergy = Math.max(0, this.echoEnergy - dt * 0.58);
      this.reflectedArrows.forEach((arrow, idx) => {
        arrow.visible = true;
        const pulse = 0.5 + 0.5 * Math.sin(elapsed * 10 - idx * 1.15);
        (arrow.material as THREE.MeshBasicMaterial).opacity = this.echoEnergy * (0.35 + 0.65 * pulse);
        arrow.position.x = 4.05 - idx * 0.78 - pulse * 0.12;
      });
      active = true;
    } else {
      this.echoEnergy = Math.max(0, this.echoEnergy - dt * 1.5);
      this.reflectedArrows.forEach((a) => (a.visible = false));
    }

    // 6. Longitudinal compression wave in medium particles (Forward + Reflected Echo superposition!)
    const waveActivity = Math.max(
      this.forkEnergy,
      this.drumEnergy,
      this.bellTimer > 0 ? 0.85 : 0,
      this.echoEnergy * 0.85,
    );
    if (this.mediumParticles.visible) {
      if (waveActivity > 0.01) {
        const isSolid = soundMedium === 'padat';
        const isLiquid = soundMedium === 'air';
        const baseScale = isSolid ? 1.15 : isLiquid ? 0.94 : 0.76;
        const speedMul = isSolid ? 2.4 : isLiquid ? 1.65 : 1.0;

        _quat.identity();
        for (let i = 0; i < this.mediumParticleCount; i++) {
          const bx = this.mediumBasePositions[i * 3];
          const by = this.mediumBasePositions[i * 3 + 1];
          const bz = this.mediumBasePositions[i * 3 + 2];

          const forwardEnergy = Math.max(this.forkEnergy, this.drumEnergy, this.bellTimer > 0 ? 0.85 : 0);
          const forwardDisp =
            forwardEnergy > 0.01
              ? Math.sin(bx * (3.2 + freqScale * 1.6) - elapsed * 14 * speedMul) * 0.13 * forwardEnergy
              : 0;
          const echoDisp =
            this.echoEnergy > 0.01 && this.state.acousticWall === 'pantul'
              ? Math.sin(bx * (3.2 + freqScale * 1.6) + elapsed * 14 * speedMul) * 0.11 * this.echoEnergy
              : 0;

          const waveDispX = (forwardDisp + echoDisp) * (0.45 + soundAmplitude / 140);

          _v1.set(bx + waveDispX, by, bz);
          const s = baseScale * (1 + Math.abs(waveDispX) * 2.2);
          _scale.set(s, s, s);
          _mat4.compose(_v1, _quat, _scale);
          this.mediumParticles.setMatrixAt(i, _mat4);
        }
        this.mediumParticles.instanceMatrix.needsUpdate = true;
        this.mediumWasActive = true;
        active = true;
      } else if (this.mediumWasActive) {
        this.resetMediumParticleMatrices();
        this.mediumWasActive = false;
      }
    }

    // 7. Subtle tactile tap bounce animation
    if (this.bounceTimers.size > 0) active = true;
    this.bounceTimers.forEach((rem, id) => {
      const obj = this.objectMap.get(id);
      if (!obj) return;
      const next = rem - dt;
      if (next <= 0) {
        obj.scale.set(1, 1, 1);
        this.bounceTimers.delete(id);
      } else {
        this.bounceTimers.set(id, next);
        const pulse = 1 + Math.sin((next / 0.25) * Math.PI) * 0.055;
        obj.scale.set(pulse, pulse, pulse);
      }
    });

    return active;
  }

  private bindEvents() {
    const canvas = this.renderer.domElement;
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('visibilitychange', this.handleVisibility);
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);
  }

  private handleVisibility = () => {
    if (document.hidden) {
      this.stopLoop();
    } else if (!this.disposed) {
      this.wake(0.6);
    }
  };

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.stopLoop();
    this.callbacks.onWebGLUnavailable?.();
  };

  private handleContextRestored = () => {
    if (!this.disposed) {
      this.wake(1.0);
    }
  };

  private handleResize = () => {
    if (this.disposed) return;
    this.applyPerformanceProfile(this.state.performanceMode);
  };

  private updatePointerNDC(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private raycastInteractive(e: PointerEvent) {
    this.updatePointerNDC(e);
    this.raycaster.setFromCamera(_pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    for (const h of hits) {
      if (h.object.userData?.objectId) {
        return {
          id: h.object.userData.objectId as InteractiveObjectId,
          draggable: Boolean(h.object.userData.draggable),
          root: h.object.userData.rootGroup as THREE.Group,
        };
      }
    }
    return null;
  }

  private handlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    this.wake(1.0);
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
    const hit = this.raycastInteractive(e);
    this.pointerDownObject = hit;
    this.isDraggingObject = false;

    if (hit && hit.draggable) {
      this.updatePointerNDC(e);
      this.raycaster.setFromCamera(_pointer, this.camera);
      if (this.raycaster.ray.intersectPlane(_dragPlane, _dragHit)) {
        _dragOffset.copy(hit.root.position).sub(_dragHit);
      }
      this.controls.enabled = false;
      this.camTransitionActive = false;
      this.callbacks.onDragStatusChange(hit.id);
    }
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (this.disposed) return;

    if (this.pointerDownObject && this.pointerDownObject.draggable) {
      const dx = e.clientX - this.pointerDownPos.x;
      const dy = e.clientY - this.pointerDownPos.y;
      if (dx * dx + dy * dy > 36) {
        this.isDraggingObject = true;
      }
      if (this.isDraggingObject) {
        this.wake(0.8);
        this.updatePointerNDC(e);
        this.raycaster.setFromCamera(_pointer, this.camera);
        if (this.raycaster.ray.intersectPlane(_dragPlane, _dragHit)) {
          const obj = this.pointerDownObject.root;
          const id = this.pointerDownObject.id;
          const minX = id === 'senter' ? -4.6 : -3.55;
          const maxX = id === 'senter' ? -3.65 : -0.65;
          const nextX = THREE.MathUtils.clamp(_dragHit.x + _dragOffset.x, minX, maxX);
          const nextZ = THREE.MathUtils.clamp(_dragHit.z + _dragOffset.z, -1.65, 1.65);

          obj.position.x = nextX;
          obj.position.z = nextZ;
          const target = this.draggableTargets.get(id);
          if (target) target.set(nextX, 0, nextZ);
        }
        this.renderer.domElement.style.cursor = 'grabbing';
        return;
      }
    }

    // Skip hover raycast on touch devices (no mouse hover cursor on HP / PID!)
    if (e.pointerType !== 'mouse') return;

    const now = performance.now();
    if (now - this.lastHoverCheck < 75) return;
    this.lastHoverCheck = now;

    const hit = this.raycastInteractive(e);
    const nextHover = hit ? hit.id : null;
    if (nextHover !== this.hoveredId) {
      this.hoveredId = nextHover;
      this.updateSelectionRings();
      this.renderer.domElement.style.cursor = hit
        ? hit.draggable
          ? 'grab'
          : 'pointer'
        : 'default';
      this.wake(0.3);
    }
  };

  private handlePointerUp = (e: PointerEvent) => {
    const hadDraggable = Boolean(this.pointerDownObject?.draggable);
    if (hadDraggable) {
      this.controls.enabled = true;
      this.callbacks.onDragStatusChange(null);
      this.renderer.domElement.style.cursor = this.hoveredId ? 'grab' : 'default';
    }

    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    const isTap = dx * dx + dy * dy <= 64 && !this.isDraggingObject;

    if (isTap && this.pointerDownObject) {
      const id = this.pointerDownObject.id;
      this.callbacks.onSelectObject(id);
      this.bounceTimers.set(id, 0.25);

      if (id === 'senter') {
        soundEngine.playClick();
        this.callbacks.onToggleFlashlight();
      } else if (id === 'benda_uji') {
        soundEngine.playClick();
        this.callbacks.onCycleMaterialSlab();
      } else if (id === 'garpu_tala' || id === 'gendang' || id === 'bel_vakum') {
        this.triggerSoundInstrument(id);
      } else if (id === 'dinding_akustik') {
        soundEngine.playClick();
        this.callbacks.onToggleAcousticWall();
      } else {
        soundEngine.playClick();
      }
      this.wake(1.0);
    }

    this.pointerDownObject = null;
    this.isDraggingObject = false;
  };

  /** Wake the render loop for at least `seconds` or until all animations settle */
  public wake(seconds = 1.0) {
    if (this.disposed || document.hidden) return;
    this.idleTimer = Math.max(this.idleTimer, seconds);
    if (!this.loopRunning) {
      this.loopRunning = true;
      this.lastTickTime = performance.now();
      this.scheduleNextFrame();
    }
  }

  private stopLoop() {
    this.loopRunning = false;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed || !this.loopRunning) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (status === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private scheduleNextFrame() {
    if (!this.loopRunning || this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private tick = () => {
    if (this.disposed || !this.loopRunning) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastTickTime) / 1000, 0.06);
    this.lastTickTime = now;
    this.elapsedTotal += dt;

    let hasMotion = false;

    if (this.camTransitionActive) {
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.camTargetPos.x, 6.5, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.camTargetPos.y, 6.5, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.camTargetPos.z, 6.5, dt);

      this.controls.target.x = THREE.MathUtils.damp(this.controls.target.x, this.camTargetLook.x, 6.5, dt);
      this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, this.camTargetLook.y, 6.5, dt);
      this.controls.target.z = THREE.MathUtils.damp(this.controls.target.z, this.camTargetLook.z, 6.5, dt);

      if (
        this.camera.position.distanceToSquared(this.camTargetPos) < 0.002 &&
        this.controls.target.distanceToSquared(this.camTargetLook) < 0.002
      ) {
        this.camTransitionActive = false;
      } else {
        hasMotion = true;
      }
    }

    const controlsChanged = this.controls.update();
    if (controlsChanged) hasMotion = true;

    const opticsMoving = this.updateOptics(dt, this.elapsedTotal);
    const acousticsMoving = this.updateAcoustics(dt, this.elapsedTotal);

    this.renderer.render(this.scene, this.camera);

    if (hasMotion || opticsMoving || acousticsMoving || this.isDraggingObject) {
      this.idleTimer = Math.max(this.idleTimer, 0.45);
    } else {
      this.idleTimer -= dt;
    }

    if (this.idleTimer > 0 && !document.hidden) {
      this.scheduleNextFrame();
    } else {
      // Sleep cleanly with 0% GPU/CPU usage until user touches or interacts again
      this.loopRunning = false;
    }
  };

  public dispose() {
    this.disposed = true;
    this.stopLoop();

    const canvas = this.renderer.domElement;
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    canvas.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.controls.dispose();
    this.sharedRingGeo.dispose();
    this.sharedEchoRingGeo.dispose();
    this.sharedArrowGeo.dispose();
    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });
    this.renderer.dispose();
    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}
