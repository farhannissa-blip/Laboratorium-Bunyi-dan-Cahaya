import * as THREE from 'three';
import type { InteractiveObjectId, MaterialSlabType } from '../types/lab';
import {
  createBeakerScaleTexture,
  createContactShadowTexture,
  createFloorTexture,
  createParchmentTexture,
  createPressureGaugeTexture,
  createProjectionScreenCanvas,
  createProtractorTexture,
  createReflectiveWallTexture,
  createRulerTexture,
  createWoodTextures,
  type ProjectionScreenController,
} from './textures';

export interface LabMaterials {
  brass: THREE.MeshPhysicalMaterial;
  chrome: THREE.MeshStandardMaterial;
  castIron: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  darkWood: THREE.MeshStandardMaterial;
  spruceWood: THREE.MeshStandardMaterial;
  glassOptical: THREE.MeshPhysicalMaterial;
  glassDome: THREE.MeshPhysicalMaterial;
  frostedGlass: THREE.MeshStandardMaterial;
  opaqueSlab: THREE.MeshStandardMaterial;
  water: THREE.MeshPhysicalMaterial;
  contactShadowTex: THREE.CanvasTexture;
}

export function createLabMaterials(_isSoftwareGl: boolean, maxAniso: number): LabMaterials {
  const { map: woodMap, bumpMap: woodBump } = createWoodTextures(maxAniso);

  const brass = new THREE.MeshPhysicalMaterial({
    color: 0xd4a64a,
    metalness: 0.92,
    roughness: 0.22,
    clearcoat: 0.3,
    clearcoatRoughness: 0.25,
  });

  const chrome = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.96,
    roughness: 0.12,
  });

  const castIron = new THREE.MeshStandardMaterial({
    color: 0x263142,
    metalness: 0.62,
    roughness: 0.58,
  });

  const rubber = new THREE.MeshStandardMaterial({
    color: 0x1b212c,
    metalness: 0.05,
    roughness: 0.9,
  });

  const darkWood = new THREE.MeshStandardMaterial({
    map: woodMap,
    bumpMap: woodBump,
    bumpScale: 0.012,
    roughness: 0.52,
    metalness: 0.04,
  });

  const spruceWood = new THREE.MeshStandardMaterial({
    color: 0xc99a63,
    roughness: 0.62,
    metalness: 0.02,
  });

  // Crisp single-pass optical glass (avoids expensive full-scene transmission render pass on HP/PID)
  const useTransmission = false;

  const glassOptical = new THREE.MeshPhysicalMaterial({
    color: 0xdff5ff,
    metalness: 0.08,
    roughness: 0.05,
    transmission: useTransmission ? 0.9 : 0,
    ior: 1.52,
    thickness: 0.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.45,
    transparent: true,
    opacity: 0.38,
  });

  const glassDome = new THREE.MeshPhysicalMaterial({
    color: 0xd9f2ff,
    metalness: 0.1,
    roughness: 0.06,
    transmission: useTransmission ? 0.85 : 0,
    ior: 1.48,
    thickness: 0.25,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.4,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });

  const frostedGlass = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    metalness: 0.04,
    roughness: 0.58,
    transparent: true,
    opacity: 0.68,
  });

  const opaqueSlab = new THREE.MeshStandardMaterial({
    color: 0x6b3e26,
    roughness: 0.76,
    metalness: 0.04,
  });

  const water = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    metalness: 0.05,
    roughness: 0.08,
    transmission: useTransmission ? 0.75 : 0,
    ior: 1.33,
    thickness: 0.7,
    envMapIntensity: 1.25,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });

  const contactShadowTex = createContactShadowTexture();

  return {
    brass,
    chrome,
    castIron,
    rubber,
    darkWood,
    spruceWood,
    glassOptical,
    glassDome,
    frostedGlass,
    opaqueSlab,
    water,
    contactShadowTex,
  };
}

function addContactShadow(parent: THREE.Group, tex: THREE.CanvasTexture, width: number, depth: number) {
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.004;
  parent.add(plane);
}

function addRaycastProxy(
  parent: THREE.Group,
  objectId: InteractiveObjectId,
  w: number,
  h: number,
  d: number,
  centerY: number,
  draggable: boolean,
) {
  const proxy = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  proxy.position.y = centerY;
  proxy.layers.enable(1);
  proxy.userData = { objectId, draggable, rootGroup: parent };
  parent.add(proxy);
  return proxy;
}

function addSelectionRing(parent: THREE.Group, radius: number) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.86, radius, 40),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.012;
  ring.name = 'selectionRing';
  parent.add(ring);
  return ring;
}

/** 1. Laboratory Workbench & Room Environment */
export function createLabWorkbench(mats: LabMaterials, maxAniso: number) {
  const group = new THREE.Group();
  group.name = 'workbench';

  const topGeo = new THREE.BoxGeometry(10.6, 0.24, 4.8);
  const tabletop = new THREE.Mesh(topGeo, mats.darkWood);
  tabletop.position.set(0, -0.12, 0);
  tabletop.receiveShadow = true;
  tabletop.castShadow = true;
  group.add(tabletop);

  const trimFront = new THREE.Mesh(new THREE.BoxGeometry(10.68, 0.06, 0.06), mats.brass);
  trimFront.position.set(0, -0.04, 2.41);
  group.add(trimFront);

  const trimBack = trimFront.clone();
  trimBack.position.z = -2.41;
  group.add(trimBack);

  const trimLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 4.88), mats.brass);
  trimLeft.position.set(-5.31, -0.04, 0);
  group.add(trimLeft);

  const trimRight = trimLeft.clone();
  trimRight.position.x = 5.31;
  group.add(trimRight);

  const rulerTex = createRulerTexture(maxAniso);
  const rulerMat = new THREE.MeshStandardMaterial({
    map: rulerTex,
    roughness: 0.34,
    metalness: 0.55,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const ruler = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.28), rulerMat);
  ruler.rotation.x = -Math.PI / 2;
  ruler.position.set(-2.3, 0.003, 2.08);
  ruler.receiveShadow = true;
  group.add(ruler);

  const divider = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.008, 4.2), mats.brass);
  divider.position.set(0.75, 0.004, 0);
  group.add(divider);

  const railGeo = new THREE.BoxGeometry(4.8, 0.025, 0.05);
  const railFront = new THREE.Mesh(railGeo, mats.castIron);
  railFront.position.set(-2.25, 0.012, 0.72);
  const railBack = new THREE.Mesh(railGeo, mats.castIron);
  railBack.position.set(-2.25, 0.012, -0.72);
  group.add(railFront, railBack);

  const legGeo = new THREE.BoxGeometry(0.22, 2.8, 0.22);
  const legCoords: [number, number][] = [
    [-4.8, -2.0],
    [4.8, -2.0],
    [-4.8, 2.0],
    [4.8, 2.0],
  ];
  legCoords.forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, mats.castIron);
    leg.position.set(lx, -1.62, lz);
    leg.castShadow = true;
    group.add(leg);
  });

  const stretcher = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.14, 0.14), mats.castIron);
  stretcher.position.set(0, -2.35, 0);
  group.add(stretcher);

  const floorTex = createFloorTexture(maxAniso);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(48, 48),
    new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.85,
      metalness: 0.08,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -3.02;
  floor.receiveShadow = true;
  group.add(floor);

  return group;
}

/** 2. Optical Laboratory Flashlight Rig (9-part Lathe + Yoke assembly) */
export interface FlashlightRig {
  group: THREE.Group;
  bulbMesh: THREE.Mesh;
  bulbMat: THREE.MeshStandardMaterial;
  powerBtn: THREE.Mesh;
  lensWorldOffset: THREE.Vector3;
}

export function createFlashlightModel(mats: LabMaterials): FlashlightRig {
  const group = new THREE.Group();
  group.name = 'senter';

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.52, 0.09, 28), mats.castIron);
  base.position.y = 0.045;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, 0.52, 16), mats.brass);
  stem.position.y = 0.34;
  stem.castShadow = true;
  group.add(stem);

  const yokeBase = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.44), mats.castIron);
  yokeBase.position.y = 0.62;
  group.add(yokeBase);

  const yokeArmL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.36, 0.05), mats.castIron);
  yokeArmL.position.set(0, 0.8, 0.2);
  const yokeArmR = yokeArmL.clone();
  yokeArmR.position.z = -0.2;
  group.add(yokeArmL, yokeArmR);

  const screwGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.06, 16);
  screwGeo.rotateX(Math.PI / 2);
  const screwL = new THREE.Mesh(screwGeo, mats.brass);
  screwL.position.set(0, 0.94, 0.25);
  const screwR = screwL.clone();
  screwR.position.z = -0.25;
  group.add(screwL, screwR);

  const barrelPoints = [
    new THREE.Vector2(0.0, -0.45),
    new THREE.Vector2(0.15, -0.45),
    new THREE.Vector2(0.16, -0.35),
    new THREE.Vector2(0.155, 0.14),
    new THREE.Vector2(0.24, 0.32),
    new THREE.Vector2(0.25, 0.46),
    new THREE.Vector2(0.21, 0.46),
    new THREE.Vector2(0.17, 0.32),
  ];
  const barrelGeo = new THREE.LatheGeometry(barrelPoints, 28);
  barrelGeo.rotateZ(-Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeo, mats.brass);
  barrel.position.set(0, 0.94, 0);
  barrel.castShadow = true;
  group.add(barrel);

  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.168, 0.168, 0.36, 24).rotateZ(-Math.PI / 2),
    mats.rubber,
  );
  grip.position.set(-0.1, 0.94, 0);
  group.add(grip);

  const powerBtn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.06, 0.07, 16),
    new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35, metalness: 0.1 }),
  );
  powerBtn.position.set(-0.1, 1.12, 0);
  group.add(powerBtn);

  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff7d6,
    emissive: 0xffd25a,
    emissiveIntensity: 2.2,
    roughness: 0.15,
  });
  const bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 16), bulbMat);
  bulbMesh.position.set(0.35, 0.94, 0);
  group.add(bulbMesh);

  const lens = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(-Math.PI / 2),
    mats.glassOptical,
  );
  lens.position.set(0.41, 0.94, 0);
  lens.scale.set(0.35, 1, 1);
  group.add(lens);

  addContactShadow(group, mats.contactShadowTex, 1.25, 1.25);
  addSelectionRing(group, 0.62);
  addRaycastProxy(group, 'senter', 1.15, 1.25, 0.95, 0.62, true);

  return {
    group,
    bulbMesh,
    bulbMat,
    powerBtn,
    lensWorldOffset: new THREE.Vector3(0.48, 0.94, 0),
  };
}

/** 3. Adjustable Plane Mirror (8-part assembly with protractor base & reflective surface) */
export interface MirrorRig {
  group: THREE.Group;
  rotator: THREE.Group;
}

export function createMirrorModel(mats: LabMaterials, maxAniso: number): MirrorRig {
  const group = new THREE.Group();
  group.name = 'cermin';

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.48, 0.08, 32), mats.castIron);
  base.position.y = 0.04;
  base.castShadow = true;
  group.add(base);

  const dial = new THREE.Mesh(
    new THREE.CircleGeometry(0.41, 32).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({
      map: createProtractorTexture(maxAniso),
      roughness: 0.4,
      metalness: 0.2,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  dial.position.y = 0.082;
  group.add(dial);

  const rotator = new THREE.Group();
  group.add(rotator);

  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.36, 16), mats.brass);
  pillar.position.y = 0.25;
  pillar.castShadow = true;
  rotator.add(pillar);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 18), mats.castIron);
  collar.position.y = 0.24;
  rotator.add(collar);

  const frameBack = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.12, 0.92), mats.darkWood);
  frameBack.position.set(0.03, 0.94, 0);
  frameBack.castShadow = true;
  rotator.add(frameBack);

  const trimTop = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.96), mats.brass);
  trimTop.position.set(0.02, 1.5, 0);
  const trimBot = trimTop.clone();
  trimBot.position.y = 0.38;
  const trimL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.14, 0.05), mats.brass);
  trimL.position.set(0.02, 0.94, 0.46);
  const trimR = trimL.clone();
  trimR.position.z = -0.46;
  rotator.add(trimTop, trimBot, trimL, trimR);

  const mirrorMat = new THREE.MeshPhysicalMaterial({
    color: 0xf1f5f9,
    metalness: 0.98,
    roughness: 0.04,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
  });
  const mirrorFace = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 1.04), mirrorMat);
  mirrorFace.rotation.y = -Math.PI / 2;
  mirrorFace.position.set(-0.015, 0.94, 0);
  rotator.add(mirrorFace);

  addContactShadow(group, mats.contactShadowTex, 1.15, 1.15);
  addSelectionRing(group, 0.56);
  addRaycastProxy(group, 'cermin', 0.9, 1.55, 1.0, 0.78, true);

  return { group, rotator };
}

/** 4. Optical Triangular Glass Prism on Brass Pedestal (7-part assembly) */
export function createPrismModel(mats: LabMaterials, maxAniso: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'prisma';

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.44, 0.08, 28), mats.castIron);
  base.position.y = 0.04;
  base.castShadow = true;
  group.add(base);

  const dial = new THREE.Mesh(
    new THREE.CircleGeometry(0.36, 28).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({
      map: createProtractorTexture(maxAniso),
      roughness: 0.4,
      metalness: 0.25,
    }),
  );
  dial.position.y = 0.082;
  group.add(dial);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.36, 18), mats.brass);
  stem.position.y = 0.26;
  stem.castShadow = true;
  group.add(stem);

  const r = 0.42;
  const triShape = new THREE.Shape();
  for (let i = 0; i < 3; i++) {
    const angle = (i * 2 * Math.PI) / 3 + Math.PI / 6;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) triShape.moveTo(x, y);
    else triShape.lineTo(x, y);
  }
  triShape.closePath();

  const capGeo = new THREE.ExtrudeGeometry(triShape, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.015,
    bevelSegments: 2,
  });
  capGeo.rotateX(-Math.PI / 2);
  const bottomCap = new THREE.Mesh(capGeo, mats.brass);
  bottomCap.position.y = 0.44;
  bottomCap.castShadow = true;
  group.add(bottomCap);

  const prismGeo = new THREE.ExtrudeGeometry(triShape, {
    depth: 0.92,
    bevelEnabled: true,
    bevelThickness: 0.016,
    bevelSize: 0.016,
    bevelSegments: 3,
  });
  prismGeo.rotateX(-Math.PI / 2);
  const prismMesh = new THREE.Mesh(prismGeo, mats.glassOptical);
  prismMesh.position.y = 0.49;
  prismMesh.renderOrder = 3;
  group.add(prismMesh);

  const topCap = new THREE.Mesh(capGeo, mats.brass);
  topCap.position.y = 1.42;
  group.add(topCap);

  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), mats.brass);
  finial.position.y = 1.52;
  group.add(finial);

  addContactShadow(group, mats.contactShadowTex, 1.05, 1.05);
  addSelectionRing(group, 0.54);
  addRaycastProxy(group, 'prisma', 0.9, 1.56, 0.9, 0.78, true);

  return group;
}

/** 5. Refraction Water Beaker with Visually Bent Pencil (8-part assembly) */
export interface BeakerRig {
  group: THREE.Group;
  waterSurface: THREE.Mesh;
}

export function createBeakerModel(mats: LabMaterials, maxAniso: number): BeakerRig {
  const group = new THREE.Group();
  group.name = 'gelas';

  const coaster = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.48, 0.05, 28),
    new THREE.MeshStandardMaterial({ color: 0x9c744c, roughness: 0.88, metalness: 0.0 }),
  );
  coaster.position.y = 0.025;
  coaster.receiveShadow = true;
  group.add(coaster);

  const beakerPts = [
    new THREE.Vector2(0.0, 0.05),
    new THREE.Vector2(0.39, 0.05),
    new THREE.Vector2(0.41, 0.09),
    new THREE.Vector2(0.41, 1.24),
    new THREE.Vector2(0.44, 1.3),
    new THREE.Vector2(0.41, 1.31),
    new THREE.Vector2(0.38, 1.24),
    new THREE.Vector2(0.38, 0.09),
  ];
  const beakerMesh = new THREE.Mesh(new THREE.LatheGeometry(beakerPts, 32), mats.glassDome);
  beakerMesh.renderOrder = 4;
  group.add(beakerMesh);

  const scaleMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.414, 0.414, 0.9, 32, 1, true),
    new THREE.MeshBasicMaterial({
      map: createBeakerScaleTexture(maxAniso),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  scaleMesh.position.y = 0.65;
  scaleMesh.renderOrder = 5;
  group.add(scaleMesh);

  const waterBody = new THREE.Mesh(new THREE.CylinderGeometry(0.365, 0.365, 0.84, 28), mats.water);
  waterBody.position.y = 0.51;
  waterBody.renderOrder = 2;
  group.add(waterBody);

  const waterSurface = new THREE.Mesh(
    new THREE.CircleGeometry(0.365, 28).rotateX(-Math.PI / 2),
    new THREE.MeshPhysicalMaterial({
      color: 0x7dd3fc,
      roughness: 0.05,
      metalness: 0.1,
      transparent: true,
      opacity: 0.72,
    }),
  );
  waterSurface.position.y = 0.932;
  waterSurface.renderOrder = 3;
  group.add(waterSurface);

  const pencilMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.45, metalness: 0.05 });
  const woodConeMat = new THREE.MeshStandardMaterial({ color: 0xe7c697, roughness: 0.7 });
  const graphiteMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.3 });
  const eraserMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.75 });

  const upperPencil = new THREE.Group();
  const upperShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.74, 6), pencilMat);
  upperShaft.position.y = 0.37;
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.08, 12), mats.chrome);
  ferrule.position.y = 0.76;
  const eraser = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.09, 12), eraserMat);
  eraser.position.y = 0.84;
  upperPencil.add(upperShaft, ferrule, eraser);
  upperPencil.position.set(-0.04, 0.92, 0.0);
  upperPencil.rotation.z = -0.34;
  group.add(upperPencil);

  const lowerPencil = new THREE.Group();
  const lowerShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.68, 6), pencilMat);
  lowerShaft.position.y = -0.34;
  const tipWood = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.14, 6), woodConeMat);
  tipWood.rotation.x = Math.PI;
  tipWood.position.y = -0.75;
  const tipLead = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.06, 6), graphiteMat);
  tipLead.rotation.x = Math.PI;
  tipLead.position.y = -0.82;
  lowerPencil.add(lowerShaft, tipWood, tipLead);
  lowerPencil.position.set(0.055, 0.91, 0.02);
  lowerPencil.rotation.z = -0.22;
  group.add(lowerPencil);

  addContactShadow(group, mats.contactShadowTex, 1.1, 1.1);
  addSelectionRing(group, 0.56);
  addRaycastProxy(group, 'gelas', 0.95, 1.65, 0.95, 0.82, true);

  return { group, waterSurface };
}

/** 6. Material Test Stand (Benda Bening / Buram / Gelap — 7-part assembly) */
export interface MaterialStandRig {
  group: THREE.Group;
  slabMesh: THREE.Mesh;
  setMaterialType: (type: MaterialSlabType) => void;
}

export function createMaterialStandModel(mats: LabMaterials): MaterialStandRig {
  const group = new THREE.Group();
  group.name = 'benda_uji';

  const base = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.09, 0.98), mats.castIron);
  base.position.y = 0.045;
  base.castShadow = true;
  group.add(base);

  const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 1.38, 14), mats.brass);
  postL.position.set(0, 0.76, 0.44);
  postL.castShadow = true;
  const postR = postL.clone();
  postR.position.z = -0.44;
  group.add(postL, postR);

  const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.98), mats.brass);
  topRail.position.set(0, 1.44, 0);
  const botRail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.98), mats.brass);
  botRail.position.set(0, 0.42, 0);
  group.add(topRail, botRail);

  const knobL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12), mats.brass);
  knobL.position.set(0, 1.5, 0.44);
  const knobR = knobL.clone();
  knobR.position.z = -0.44;
  group.add(knobL, knobR);

  const slabMesh: THREE.Mesh<THREE.BoxGeometry, THREE.Material> = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.96, 0.82),
    mats.glassOptical as THREE.Material,
  );
  slabMesh.position.set(0, 0.93, 0);
  slabMesh.castShadow = true;
  group.add(slabMesh);

  const setMaterialType = (type: MaterialSlabType) => {
    if (type === 'bening') {
      slabMesh.material = mats.glassOptical;
      slabMesh.castShadow = false;
    } else if (type === 'buram') {
      slabMesh.material = mats.frostedGlass;
      slabMesh.castShadow = true;
    } else {
      slabMesh.material = mats.opaqueSlab;
      slabMesh.castShadow = true;
    }
  };

  addContactShadow(group, mats.contactShadowTex, 0.9, 1.25);
  addSelectionRing(group, 0.58);
  addRaycastProxy(group, 'benda_uji', 0.65, 1.55, 1.05, 0.78, true);

  return { group, slabMesh, setMaterialType };
}

/** 7. Optical Projection Screen (6-part assembly with dynamic texture) */
export interface ProjectionScreenRig {
  group: THREE.Group;
  controller: ProjectionScreenController;
}

export function createProjectionScreenModel(mats: LabMaterials, maxAniso: number): ProjectionScreenRig {
  const group = new THREE.Group();
  group.name = 'layar';

  const controller = createProjectionScreenCanvas(maxAniso);

  const footGeo = new THREE.BoxGeometry(0.75, 0.08, 0.14);
  const footL = new THREE.Mesh(footGeo, mats.castIron);
  footL.position.set(0, 0.04, 0.85);
  footL.castShadow = true;
  const footR = footL.clone();
  footR.position.z = -0.85;
  group.add(footL, footR);

  const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.48, 14), mats.brass);
  postL.position.set(0, 0.28, 0.85);
  const postR = postL.clone();
  postR.position.z = -0.85;
  group.add(postL, postR);

  const board = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.55, 2.08), mats.darkWood);
  board.position.set(0.04, 1.15, 0);
  board.castShadow = true;
  board.receiveShadow = true;
  group.add(board);

  const screenMat = new THREE.MeshStandardMaterial({
    map: controller.texture,
    roughness: 0.78,
    metalness: 0.02,
    emissive: 0xffffff,
    emissiveMap: controller.texture,
    emissiveIntensity: 0.28,
  });
  const screenFace = new THREE.Mesh(new THREE.PlaneGeometry(1.92, 1.4), screenMat);
  screenFace.rotation.y = -Math.PI / 2;
  screenFace.position.set(-0.012, 1.15, 0);
  group.add(screenFace);

  addContactShadow(group, mats.contactShadowTex, 1.0, 2.3);
  addSelectionRing(group, 0.9);
  addRaycastProxy(group, 'layar', 0.5, 1.9, 2.15, 0.96, false);

  return { group, controller };
}

/** 8. Tuning Fork on Resonance Box + Articulated Rubber Mallet (8-part assembly) */
export interface TuningForkRig {
  group: THREE.Group;
  prongLeft: THREE.Mesh;
  prongRight: THREE.Mesh;
  malletPivot: THREE.Group;
}

export function createTuningForkModel(mats: LabMaterials): TuningForkRig {
  const group = new THREE.Group();
  group.name = 'garpu_tala';

  const box = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.36, 1.15), mats.spruceWood);
  box.position.y = 0.21;
  box.castShadow = true;
  box.receiveShadow = true;
  group.add(box);

  const cavity = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.22, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x160f0a, roughness: 0.95 }),
  );
  cavity.position.set(0, 0.21, 0.56);
  group.add(cavity);

  const footGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12);
  [
    [-0.3, -0.46],
    [0.3, -0.46],
    [-0.3, 0.46],
    [0.3, 0.46],
  ].forEach(([fx, fz]) => {
    const f = new THREE.Mesh(footGeo, mats.rubber);
    f.position.set(fx, 0.02, fz);
    group.add(f);
  });

  const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.07, 18), mats.brass);
  mount.position.y = 0.42;
  group.add(mount);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.3, 14), mats.chrome);
  stem.position.y = 0.58;
  stem.castShadow = true;
  group.add(stem);

  const shoulderCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.14, 0.85, 0),
    new THREE.Vector3(0, 0.64, 0),
    new THREE.Vector3(0.14, 0.85, 0),
  );
  const shoulder = new THREE.Mesh(new THREE.TubeGeometry(shoulderCurve, 18, 0.034, 12, false), mats.chrome);
  shoulder.castShadow = true;
  group.add(shoulder);

  const prongGeo = new THREE.CylinderGeometry(0.032, 0.034, 0.88, 14);
  prongGeo.translate(0, 0.44, 0);
  const prongLeft = new THREE.Mesh(prongGeo, mats.chrome);
  prongLeft.position.set(-0.14, 0.84, 0);
  prongLeft.castShadow = true;

  const prongRight = new THREE.Mesh(prongGeo, mats.chrome);
  prongRight.position.set(0.14, 0.84, 0);
  prongRight.castShadow = true;
  group.add(prongLeft, prongRight);

  const malletPivot = new THREE.Group();
  malletPivot.position.set(0.55, 0.32, 0.18);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.92, 12), mats.darkWood);
  handle.position.y = 0.46;
  const rubberHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 16, 14),
    new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.72, metalness: 0.05 }),
  );
  rubberHead.position.y = 0.94;
  malletPivot.add(handle, rubberHead);
  malletPivot.rotation.z = -0.22;
  group.add(malletPivot);

  addContactShadow(group, mats.contactShadowTex, 1.15, 1.45);
  addSelectionRing(group, 0.68);
  addRaycastProxy(group, 'garpu_tala', 1.1, 1.75, 1.2, 0.88, false);

  return { group, prongLeft, prongRight, malletPivot };
}

/** 9. Acoustic Drum with Bouncing Rice Grains InstancedMesh (9-part assembly) */
export interface DrumRig {
  group: THREE.Group;
  membrane: THREE.Mesh;
  riceInstanced: THREE.InstancedMesh;
  riceCount: number;
  riceBaseOffsets: Float32Array;
  drumstickPivot: THREE.Group;
}

export function createDrumModel(mats: LabMaterials, maxAniso: number): DrumRig {
  const group = new THREE.Group();
  group.name = 'gendang';

  const legGeo = new THREE.CylinderGeometry(0.04, 0.048, 0.46, 12);
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3 + Math.PI / 6;
    const leg = new THREE.Mesh(legGeo, mats.castIron);
    leg.position.set(Math.cos(a) * 0.46, 0.2, Math.sin(a) * 0.46);
    leg.rotation.z = Math.cos(a) * 0.28;
    leg.rotation.x = -Math.sin(a) * 0.28;
    leg.castShadow = true;
    group.add(leg);
  }

  const shellPts = [
    new THREE.Vector2(0.46, 0.28),
    new THREE.Vector2(0.55, 0.48),
    new THREE.Vector2(0.58, 0.68),
    new THREE.Vector2(0.54, 0.92),
    new THREE.Vector2(0.5, 1.02),
  ];
  const shell = new THREE.Mesh(
    new THREE.LatheGeometry(shellPts, 32),
    new THREE.MeshStandardMaterial({
      color: 0x8b3a2b,
      roughness: 0.46,
      metalness: 0.06,
    }),
  );
  shell.castShadow = true;
  shell.receiveShadow = true;
  group.add(shell);

  const topHoop = new THREE.Mesh(new THREE.TorusGeometry(0.515, 0.028, 12, 36).rotateX(Math.PI / 2), mats.brass);
  topHoop.position.y = 1.01;
  const botHoop = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.024, 12, 36).rotateX(Math.PI / 2), mats.brass);
  botHoop.position.y = 0.29;
  group.add(topHoop, botHoop);

  const lugGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.72, 8);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI * 2) / 8;
    const lug = new THREE.Mesh(lugGeo, mats.chrome);
    lug.position.set(Math.cos(a) * 0.56, 0.65, Math.sin(a) * 0.56);
    group.add(lug);
  }

  const parchmentMat = new THREE.MeshStandardMaterial({
    map: createParchmentTexture(maxAniso),
    roughness: 0.78,
    metalness: 0.02,
  });
  const membrane = new THREE.Mesh(new THREE.CylinderGeometry(0.495, 0.495, 0.02, 24), parchmentMat);
  membrane.position.y = 1.015;
  membrane.receiveShadow = true;
  group.add(membrane);

  const riceCount = 24;
  const riceGeo = new THREE.CapsuleGeometry(0.015, 0.034, 3, 6);
  riceGeo.rotateZ(Math.PI / 2);
  const riceMat = new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.45, metalness: 0.0 });
  const riceInstanced = new THREE.InstancedMesh(riceGeo, riceMat, riceCount);
  riceInstanced.frustumCulled = false;

  const riceBaseOffsets = new Float32Array(riceCount * 3);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < riceCount; i++) {
    const r = Math.sqrt((i + 0.5) / riceCount) * 0.36;
    const theta = i * 2.39996;
    const rx = Math.cos(theta) * r;
    const rz = Math.sin(theta) * r;
    riceBaseOffsets[i * 3] = rx;
    riceBaseOffsets[i * 3 + 1] = rz;
    riceBaseOffsets[i * 3 + 2] = (i * 0.73) % (Math.PI * 2);

    dummy.position.set(rx, 1.038, rz);
    dummy.rotation.set(0, theta, 0);
    dummy.updateMatrix();
    riceInstanced.setMatrixAt(i, dummy.matrix);
  }
  riceInstanced.instanceMatrix.needsUpdate = true;
  group.add(riceInstanced);

  const drumstickPivot = new THREE.Group();
  drumstickPivot.position.set(0.68, 1.05, 0.2);
  const stickShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.024, 0.76, 10).rotateZ(Math.PI / 2),
    mats.spruceWood,
  );
  stickShaft.position.x = -0.35;
  const stickTip = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 10), mats.spruceWood);
  stickTip.position.x = -0.72;
  drumstickPivot.add(stickShaft, stickTip);
  drumstickPivot.rotation.z = -0.35;
  group.add(drumstickPivot);

  addContactShadow(group, mats.contactShadowTex, 1.4, 1.4);
  addSelectionRing(group, 0.72);
  addRaycastProxy(group, 'gendang', 1.25, 1.35, 1.25, 0.65, false);

  return { group, membrane, riceInstanced, riceCount, riceBaseOffsets, drumstickPivot };
}

/** 10. Vacuum Bell Jar & Electric Bell (9-part Lathe dome + gauge + clapper) */
export interface VacuumBellRig {
  group: THREE.Group;
  clapperPivot: THREE.Group;
  gaugeNeedle: THREE.Mesh;
  bellDome: THREE.Mesh;
}

export function createVacuumBellModel(mats: LabMaterials, maxAniso: number): VacuumBellRig {
  const group = new THREE.Group();
  group.name = 'bel_vakum';

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.68, 0.14, 36), mats.darkWood);
  base.position.y = 0.07;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const gasket = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.022, 10, 36).rotateX(Math.PI / 2), mats.rubber);
  gasket.position.y = 0.145;
  group.add(gasket);

  const spigot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.032, 0.24, 12).rotateX(Math.PI / 2),
    mats.brass,
  );
  spigot.position.set(0, 0.08, 0.72);
  group.add(spigot);

  const gaugeCase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.06, 24).rotateX(Math.PI / 2),
    mats.brass,
  );
  gaugeCase.position.set(0.32, 0.18, 0.56);
  group.add(gaugeCase);

  const gaugeFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.125, 24),
    new THREE.MeshBasicMaterial({ map: createPressureGaugeTexture(maxAniso) }),
  );
  gaugeFace.position.set(0.32, 0.18, 0.592);
  group.add(gaugeFace);

  const needleGeo = new THREE.BoxGeometry(0.014, 0.095, 0.01);
  needleGeo.translate(0, 0.038, 0);
  const gaugeNeedle = new THREE.Mesh(needleGeo, new THREE.MeshBasicMaterial({ color: 0xdc2626 }));
  gaugeNeedle.position.set(0.32, 0.18, 0.598);
  gaugeNeedle.rotation.z = -0.8;
  group.add(gaugeNeedle);

  const archCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.28, 0.15, 0),
    new THREE.Vector3(-0.26, 0.96, 0),
    new THREE.Vector3(0, 1.12, 0),
    new THREE.Vector3(0.26, 0.96, 0),
    new THREE.Vector3(0.28, 0.15, 0),
  ]);
  const arch = new THREE.Mesh(new THREE.TubeGeometry(archCurve, 24, 0.024, 10, false), mats.brass);
  group.add(arch);

  const bellDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.58),
    mats.chrome,
  );
  bellDome.position.set(0, 0.72, 0);
  group.add(bellDome);

  const clapperPivot = new THREE.Group();
  clapperPivot.position.set(0.2, 0.44, 0);
  const clapperRod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 8), mats.brass);
  clapperRod.position.y = 0.17;
  const clapperBall = new THREE.Mesh(new THREE.SphereGeometry(0.046, 14, 12), mats.brass);
  clapperBall.position.y = 0.35;
  clapperPivot.add(clapperRod, clapperBall);
  clapperPivot.rotation.z = 0.2;
  group.add(clapperPivot);

  const jarPts: THREE.Vector2[] = [
    new THREE.Vector2(0.55, 0.14),
    new THREE.Vector2(0.53, 0.18),
    new THREE.Vector2(0.52, 0.92),
  ];
  for (let i = 1; i <= 10; i++) {
    const a = (i / 10) * (Math.PI / 2);
    jarPts.push(new THREE.Vector2(Math.cos(a) * 0.52, 0.92 + Math.sin(a) * 0.48));
  }
  const glassJar = new THREE.Mesh(new THREE.LatheGeometry(jarPts, 36), mats.glassDome);
  glassJar.renderOrder = 6;
  group.add(glassJar);

  const topKnob = new THREE.Mesh(new THREE.SphereGeometry(0.085, 18, 14), mats.glassOptical);
  topKnob.position.y = 1.46;
  topKnob.renderOrder = 7;
  group.add(topKnob);

  addContactShadow(group, mats.contactShadowTex, 1.5, 1.5);
  addSelectionRing(group, 0.76);
  addRaycastProxy(group, 'bel_vakum', 1.35, 1.6, 1.35, 0.8, false);

  return { group, clapperPivot, gaugeNeedle, bellDome };
}

/** 11. Acoustic Wall Panel — switches between Hard Reflective Marble (Gema) and Pyramidal Foam (Peredam) */
export interface AcousticWallRig {
  group: THREE.Group;
  reflectiveGroup: THREE.Group;
  absorberGroup: THREE.Group;
  setMode: (mode: 'pantul' | 'serap') => void;
}

export function createAcousticWallModel(mats: LabMaterials, maxAniso: number): AcousticWallRig {
  const group = new THREE.Group();
  group.name = 'dinding_akustik';

  const footL = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.08, 0.14), mats.castIron);
  footL.position.set(0, 0.04, 0.95);
  const footR = footL.clone();
  footR.position.z = -0.95;
  group.add(footL, footR);

  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.68, 2.18), mats.darkWood);
  frame.position.set(0.04, 0.92, 0);
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);

  const reflectiveGroup = new THREE.Group();
  const stoneFace = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 1.54, 2.02),
    new THREE.MeshStandardMaterial({
      map: createReflectiveWallTexture(maxAniso),
      roughness: 0.25,
      metalness: 0.1,
    }),
  );
  stoneFace.position.set(-0.04, 0.92, 0);
  reflectiveGroup.add(stoneFace);
  group.add(reflectiveGroup);

  const absorberGroup = new THREE.Group();
  const foamMat = new THREE.MeshStandardMaterial({
    color: 0x262c38,
    roughness: 0.96,
    metalness: 0.0,
  });
  const backing = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.54, 2.02), foamMat);
  backing.position.set(-0.03, 0.92, 0);
  absorberGroup.add(backing);

  const pyGeo = new THREE.ConeGeometry(0.15, 0.18, 4);
  pyGeo.rotateZ(Math.PI / 2);
  pyGeo.rotateX(Math.PI / 4);
  const rows = 5;
  const cols = 7;
  const foamInstanced = new THREE.InstancedMesh(pyGeo, foamMat, rows * cols);
  const dummy = new THREE.Object3D();
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dummy.position.set(-0.11, 0.34 + r * 0.29, -0.84 + c * 0.28);
      dummy.updateMatrix();
      foamInstanced.setMatrixAt(idx++, dummy.matrix);
    }
  }
  foamInstanced.instanceMatrix.needsUpdate = true;
  foamInstanced.computeBoundingSphere();
  absorberGroup.add(foamInstanced);
  absorberGroup.visible = false;
  group.add(absorberGroup);

  const setMode = (mode: 'pantul' | 'serap') => {
    reflectiveGroup.visible = mode === 'pantul';
    absorberGroup.visible = mode === 'serap';
  };

  addContactShadow(group, mats.contactShadowTex, 0.95, 2.35);
  addSelectionRing(group, 0.95);
  addRaycastProxy(group, 'dinding_akustik', 0.45, 1.75, 2.25, 0.9, false);

  return { group, reflectiveGroup, absorberGroup, setMode };
}
