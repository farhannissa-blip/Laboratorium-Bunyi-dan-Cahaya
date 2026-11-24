import * as THREE from 'three';

function applyAnisotropy(tex: THREE.CanvasTexture, maxAniso: number, isColor = true) {
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = Math.max(1, maxAniso);
  tex.needsUpdate = true;
  return tex;
}

/** Procedural warm walnut/oak workbench wood albedo + roughness/bump pair */
export function createWoodTextures(maxAniso: number) {
  const w = 512;
  const h = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = w;
  colorCanvas.height = h;
  const ctx = colorCanvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, '#5a3d28');
  grad.addColorStop(0.35, '#69472e');
  grad.addColorStop(0.7, '#583b26');
  grad.addColorStop(1, '#63432b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 240; i++) {
    const y = (i / 240) * h;
    ctx.strokeStyle =
      i % 5 === 0
        ? 'rgba(34, 20, 12, 0.22)'
        : i % 3 === 0
          ? 'rgba(130, 92, 58, 0.14)'
          : 'rgba(42, 26, 15, 0.12)';
    ctx.lineWidth = 1 + (i % 3);
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 32) {
      const wave = Math.sin(x * 0.018 + i * 0.35) * 3.5 + Math.cos(x * 0.045 - i) * 1.4;
      ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(22, 13, 8, 0.38)';
  for (let p = 1; p < 4; p++) {
    ctx.fillRect(0, (p * h) / 4, w, 2);
  }

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = w;
  bumpCanvas.height = h;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, w, h);
  for (let i = 0; i < 180; i++) {
    const y = (i / 180) * h;
    bCtx.strokeStyle = i % 2 === 0 ? 'rgba(205,205,205,0.22)' : 'rgba(55,55,55,0.22)';
    bCtx.lineWidth = 1.5;
    bCtx.beginPath();
    bCtx.moveTo(0, y);
    for (let x = 0; x <= w; x += 40) {
      bCtx.lineTo(x, y + Math.sin(x * 0.02 + i * 0.4) * 3);
    }
    bCtx.stroke();
  }

  const map = applyAnisotropy(new THREE.CanvasTexture(colorCanvas), maxAniso, true);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 1.5);

  const bumpMap = applyAnisotropy(new THREE.CanvasTexture(bumpCanvas), maxAniso, false);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 1.5);

  return { map, bumpMap };
}

/** Procedural brass metric optical ruler strip for the front rail of the bench */
export function createRulerTexture(maxAniso: number) {
  const w = 1024;
  const h = 96;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#c8a662';
  ctx.fillRect(0, 0, w, h);

  for (let y = 0; y < h; y += 2) {
    ctx.fillStyle = y % 4 === 0 ? 'rgba(255,244,210,0.08)' : 'rgba(90,65,25,0.07)';
    ctx.fillRect(0, y, w, 1);
  }

  ctx.strokeStyle = '#2d200d';
  ctx.fillStyle = '#2d200d';
  ctx.font = 'bold 20px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';

  const totalCm = 100;
  for (let i = 0; i <= totalCm; i++) {
    const x = 20 + (i / totalCm) * (w - 40);
    const isMajor = i % 10 === 0;
    const isMid = i % 5 === 0;
    const tickH = isMajor ? 34 : isMid ? 22 : 13;
    ctx.lineWidth = isMajor ? 2.5 : 1.2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, tickH);
    ctx.stroke();

    if (isMajor) {
      ctx.fillText(`${i}`, x, 64);
    }
  }

  ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('SKALA OPTIK (cm)', w - 24, 86);

  return applyAnisotropy(new THREE.CanvasTexture(canvas), maxAniso, true);
}

/** Circular protractor dial for mirror and prism rotation stages */
export function createProtractorTexture(maxAniso: number) {
  const s = 512;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d')!;
  const cx = s / 2;
  const cy = s / 2;

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, s, s);

  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, 236, 0, Math.PI * 2);
  ctx.stroke();

  for (let deg = 0; deg < 360; deg += 5) {
    const rad = (deg * Math.PI) / 180;
    const major = deg % 30 === 0;
    const mid = deg % 15 === 0;
    const rOuter = 226;
    const rInner = major ? 186 : mid ? 202 : 212;
    ctx.strokeStyle = major ? '#f8fafc' : '#94a3b8';
    ctx.lineWidth = major ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rad) * rInner, cy + Math.sin(rad) * rInner);
    ctx.lineTo(cx + Math.cos(rad) * rOuter, cy + Math.sin(rad) * rOuter);
    ctx.stroke();
  }

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const labels = [
    { deg: 0, text: '0°' },
    { deg: 90, text: '90°' },
    { deg: 180, text: '180°' },
    { deg: 270, text: '270°' },
  ];
  for (const item of labels) {
    const rad = (item.deg * Math.PI) / 180;
    ctx.fillText(item.text, cx + Math.cos(rad) * 150, cy + Math.sin(rad) * 150);
  }

  return applyAnisotropy(new THREE.CanvasTexture(canvas), maxAniso, true);
}

/** Graduated mL markings for borosilicate refraction beaker */
export function createBeakerScaleTexture(maxAniso: number) {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(241, 245, 249, 0.85)';
  ctx.fillStyle = 'rgba(241, 245, 249, 0.9)';
  ctx.font = 'bold 18px "JetBrains Mono", monospace';

  const marks = [50, 100, 150, 200, 250];
  marks.forEach((ml, i) => {
    const y = h - 38 - i * 42;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(190, y);
    ctx.lineTo(255, y);
    ctx.stroke();
    ctx.fillText(`${ml} mL`, 264, y + 6);
  });

  ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('AIR (n=1.33)', 186, 26);

  return applyAnisotropy(new THREE.CanvasTexture(canvas), maxAniso, true);
}

/** Vacuum bell jar pressure gauge dial */
export function createPressureGaugeTexture(maxAniso: number) {
  const s = 256;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d')!;
  const cx = s / 2;
  const cy = s / 2;

  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(cx, cy, 120, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 14;
  ctx.strokeStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(cx, cy, 94, Math.PI * 0.78, Math.PI * 1.35);
  ctx.stroke();

  ctx.strokeStyle = '#0ea5e9';
  ctx.beginPath();
  ctx.arc(cx, cy, 94, Math.PI * 1.35, Math.PI * 2.22);
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ATM', cx, cy + 56);
  ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('VAKUM', cx - 54, cy + 16);
  ctx.fillText('1.0', cx + 56, cy + 16);

  return applyAnisotropy(new THREE.CanvasTexture(canvas), maxAniso, true);
}

/** Soft radial contact shadow to ground every instrument flush on the bench */
export function createContactShadowTexture() {
  const s = 256;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(s / 2, s / 2, 10, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(6, 10, 18, 0.72)');
  grad.addColorStop(0.55, 'rgba(6, 10, 18, 0.34)');
  grad.addColorStop(1, 'rgba(6, 10, 18, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Parchment drumhead texture with subtle natural calfskin grain */
export function createParchmentTexture(maxAniso: number) {
  const s = 512;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d')!;
  const cx = s / 2;
  const cy = s / 2;

  const grad = ctx.createRadialGradient(cx, cy, 20, cx, cy, 250);
  grad.addColorStop(0, '#f7ebd2');
  grad.addColorStop(0.75, '#e8d3ad');
  grad.addColorStop(1, '#cba979');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);

  ctx.strokeStyle = 'rgba(130, 92, 46, 0.16)';
  ctx.lineWidth = 2;
  for (let r = 45; r <= 210; r += 40) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  return applyAnisotropy(new THREE.CanvasTexture(canvas), maxAniso, true);
}

/** Architectural poured concrete wall texture (Dinding Beton) */
export function createReflectiveWallTexture(maxAniso: number) {
  const s = 512;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d')!;

  // Cool architectural concrete gradient base
  const grad = ctx.createLinearGradient(0, 0, s, s);
  grad.addColorStop(0, '#bfc7d1');
  grad.addColorStop(0.5, '#adb6c2');
  grad.addColorStop(1, '#9ea8b5');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);

  // Subtle concrete aggregate mineral speckles (deterministic pattern)
  for (let i = 0; i < 1400; i++) {
    const x = (i * 197.3) % s;
    const y = (i * 313.7) % s;
    const sz = 1 + (i % 3);
    ctx.fillStyle =
      i % 2 === 0 ? 'rgba(51, 65, 85, 0.14)' : 'rgba(241, 245, 249, 0.16)';
    ctx.fillRect(x, y, sz, sz);
  }

  // Concrete formwork panel seams
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.42)';
  ctx.lineWidth = 3;
  const rows = 4;
  const cols = 4;
  for (let r = 1; r < rows; r++) {
    const y = (r * s) / rows;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(s, y);
    ctx.stroke();
  }
  for (let c = 1; c < cols; c++) {
    const x = (c * s) / cols;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, s);
    ctx.stroke();
  }

  // Formwork tie-rod recessed dimples on each concrete slab
  ctx.fillStyle = 'rgba(51, 65, 85, 0.5)';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = (c + 0.5) * (s / cols);
      const cy = (r + 0.5) * (s / rows);
      ctx.beginPath();
      ctx.arc(cx - 32, cy, 4.5, 0, Math.PI * 2);
      ctx.arc(cx + 32, cy, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Subtle stenciled label at top of concrete panel
  ctx.fillStyle = 'rgba(30, 41, 59, 0.72)';
  ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DINDING BETON (PEMANTUL)', s / 2, 34);

  return applyAnisotropy(new THREE.CanvasTexture(canvas), maxAniso, true);
}

/** Dynamic projection screen canvas controller — updates spot, rainbow spectrum, blur, or shadow */
export interface ProjectionScreenController {
  texture: THREE.CanvasTexture;
  update: (params: {
    mode: 'none' | 'spot' | 'diffused' | 'shadow' | 'rainbow' | 'refracted';
    intensity: number;
    hitY: number;
    hitZ: number;
  }) => void;
}

export function createProjectionScreenCanvas(maxAniso: number): ProjectionScreenController {
  const w = 512;
  const h = 384;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const texture = applyAnisotropy(new THREE.CanvasTexture(canvas), maxAniso, true);

  let lastKey = '';

  const update: ProjectionScreenController['update'] = ({ mode, intensity, hitY, hitZ }) => {
    const key = `${mode}_${Math.round(intensity * 20)}_${Math.round(hitY * 25)}_${Math.round(hitZ * 25)}`;
    if (key === lastKey) return;
    lastKey = key;

    ctx.fillStyle = '#e5e9f0';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(100, 116, 139, 0.18)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w / 2, 16);
    ctx.lineTo(w / 2, h - 16);
    ctx.moveTo(16, h / 2);
    ctx.lineTo(w - 16, h / 2);
    ctx.stroke();

    const cx = w * (0.5 + hitZ * 0.36);
    const cy = h * (0.5 - hitY * 0.36);
    const alpha = Math.min(1, Math.max(0, intensity));

    if (alpha > 0.02) {
      if (mode === 'spot' || mode === 'refracted') {
        const radius = mode === 'refracted' ? 62 : 52;
        const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, radius);
        g.addColorStop(0, `rgba(255, 250, 215, ${alpha})`);
        g.addColorStop(0.45, `rgba(255, 224, 120, ${alpha * 0.85})`);
        g.addColorStop(1, 'rgba(255, 210, 90, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (mode === 'diffused') {
        const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 128);
        g.addColorStop(0, `rgba(255, 240, 185, ${alpha * 0.55})`);
        g.addColorStop(0.6, `rgba(255, 225, 145, ${alpha * 0.28})`);
        g.addColorStop(1, 'rgba(255, 215, 130, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, 128, 0, Math.PI * 2);
        ctx.fill();
      } else if (mode === 'shadow') {
        const spill = ctx.createRadialGradient(cx, cy, 35, cx, cy, 150);
        spill.addColorStop(0, `rgba(255, 232, 160, ${alpha * 0.52})`);
        spill.addColorStop(1, 'rgba(255, 232, 160, 0)');
        ctx.fillStyle = spill;
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = `rgba(15, 23, 42, ${0.42 + alpha * 0.48})`;
        ctx.fillRect(cx - 52, cy - 64, 104, 128);
      } else if (mode === 'rainbow') {
        const colors = [
          '#ef4444',
          '#f97316',
          '#eab308',
          '#22c55e',
          '#3b82f6',
          '#4f46e5',
          '#9333ea',
        ];
        const bandW = 22;
        const totalW = bandW * colors.length;
        const startX = cx - totalW / 2;
        ctx.save();
        ctx.globalAlpha = Math.min(0.95, alpha * 0.95);
        colors.forEach((col, idx) => {
          const bx = startX + idx * bandW;
          const g = ctx.createLinearGradient(bx, cy - 72, bx, cy + 72);
          g.addColorStop(0, 'rgba(255,255,255,0)');
          g.addColorStop(0.2, col);
          g.addColorStop(0.8, col);
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(bx, cy - 72, bandW + 2, 144);
        });
        ctx.restore();
      }
    }

    ctx.fillStyle = '#334155';
    ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    const modeTitles: Record<typeof mode, string> = {
      none: 'LAYAR PENGAMATAN OPTIK',
      spot: 'BERKAS CAHAYA LURUS',
      diffused: 'CAHAYA TERSEBAR (BENDA BURAM)',
      shadow: 'BAYANGAN TERBENTUK (BENDA GELAP)',
      rainbow: 'SPEKTRUM PELANGI (ME-JI-KU-HI-BI-NI-U)',
      refracted: 'SINAR TERBIASKAN MELALUI AIR',
    };
    ctx.fillText(modeTitles[mode], w / 2, 28);

    texture.needsUpdate = true;
  };

  update({ mode: 'spot', intensity: 0.85, hitY: 0, hitZ: 0 });
  return { texture, update };
}

/** Subtle tiled studio floor texture */
export function createFloorTexture(maxAniso: number) {
  const s = 512;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#141d2e';
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, s / 2, s / 2);
  ctx.strokeRect(s / 2, 0, s / 2, s / 2);
  ctx.strokeRect(0, s / 2, s / 2, s / 2);
  ctx.strokeRect(s / 2, s / 2, s / 2, s / 2);

  const tex = applyAnisotropy(new THREE.CanvasTexture(canvas), maxAniso, true);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  return tex;
}
