/* ============================================================
   Planar — Bildflächen-Messung
   Main application script
   ============================================================ */

(() => {

  // ===========================================================
  // Constants
  // ===========================================================

  // Rotating colour palette for multiple main areas
  const AREA_PALETTE = [
    { stroke: '#2878a0', rgb: [40,  120, 160], sub: '#7048a0', subRgb: [112, 72,  160] },
    { stroke: '#a03838', rgb: [160, 56,  56],  sub: '#a05078', subRgb: [160, 80,  120] },
    { stroke: '#287830', rgb: [40,  120, 48],  sub: '#408060', subRgb: [64,  128, 96]  },
    { stroke: '#806820', rgb: [128, 104, 32],  sub: '#a07040', subRgb: [160, 112, 64]  },
  ];

  // ===========================================================
  // State
  // ===========================================================

  const state = {
    img:         null,  // HTMLImageElement (pre-calibration) or rectified <canvas>
    imgOrig:     null,  // always the original HTMLImageElement
    imgW:        0,
    imgH:        0,
    mode:        'idle',  // idle | calibrate | measure
    drawing:     null,    // null | 'main' | 'sub'
    calibPoints: [],      // up to 4 corner points in source-image px coords
    unit:        'cm',
    realW:       null,
    realH:       null,
    scaleX:      1,     // real units per canvas pixel (uniform after calibration)
    scaleY:      1,
    displayScale: 1,
    stretchedW:  0,     // dimensions of the currently displayed image
    stretchedH:  0,
    areas:       [],    // [{ id, name, main: polygon|null, subs: polygon[] }]
    activeAreaIdx: 0,
    cursor:      null,
    fileName:    '',
    panX:        0,
    panY:        0,
    calibration: null,
    calibCollapsed: false,
    projectName: '',
    projectDescription: '',
    _imageDataURL: null,
    _templateBlob: null,
    _templateName: null,
  };

  function activeArea()        { return state.areas[state.activeAreaIdx] || null; }
  function areaColor(i)        { return AREA_PALETTE[i % AREA_PALETTE.length]; }
  function anyMainClosed()     { return state.areas.some(a => a.main && a.main.closed); }
  const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // ===========================================================
  // DOM references
  // ===========================================================

  const $ = (id) => document.getElementById(id);

  // Sidebar — upload
  const fileInput    = $('fileInput');
  const uploadZone   = $('uploadZone');
  const uploadIcon   = $('uploadIcon');
  const uploadTitle  = $('uploadTitle');
  const uploadSub    = $('uploadSub');

  // Sidebar — panels & step pills
  const panel1 = $('panel1'), panel2 = $('panel2'), panel3 = $('panel3');
  const pill1  = $('pill1'),  pill2  = $('pill2'),  pill3  = $('pill3');

  // Sidebar — calibration
  const realW       = $('realW');
  const realH       = $('realH');
  const suffixW     = $('suffixW');
  const suffixH     = $('suffixH');
  const unitSelect  = $('unitSelect');
  const applyCalib  = $('applyCalib');
  const resetCalib  = $('resetCalib');

  // Sidebar — drawing controls
  const drawMainBtn  = $('drawMainBtn');
  const addSubBtn    = $('addSubBtn');
  const drawControls = $('drawControls');
  const undoPoint    = $('undoPoint');
  const cancelDraw   = $('cancelDraw');
  const closeShape   = $('closeShape');
  const clearAll     = $('clearAll');

  // Sidebar — section state
  const mainSection    = $('mainSection');
  const subSection     = $('subSection');
  const mainStatus     = $('mainStatus');
  const subStatus      = $('subStatus');
  const subList        = $('subList');
  const subEmpty       = $('subEmpty');
  const subCountBadge  = $('subCountBadge');

  // Sidebar — stats
  const stats          = $('stats');
  const mainAreaVal    = $('mainAreaVal');
  const subTotalVal    = $('subTotalVal');
  const subTotalCount  = $('subTotalCount');
  const uncoveredVal   = $('uncoveredVal');
  const coverageVal    = $('coverageVal');
  const coverageFill   = $('coverageFill');
  const coverageNote   = $('coverageNote');
  const unitMain       = $('unitMain');
  const unitSub        = $('unitSub');
  const unitUnc        = $('unitUnc');

  // Canvas area
  const emptyMsg       = $('emptyMsg');
  const canvasWrap     = $('canvasWrap');
  const imgCanvas      = $('imgCanvas');
  const overlay        = $('overlay');
  const toolbar        = $('toolbar');
  const modeBanner     = $('modeBanner');
  const modeBannerText = $('modeBannerText');
  const zoomLevel      = $('zoomLevel');
  const stage          = $('stage');
  const closeFab       = $('closeFab');
  const closeFabLabel  = $('closeFabLabel');

  // Area management
  const areaList             = $('areaList');
  const addAreaBtn           = $('addAreaBtn');
  const activeAreaNameDisplay = $('activeAreaNameDisplay');
  const mainSwatch           = $('mainSwatch');

  // Continue project
  const continueProjBtn  = $('continueProjBtn');
  const continueProjName = $('continueProjName');
  const continueProjDate = $('continueProjDate');

  // Template
  const templateFileInput    = $('templateFileInput');
  const clearTemplateBtn     = $('clearTemplateBtn');
  const templateFileNameEl   = $('templateFileName');
  const templateFileNameText = $('templateFileNameText');

  // Status bar
  const statImage     = $('statImage');
  const statScale     = $('statScale');
  const statScaleWrap = $('statScaleWrap');
  const statCursor    = $('statCursor');
  const statDrawing   = $('statDrawing');
  const statMode      = $('statMode');

  const ictx = imgCanvas.getContext('2d');
  const octx = overlay.getContext('2d');

  // Calibration collapse
  const panel2Toggle    = $('panel2Toggle');
  const panel2Chevron   = $('panel2Chevron');
  const panel2Body      = $('panel2Body');
  const calibSummaryEl  = $('calibSummaryEl');

  // Project management
  const projLauncher     = $('projLauncher');
  const projOptions      = $('projOptions');
  const newProjBtn       = $('newProjBtn');
  const newProjForm      = $('newProjForm');
  const projectNameInput = $('projectNameInput');
  const projectDescInput = $('projectDescInput');
  const startProjBtn     = $('startProjBtn');
  const backProjBtn      = $('backProjBtn');
  const planerFileInput  = $('planerFileInput');
  const saveProjBtn         = $('saveProjBtn');
  const topbarProject       = $('topbarProject');
  const topbarProjName      = $('topbarProjName');
  const backToLauncherBtn   = $('backToLauncherBtn');
  const leaveModal          = $('leaveModal');
  const modalCancelBtn      = $('modalCancelBtn');
  const modalDiscardBtn     = $('modalDiscardBtn');
  const modalSaveBtn        = $('modalSaveBtn');

  // Project info panel (in-app)
  const projInfoPanel   = $('projInfoPanel');
  const projInfoToggle  = $('projInfoToggle');
  const projInfoChevron = $('projInfoChevron');
  const projInfoBody    = $('projInfoBody');
  const projInfoName    = $('projInfoName');
  const projDescEdit    = $('projDescEdit');

  // ===========================================================
  // Math — polygon geometry
  // ===========================================================

  function polygonAreaPx(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      s += a.x * b.y - b.x * a.y;
    }
    return Math.abs(s) / 2;
  }

  function polygonRealArea(pts) {
    return polygonAreaPx(pts) * state.scaleX * state.scaleY;
  }

  function polygonRealPerimeter(pts, closed) {
    let s = 0;
    const n = pts.length;
    for (let i = 0; i < n - (closed ? 0 : 1); i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      s += Math.hypot(a.x - b.x, a.y - b.y);
    }
    return s * state.scaleX;
  }

  function fmt(n) {
    if (!isFinite(n)) return '–';
    if (n === 0) return '0';
    const abs = Math.abs(n);
    if (abs >= 10000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
    if (abs >= 100)   return n.toFixed(1);
    if (abs >= 1)     return n.toFixed(2);
    return n.toPrecision(3);
  }

  // ===========================================================
  // Math — perspective / homography
  // ===========================================================

  // Solve N×N linear system Ax = b via Gaussian elimination with partial pivoting.
  function solveLinear(A, b) {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
      let pr = col;
      for (let r = col + 1; r < n; r++) {
        if (Math.abs(M[r][col]) > Math.abs(M[pr][col])) pr = r;
      }
      if (Math.abs(M[pr][col]) < 1e-12) return null;
      if (pr !== col) { const t = M[col]; M[col] = M[pr]; M[pr] = t; }
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const f = M[r][col] / M[col][col];
        if (f === 0) continue;
        for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
      }
    }
    const x = new Array(n);
    for (let i = 0; i < n; i++) x[i] = M[i][n] / M[i][i];
    return x;
  }

  // Compute 3×3 homography H mapping src[i] → dst[i] (4 point pairs). H₃₃ = 1.
  function computeHomography(src, dst) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const sp = src[i], dp = dst[i];
      A.push([sp.x, sp.y, 1, 0, 0, 0, -dp.x * sp.x, -dp.x * sp.y]); b.push(dp.x);
      A.push([0, 0, 0, sp.x, sp.y, 1, -dp.y * sp.x, -dp.y * sp.y]); b.push(dp.y);
    }
    const h = solveLinear(A, b);
    if (!h) return null;
    return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
  }

  function applyH(H, x, y) {
    const w = H[6] * x + H[7] * y + H[8];
    return { x: (H[0] * x + H[1] * y + H[2]) / w, y: (H[3] * x + H[4] * y + H[5]) / w };
  }

  // Invert a 3×3 matrix.
  function invert3(M) {
    const [a, b, c, d, e, f, g, h, i] = M;
    const A =  (e*i - f*h), B = -(d*i - f*g), C =  (d*h - e*g);
    const D = -(b*i - c*h), E =  (a*i - c*g), F_ = -(a*h - b*g);
    const G =  (b*f - c*e), H_ = -(a*f - c*d), I =  (a*e - b*d);
    const det = a*A + b*B + c*C;
    if (Math.abs(det) < 1e-12) return null;
    const inv = 1 / det;
    return [A*inv, D*inv, G*inv, B*inv, E*inv, H_*inv, C*inv, F_*inv, I*inv];
  }

  // Solve 3-point affine transform for ctx.setTransform().
  function solveAffine(ss1, ss2, ss3, sd1, sd2, sd3) {
    const v1x = ss2.x - ss1.x, v1y = ss2.y - ss1.y;
    const v2x = ss3.x - ss1.x, v2y = ss3.y - ss1.y;
    const det = v1x * v2y - v2x * v1y;
    if (Math.abs(det) < 1e-9) return null;
    const inv00 =  v2y / det, inv01 = -v2x / det;
    const inv10 = -v1y / det, inv11 =  v1x / det;
    const w1x = sd2.x - sd1.x, w1y = sd2.y - sd1.y;
    const w2x = sd3.x - sd1.x, w2y = sd3.y - sd1.y;
    const a = w1x*inv00 + w2x*inv10, c = w1x*inv01 + w2x*inv11;
    const b = w1y*inv00 + w2y*inv10, d = w1y*inv01 + w2y*inv11;
    const e = sd1.x - a*ss1.x - c*ss1.y, f = sd1.y - b*ss1.x - d*ss1.y;
    return { a, b, c, d, e, f };
  }

  // Warp srcImg onto dstCanvas via inverse homography Hinv.
  // Uses a piecewise-affine grid approximation (grid×grid cells, each split into 2 triangles).
  function warpImageInverse(srcImg, dstCanvas, dstW, dstH, Hinv, grid = 50) {
    const ctx = dstCanvas.getContext('2d');
    ctx.save();
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, dstW, dstH);

    // Pre-compute source-position at every grid vertex
    const sx = new Float64Array((grid + 1) * (grid + 1));
    const sy = new Float64Array((grid + 1) * (grid + 1));
    for (let j = 0; j <= grid; j++) {
      for (let i = 0; i <= grid; i++) {
        const s = applyH(Hinv, i * dstW / grid, j * dstH / grid);
        const idx = j * (grid + 1) + i;
        sx[idx] = s.x; sy[idx] = s.y;
      }
    }

    const drawTri = (s1, s2, s3, d1, d2, d3) => {
      const aff = solveAffine(s1, s2, s3, d1, d2, d3);
      if (!aff) return;
      ctx.save();
      ctx.beginPath();
      // 0.5px outset fills hairline seams between adjacent triangles
      const cx = (d1.x + d2.x + d3.x) / 3, cy = (d1.y + d2.y + d3.y) / 3;
      const outset = (p) => {
        const dx = p.x - cx, dy = p.y - cy, len = Math.hypot(dx, dy) || 1;
        return { x: p.x + 0.5 * dx / len, y: p.y + 0.5 * dy / len };
      };
      const [o1, o2, o3] = [outset(d1), outset(d2), outset(d3)];
      ctx.moveTo(o1.x, o1.y); ctx.lineTo(o2.x, o2.y); ctx.lineTo(o3.x, o3.y);
      ctx.closePath(); ctx.clip();
      ctx.setTransform(aff.a, aff.b, aff.c, aff.d, aff.e, aff.f);
      ctx.drawImage(srcImg, 0, 0);
      ctx.restore();
    };

    for (let j = 0; j < grid; j++) {
      for (let i = 0; i < grid; i++) {
        const i00 = j * (grid + 1) + i;
        const i10 = i00 + 1, i01 = (j + 1) * (grid + 1) + i, i11 = i01 + 1;
        const ss00 = { x: sx[i00], y: sy[i00] }, ss10 = { x: sx[i10], y: sy[i10] };
        const ss11 = { x: sx[i11], y: sy[i11] }, ss01 = { x: sx[i01], y: sy[i01] };
        const dd00 = { x: i     * dstW / grid, y: j     * dstH / grid };
        const dd10 = { x: (i+1) * dstW / grid, y: j     * dstH / grid };
        const dd11 = { x: (i+1) * dstW / grid, y: (j+1) * dstH / grid };
        const dd01 = { x: i     * dstW / grid, y: (j+1) * dstH / grid };
        drawTri(ss00, ss10, ss11, dd00, dd10, dd11);
        drawTri(ss00, ss11, ss01, dd00, dd11, dd01);
      }
    }
    ctx.restore();
  }

  // ===========================================================
  // Rendering
  // ===========================================================

  function drawImage() {
    if (!state.img) return;
    ictx.imageSmoothingQuality = 'high';
    ictx.clearRect(0, 0, imgCanvas.width, imgCanvas.height);
    ictx.drawImage(state.img, 0, 0, state.stretchedW, state.stretchedH);
  }

  // Draw a path twice: thick dark shadow + thinner coloured line.
  function strokeWithHalo(ctx, drawPathFn, color, baseWidth) {
    ctx.lineWidth = baseWidth + 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    drawPathFn(); ctx.stroke();
    ctx.lineWidth = baseWidth;
    ctx.strokeStyle = color;
    drawPathFn(); ctx.stroke();
  }

  function drawHandle(ctx, x, y, color, size = 3) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.beginPath(); ctx.arc(x, y, size + 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x, y, size + 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, size - 0.2, 0, Math.PI * 2); ctx.fill();
  }

  function drawLabel(ctx, x, y, text, color) {
    ctx.save();
    ctx.font = 'bold 13px ui-monospace, "Cascadia Code", Consolas, monospace';
    const w = Math.max(ctx.measureText(text).width, 10);
    const padX = 7, padY = 4, bw = w + padX * 2, bh = 13 + padY * 2;
    const bx = x - bw / 2, by = y - bh / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 5); else ctx.rect(bx, by, bw, bh);
    ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 5); else ctx.rect(bx, by, bw, bh);
    ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 0.5);
    ctx.restore();
  }

  function centroid(pts) {
    let cx = 0, cy = 0, a = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p1 = pts[i], p2 = pts[(i + 1) % n];
      const cross = p1.x * p2.y - p2.x * p1.y;
      a += cross;
      cx += (p1.x + p2.x) * cross;
      cy += (p1.y + p2.y) * cross;
    }
    a /= 2;
    if (Math.abs(a) < 1e-6) {
      cx = 0; cy = 0;
      pts.forEach(p => { cx += p.x; cy += p.y; });
      return { x: cx / n, y: cy / n };
    }
    return { x: cx / (6 * a), y: cy / (6 * a) };
  }

  function drawPolygon(shape, color, opts = {}) {
    const pts = shape.points;
    if (!pts.length) return;
    const closed = shape.closed;

    if (closed) {
      octx.fillStyle = `rgba(${opts.rgb.join(',')},${opts.fillAlpha ?? 0.18})`;
      octx.beginPath();
      octx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) octx.lineTo(pts[i].x, pts[i].y);
      octx.closePath(); octx.fill();
    }

    const drawPath = () => {
      octx.beginPath();
      octx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) octx.lineTo(pts[i].x, pts[i].y);
      if (closed) octx.closePath();
    };
    strokeWithHalo(octx, drawPath, color, opts.lineWidth ?? 3);

    pts.forEach((p, i) => drawHandle(octx, p.x, p.y, color, i === 0 ? 4 : 3));

    // Dashed ring around first point when shape can be closed
    if (!closed && opts.isCurrent && pts.length >= 3) {
      octx.save();
      octx.strokeStyle = color; octx.lineWidth = 1.5; octx.setLineDash([3, 3]);
      octx.beginPath(); octx.arc(pts[0].x, pts[0].y, 10, 0, Math.PI * 2); octx.stroke();
      octx.restore();
    }
  }

  function drawOverlay() {
    octx.clearRect(0, 0, overlay.width, overlay.height);

    // Calibration corners (only visible while actively calibrating)
    if (state.mode === 'calibrate' && state.calibPoints.length > 0) {
      const pts = state.calibPoints;
      octx.save();
      if (pts.length === 4) {
        octx.fillStyle = 'rgba(140,80,30,0.10)';
        octx.beginPath(); octx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < 4; i++) octx.lineTo(pts[i].x, pts[i].y);
        octx.closePath(); octx.fill();
      }
      if (pts.length >= 2) {
        const drawQuad = () => {
          octx.setLineDash([10, 6]);
          octx.beginPath(); octx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) octx.lineTo(pts[i].x, pts[i].y);
          if (pts.length === 4) octx.closePath();
        };
        strokeWithHalo(octx, drawQuad, '#a06030', 3);
        octx.setLineDash([]);
      }
      pts.forEach((p, i) => {
        drawHandle(octx, p.x, p.y, '#a06030', 4);
        octx.save();
        octx.font = 'bold 11px ui-monospace, "Cascadia Code", Consolas, monospace';
        octx.fillStyle = 'rgba(0,0,0,0.85)';
        octx.beginPath();
        if (octx.roundRect) octx.roundRect(p.x + 8, p.y - 9, 16, 16, 4); else octx.rect(p.x + 8, p.y - 9, 16, 16);
        octx.fill();
        octx.strokeStyle = '#a06030'; octx.lineWidth = 1.25;
        octx.beginPath();
        if (octx.roundRect) octx.roundRect(p.x + 8, p.y - 9, 16, 16, 4); else octx.rect(p.x + 8, p.y - 9, 16, 16);
        octx.stroke();
        octx.fillStyle = '#fff'; octx.textAlign = 'center'; octx.textBaseline = 'middle';
        octx.fillText(String(i + 1), p.x + 16, p.y - 1);
        octx.restore();
      });
      octx.restore();
    }

    // Draw all areas (inactive ones slightly dimmed)
    state.areas.forEach((area, aIdx) => {
      const col = areaColor(aIdx);
      const isActive = aIdx === state.activeAreaIdx;
      const mainAlpha = isActive ? 0.13 : 0.07;
      const subAlpha  = isActive ? 0.20 : 0.10;
      const lw        = isActive ? 3.5 : 2.2;

      if (area.main && area.main.points.length) {
        drawPolygon(area.main, col.stroke, {
          rgb: col.rgb, fillAlpha: mainAlpha, lineWidth: lw,
          isCurrent: isActive && state.drawing === 'main',
        });
      }
      area.subs.forEach((sub, i) => {
        const isCur = isActive && state.drawing === 'sub' && i === area.subs.length - 1;
        drawPolygon(sub, col.sub, {
          rgb: col.subRgb, fillAlpha: subAlpha, lineWidth: isActive ? 2.8 : 1.8,
          isCurrent: isCur,
        });
        if (sub.closed && sub.points.length >= 3) {
          drawLabel(octx, centroid(sub.points).x, centroid(sub.points).y, `${i + 1}`, col.sub);
        }
      });
    });

    // Preview line for the shape being drawn
    if (state.drawing && state.cursor) {
      const shape = currentShape();
      if (shape && shape.points.length) {
        const last = shape.points[shape.points.length - 1];
        const col = areaColor(state.activeAreaIdx);
        const color = state.drawing === 'main'
          ? `rgba(${col.rgb[0]},${col.rgb[1]},${col.rgb[2]},0.80)`
          : `rgba(${col.subRgb[0]},${col.subRgb[1]},${col.subRgb[2]},0.80)`;
        const drawPreview = () => {
          octx.setLineDash([6, 5]);
          octx.beginPath(); octx.moveTo(last.x, last.y); octx.lineTo(state.cursor.x, state.cursor.y);
        };
        octx.save();
        strokeWithHalo(octx, drawPreview, color, 2);
        octx.setLineDash([]);
        octx.restore();
      }
    }

    drawScaleBar();
  }

  function drawScaleBar() {
    if (!state.calibration || state.mode !== 'measure') return;

    // Pick a nice round value close to 100 screen pixels wide
    const targetReal = (100 / state.displayScale) * state.scaleX;
    const mag = Math.pow(10, Math.floor(Math.log10(targetReal)));
    let nice = mag;
    if      (targetReal / mag >= 5) nice = 5 * mag;
    else if (targetReal / mag >= 2) nice = 2 * mag;
    const barPx = nice / state.scaleX;

    const x = 16, yBase = overlay.height - 14;
    const yBar = yBase - 5, yTick0 = yBar - 5, yTick1 = yBar + 5, yText = yBar - 8;
    const label = `${fmt(nice)} ${state.unit}`;

    octx.save();
    octx.font = '600 11px ui-monospace, "Cascadia Code", Consolas, monospace';

    // Background
    octx.fillStyle = 'rgba(10,10,10,0.52)';
    const bgX = x - 9, bgY = yText - 12, bgW = barPx + 18, bgH = yBase - bgY + 1;
    if (octx.roundRect) octx.roundRect(bgX, bgY, bgW, bgH, 4);
    else octx.rect(bgX, bgY, bgW, bgH);
    octx.fill();

    // Label
    octx.fillStyle = 'rgba(255,255,255,0.92)';
    octx.textAlign = 'center';
    octx.textBaseline = 'alphabetic';
    octx.fillText(label, x + barPx / 2, yText);

    // Bar + ticks
    octx.strokeStyle = 'rgba(255,255,255,0.90)';
    octx.lineWidth = 2;
    octx.lineCap = 'butt';
    octx.beginPath();
    octx.moveTo(x, yBar); octx.lineTo(x + barPx, yBar);
    octx.stroke();
    octx.lineWidth = 1.5;
    octx.beginPath();
    octx.moveTo(x,         yTick0); octx.lineTo(x,         yTick1);
    octx.moveTo(x + barPx, yTick0); octx.lineTo(x + barPx, yTick1);
    octx.stroke();

    octx.restore();
  }

  function render() { drawImage(); drawOverlay(); }

  // Coalesce multiple drawOverlay calls into one animation frame (prevents Firefox thrashing).
  let _overlayFrame = 0;
  function scheduleOverlay() {
    if (_overlayFrame) return;
    _overlayFrame = requestAnimationFrame(() => { _overlayFrame = 0; drawOverlay(); });
  }

  // ===========================================================
  // Zoom & pan
  // ===========================================================

  const MIN_ZOOM = 0.05, MAX_ZOOM = 32;

  function setCanvasSize(w, h) {
    imgCanvas.width = w; imgCanvas.height = h;
    overlay.width = w; overlay.height = h;
    applyDisplayScale();
  }

  function applyDisplayScale() {
    const w = (imgCanvas.width  * state.displayScale) + 'px';
    const h = (imgCanvas.height * state.displayScale) + 'px';
    imgCanvas.style.width  = w; imgCanvas.style.height  = h;
    overlay.style.width    = w; overlay.style.height    = h;
    zoomLevel.textContent  = Math.round(state.displayScale * 100) + '%';
  }

  function applyPan() {
    canvasWrap.style.transform = `translate(${state.panX}px, ${state.panY}px)`;
  }

  function centerInStage() {
    const w = state.stretchedW || state.imgW;
    const h = state.stretchedH || state.imgH;
    state.panX = (stage.clientWidth  - w * state.displayScale) / 2;
    state.panY = (stage.clientHeight - h * state.displayScale) / 2;
    applyPan();
  }

  function fitToView() {
    const pad = 80;
    const w = state.stretchedW || state.imgW;
    const h = state.stretchedH || state.imgH;
    if (!w || !h) return;
    state.displayScale = Math.max(0.05, Math.min(
      (stage.clientWidth  - pad) / w,
      (stage.clientHeight - pad) / h,
      1
    ));
    setCanvasSize(w, h);
    centerInStage();
    if (state.img) render();
  }

  // Zoom centered on a screen point, keeping the canvas coordinate under the cursor fixed.
  function zoomAt(newScale, clientX, clientY) {
    if (!state.img) return;
    newScale = Math.max(MIN_ZOOM, Math.min(newScale, MAX_ZOOM));
    if (newScale === state.displayScale) return;
    const rect = stage.getBoundingClientRect();
    const sx = clientX - rect.left, sy = clientY - rect.top;
    const cx = (sx - state.panX) / state.displayScale;
    const cy = (sy - state.panY) / state.displayScale;
    state.displayScale = newScale;
    applyDisplayScale();
    state.panX = sx - cx * state.displayScale;
    state.panY = sy - cy * state.displayScale;
    applyPan();
  }

  function zoomCenter(newScale) {
    const rect = stage.getBoundingClientRect();
    zoomAt(newScale, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  $('zoomIn') .addEventListener('click', () => zoomCenter(state.displayScale * 1.25));
  $('zoomOut').addEventListener('click', () => zoomCenter(state.displayScale / 1.25));
  $('zoomFit').addEventListener('click', () => fitToView());

  // Wheel zoom — intercept before the browser's own page-zoom.
  stage.addEventListener('wheel', (e) => {
    if (!state.img) return;
    e.preventDefault();
    const intensity = e.ctrlKey ? 0.02 : 0.0015;
    zoomAt(state.displayScale * Math.exp(-e.deltaY * intensity), e.clientX, e.clientY);
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (!state.img) return;
    if (!(e.ctrlKey || e.metaKey)) return;
    if      (e.key === '+' || e.key === '=') { e.preventDefault(); zoomCenter(state.displayScale * 1.25); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomCenter(state.displayScale / 1.25); }
    else if (e.key === '0')                  { e.preventDefault(); fitToView(); }
  });

  window.addEventListener('resize', () => { if (state.img) fitToView(); });

  // ===========================================================
  // Panning (middle-mouse or right-mouse drag)
  // ===========================================================

  let panState = null, panMoved = false;
  let dragState = null, dragMoved = false, _mousedownOnPoint = false;

  const isPanTrigger = (e) => e.button === 1 || e.button === 2;

  overlay.addEventListener('contextmenu', (e) => { if (state.img) e.preventDefault(); });

  overlay.addEventListener('mousedown', (e) => {
    if (state.img && e.button === 0) {
      const p = eventToCanvas(e);
      const found = findNearPoint(p);
      if (found) {
        dragState = found;
        dragMoved = false;
        _mousedownOnPoint = true;
        overlay.style.cursor = 'grabbing';
        return;
      }
    }
    if (state.img && isPanTrigger(e)) {
      e.preventDefault();
      panState = { startX: e.clientX, startY: e.clientY, startPanX: state.panX, startPanY: state.panY };
      panMoved = false;
      overlay.classList.add('panning');
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (dragState) {
      const p = eventToCanvas(e);
      dragState.shape.points[dragState.idx] = p;
      dragMoved = true;
      scheduleOverlay();
      return;
    }
    if (!panState) return;
    const dx = e.clientX - panState.startX, dy = e.clientY - panState.startY;
    if (Math.abs(dx) + Math.abs(dy) > 2) panMoved = true;
    state.panX = panState.startPanX + dx;
    state.panY = panState.startPanY + dy;
    applyPan();
  });

  window.addEventListener('mouseup', () => {
    if (dragState) {
      const wasMoved = dragMoved;
      dragState = null;
      overlay.style.cursor = '';
      setTimeout(() => { dragMoved = false; _mousedownOnPoint = false; }, 0);
      if (wasMoved) { drawOverlay(); setSteps(); persistState(); }
      return;
    }
    if (!panState) return;
    panState = null;
    overlay.classList.remove('panning');
    setTimeout(() => { panMoved = false; }, 0);
  });

  // ===========================================================
  // Cursor tracking
  // ===========================================================

  function eventToCanvas(e) {
    const rect = overlay.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / state.displayScale, y: (e.clientY - rect.top) / state.displayScale };
  }

  let _cursorFrame = 0;
  function updateCursorReadout(p) {
    if (_cursorFrame) return;
    _cursorFrame = requestAnimationFrame(() => {
      _cursorFrame = 0;
      if (state.scaleX !== 1 || state.scaleY !== 1) {
        statCursor.textContent = `${(p.x * state.scaleX).toFixed(1)}, ${(p.y * state.scaleY).toFixed(1)} ${state.unit}`;
      } else {
        statCursor.textContent = `${Math.round(p.x)}, ${Math.round(p.y)} px`;
      }
    });
  }

  overlay.addEventListener('mousemove', (e) => {
    if (panState) return;
    const p = eventToCanvas(e);
    state.cursor = p;
    updateCursorReadout(p);
    if (state.drawing) scheduleOverlay();
    if (!dragState) {
      const near = findNearPoint(p);
      overlay.style.cursor = near ? 'grab' : '';
    }
  });

  overlay.addEventListener('mouseleave', () => {
    state.cursor = null;
    statCursor.textContent = '—';
    if (state.drawing) scheduleOverlay();
    if (!dragState) overlay.style.cursor = '';
  });

  // ===========================================================
  // UI state
  // ===========================================================

  function currentShape() {
    const area = activeArea();
    if (!area) return null;
    if (state.drawing === 'main') return area.main;
    if (state.drawing === 'sub')  return area.subs[area.subs.length - 1];
    return null;
  }

  function findNearPoint(canvasP) {
    if (state.drawing || state.mode !== 'measure') return null;
    const HIT = 14;
    let best = null, bestDist = Infinity;
    const check = (shape) => {
      if (!shape || !shape.closed) return;
      shape.points.forEach((pt, idx) => {
        const d = Math.hypot((pt.x - canvasP.x) * state.displayScale, (pt.y - canvasP.y) * state.displayScale);
        if (d < HIT && d < bestDist) { bestDist = d; best = { shape, idx }; }
      });
    };
    state.areas.forEach(a => { if (a.main) check(a.main); a.subs.forEach(s => check(s)); });
    return best;
  }

  function setSteps() {
    [pill1, pill2, pill3].forEach(p => p.classList.remove('active', 'done'));
    [panel1, panel2, panel3].forEach(p => p.classList.remove('disabled'));

    if (state.mode === 'idle') {
      pill1.classList.add('active');
      panel2.classList.add('disabled');
      panel3.classList.add('disabled');
      modeBanner.style.display = 'none';
    } else if (state.mode === 'calibrate') {
      pill1.classList.add('done');
      pill2.classList.add('active');
      panel3.classList.add('disabled');
    } else {
      pill1.classList.add('done');
      pill2.classList.add('done');
      pill3.classList.add('active');
    }

    // Mode banner text
    if (state.mode === 'calibrate') {
      modeBanner.style.display = 'flex';
      modeBanner.classList.remove('main', 'sub');
      const n = state.calibPoints.length;
      const labels = ['oben links', 'oben rechts', 'unten rechts', 'unten links'];
      modeBannerText.innerHTML = n < 4
        ? `Eckpunkt <b>${n + 1}/4</b> eines bekannten Rechtecks anklicken (<b>${labels[n]}</b>)`
        : 'Alle 4 Eckpunkte gesetzt — reale Maße eingeben und auf <b>Entzerren &amp; anwenden</b> klicken';
    } else if (state.drawing === 'main') {
      modeBanner.style.display = 'flex';
      modeBanner.classList.add('main'); modeBanner.classList.remove('sub');
      modeBannerText.innerHTML = `<b>${esc(activeArea()?.name || 'Hauptfläche')}</b> zeichnen · ersten Punkt anklicken oder <kbd>Enter</kbd> zum Schließen`;
    } else if (state.drawing === 'sub') {
      modeBanner.style.display = 'flex';
      modeBanner.classList.add('sub'); modeBanner.classList.remove('main');
      modeBannerText.innerHTML = `<b>Teilfläche #${activeArea()?.subs.length}</b> zeichnen · ersten Punkt anklicken oder <kbd>Enter</kbd> zum Schließen`;
    } else if (state.mode === 'measure') {
      modeBanner.style.display = 'none';
    }

    // Status bar
    let modeText = 'Bereit';
    if (state.mode === 'calibrate') modeText = 'Kalibrieren';
    else if (state.mode === 'measure') modeText = 'Messen';
    statMode.textContent = modeText;
    const area = activeArea();
    statDrawing.textContent = state.drawing === 'main' ? 'Hauptfläche' : state.drawing === 'sub' ? `Teil #${area?.subs.length}` : '—';

    // Section visual states
    mainSection.classList.toggle('drawing', state.drawing === 'main');
    subSection.classList.toggle('drawing', state.drawing === 'sub');
    subSection.classList.toggle('sub',     state.drawing === 'sub');

    // Update active area name + swatch color
    const col = areaColor(state.activeAreaIdx);
    if (activeAreaNameDisplay) activeAreaNameDisplay.textContent = area?.name || 'Hauptfläche';
    if (mainSwatch) mainSwatch.style.background = col.stroke;
    addAreaBtn.disabled = state.mode !== 'measure';

    // Main area button (for active area)
    const aMain = area?.main || null;
    if (!aMain) {
      mainStatus.textContent = 'Noch nicht gezeichnet';
      mainStatus.classList.remove('ok', 'drawing');
      drawMainBtn.textContent = 'Hauptfläche zeichnen';
      drawMainBtn.disabled = state.drawing === 'sub';
    } else if (!aMain.closed) {
      mainStatus.textContent = `Zeichnet… ${aMain.points.length} Punkte`;
      mainStatus.classList.remove('ok'); mainStatus.classList.add('drawing');
      drawMainBtn.textContent = 'Hauptfläche abbrechen';
      drawMainBtn.disabled = false;
    } else {
      mainStatus.textContent = `${fmt(polygonRealArea(aMain.points))} ${state.unit}²`;
      mainStatus.classList.remove('drawing'); mainStatus.classList.add('ok');
      drawMainBtn.textContent = 'Hauptfläche neu zeichnen';
      drawMainBtn.disabled = state.drawing === 'sub';
    }

    // Sub-area button (for active area)
    const aSubs = area?.subs || [];
    addSubBtn.disabled = !(aMain && aMain.closed) || state.drawing === 'main';
    if (state.drawing === 'sub') {
      subStatus.textContent = `Zeichnet #${aSubs.length}… ${currentShape()?.points.length || 0} Punkte`;
      subStatus.classList.add('drawing');
    } else {
      subStatus.classList.remove('drawing'); subStatus.textContent = '';
    }
    subCountBadge.textContent = aSubs.length ? `(${aSubs.length})` : '';

    renderAreaList();
    renderSubList();

    // Draw-controls section
    drawControls.style.display = state.drawing ? 'block' : 'none';
    drawControls.classList.toggle('drawing', !!state.drawing);
    drawControls.classList.toggle('sub',     state.drawing === 'sub');

    // Calibration step indicators
    for (let i = 1; i <= 4; i++) {
      const el = document.getElementById('cstep' + i);
      if (!el) continue;
      el.classList.remove('active', 'done');
      if (state.calibPoints.length >= i)       el.classList.add('done');
      else if (state.calibPoints.length === i - 1 && state.mode === 'calibrate') el.classList.add('active');
    }

    // Floating close button
    const cur = currentShape();
    const canClose = state.drawing && cur && cur.points.length >= 3;
    closeFab.style.display = state.drawing ? 'flex' : 'none';
    closeFab.disabled = !canClose;
    closeFab.classList.toggle('sub', state.drawing === 'sub');
    closeFabLabel.textContent = state.drawing === 'main' ? 'Hauptfläche schließen' : `Teilfläche #${activeArea()?.subs.length} schließen`;

    updateStats();
    persistState();
  }

  function renderSubList() {
    subList.innerHTML = '';
    const area = activeArea();
    const subs = area?.subs || [];
    const mainAreaVal_ = (area?.main && area.main.closed) ? polygonRealArea(area.main.points) : 0;
    if (!subs.length) { subEmpty.style.display = 'block'; return; }
    subEmpty.style.display = 'none';
    subs.forEach((sub, i) => {
      const item = document.createElement('div');
      item.className = 'sub-item' + (i === subs.length - 1 && state.drawing === 'sub' ? ' drawing' : '');
      const subArea = sub.closed ? polygonRealArea(sub.points) : 0;
      const pct     = mainAreaVal_ > 0 && sub.closed ? (subArea / mainAreaVal_) * 100 : 0;
      item.innerHTML = `
        <div class="badge">${i + 1}</div>
        <div class="area-val">${sub.closed ? `${fmt(subArea)} ${state.unit}²` : `zeichnet… ${sub.points.length} Punkte`}</div>
        <div class="pct-val">${sub.closed && mainAreaVal_ > 0 ? pct.toFixed(1) + '%' : ''}</div>
        <button class="x-btn" data-idx="${i}" title="Entfernen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>`;
      subList.appendChild(item);
    });
    subList.querySelectorAll('.x-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx  = +btn.dataset.idx;
        const cur  = activeArea();
        if (!cur) return;
        if (state.drawing === 'sub' && idx === cur.subs.length - 1) state.drawing = null;
        cur.subs.splice(idx, 1);
        drawOverlay(); setSteps();
      });
    });
  }

  function renderAreaList() {
    if (!areaList) return;
    areaList.innerHTML = '';
    state.areas.forEach((area, i) => {
      const col      = areaColor(i);
      const isActive = i === state.activeAreaIdx;
      const hasMain  = area.main && area.main.closed;
      const item     = document.createElement('div');
      item.className = 'area-item' + (isActive ? ' active' : '');
      item.innerHTML = `
        <span class="area-swatch" style="background:${col.stroke}"></span>
        <span class="area-name">${esc(area.name)}</span>
        <span class="area-sz">${hasMain ? `${fmt(polygonRealArea(area.main.points))} ${state.unit}²` : '—'}</span>
        ${state.areas.length > 1 ? `<button class="area-del" data-delidx="${i}" title="Löschen">×</button>` : ''}`;
      if (!isActive) {
        item.addEventListener('click', (ev) => {
          if (ev.target.classList.contains('area-del')) return;
          if (state.drawing) return;
          state.activeAreaIdx = i;
          drawOverlay(); setSteps();
        });
      }
      areaList.appendChild(item);
    });
    areaList.querySelectorAll('.area-del').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const idx = +btn.dataset.delidx;
        if (state.drawing) return;
        state.areas.splice(idx, 1);
        if (state.activeAreaIdx >= state.areas.length) state.activeAreaIdx = state.areas.length - 1;
        if (!state.areas.length) {
          state.areas.push({ id: Date.now(), name: 'Bereich 1', main: null, subs: [] });
          state.activeAreaIdx = 0;
        }
        drawOverlay(); setSteps();
      });
    });
  }

  function updateStats() {
    if (!anyMainClosed()) { stats.style.display = 'none'; return; }
    stats.style.display = 'block';

    let totalMain = 0, totalSub = 0, totalSubCount = 0, totalSubClosed = 0;
    state.areas.forEach(area => {
      if (!(area.main && area.main.closed)) return;
      totalMain += polygonRealArea(area.main.points);
      const closed = area.subs.filter(s => s.closed);
      totalSubClosed += closed.length;
      totalSubCount  += area.subs.length;
      totalSub += closed.reduce((a, s) => a + polygonRealArea(s.points), 0);
    });

    const uncovered = Math.max(0, totalMain - totalSub);
    const coverage  = totalMain > 0 ? (totalSub / totalMain) * 100 : 0;

    mainAreaVal.textContent   = fmt(totalMain);
    subTotalVal.textContent   = fmt(totalSub);
    subTotalCount.textContent = totalSubCount ? `(${totalSubClosed}/${totalSubCount})` : '';
    uncoveredVal.textContent  = fmt(uncovered);
    [unitMain, unitSub, unitUnc].forEach(el => el.textContent = state.unit + '²');

    coverageVal.textContent  = coverage.toFixed(1).replace('.', ',') + ' %';
    coverageFill.style.width = Math.min(coverage, 100) + '%';
    const over = coverage > 100;
    coverageVal.classList.toggle('over', over);
    coverageFill.classList.toggle('over', over);
    if (over) {
      coverageNote.textContent = `Teilflächen überschreiten Hauptfläche um ${(coverage - 100).toFixed(1).replace('.', ',')} %`;
    } else if (coverage > 0) {
      coverageNote.textContent = `${(100 - coverage).toFixed(1).replace('.', ',')} % der Hauptfläche nicht abgedeckt`;
    } else {
      coverageNote.textContent = '';
    }
  }

  function updateUnitDisplay() {
    suffixW.textContent = state.unit;
    suffixH.textContent = state.unit;
  }

  unitSelect.addEventListener('change', () => {
    state.unit = unitSelect.value;
    updateUnitDisplay();
    setSteps();
  });

  // ===========================================================
  // Image loading
  // ===========================================================

  function loadImageFile(f) {
    if (!f) return;
    const reader = new FileReader();
    reader.onerror = () => alert('Das Bild konnte nicht geladen werden.');
    reader.onload = (ev) => {
      state._imageDataURL = ev.target.result;
      const img = new Image();
      img.onerror = () => alert('Das Bild konnte nicht geladen werden.');
      img.onload = () => {
        Object.assign(state, {
          img: img, imgOrig: img,
          imgW: img.naturalWidth, imgH: img.naturalHeight,
          stretchedW: img.naturalWidth, stretchedH: img.naturalHeight,
          scaleX: 1, scaleY: 1,
          calibPoints: [], calibration: null,
          areas: [], activeAreaIdx: 0, drawing: null,
          fileName: f.name, mode: 'calibrate',
        });
        emptyMsg.style.display = 'none';
        canvasWrap.style.display = 'block';
        toolbar.style.display = 'flex';
        try { fitToView(); } catch (e) { console.error('fitToView:', e); }
        try { render();    } catch (e) { console.error('render:', e); }
        setSteps();
        uploadZone.classList.add('has-file');
        uploadTitle.textContent = f.name;
        uploadSub.textContent = `${state.imgW} × ${state.imgH} px · ${(f.size / 1024).toFixed(0)} KB`;
        uploadIcon.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
        uploadIcon.setAttribute('stroke-width', '2.5');
        statImage.textContent = `${state.imgW}×${state.imgH}`;
        statScaleWrap.style.display = 'none';
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(f);
  }

  fileInput.addEventListener('change', (e) => loadImageFile(e.target.files && e.target.files[0]));

  // Drag and drop onto the upload zone
  ['dragenter', 'dragover'].forEach(ev => uploadZone.addEventListener(ev, (e) => {
    e.preventDefault(); e.stopPropagation();
    uploadZone.style.borderColor = 'var(--accent)';
  }));
  ['dragleave', 'drop'].forEach(ev => uploadZone.addEventListener(ev, (e) => {
    e.preventDefault(); e.stopPropagation();
    uploadZone.style.borderColor = '';
  }));
  uploadZone.addEventListener('drop', (e) => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadImageFile(f);
  });

  // ===========================================================
  // Calibration
  // ===========================================================

  function updateApplyButton() {
    applyCalib.disabled = !(state.calibPoints.length === 4 && parseFloat(realW.value) > 0 && parseFloat(realH.value) > 0);
  }

  realW.addEventListener('input', updateApplyButton);
  realH.addEventListener('input', updateApplyButton);

  resetCalib.addEventListener('click', () => {
    if (!state.imgOrig) return;
    Object.assign(state, {
      calibPoints: [], calibration: null,
      areas: [], activeAreaIdx: 0, drawing: null,
      mode: 'calibrate',
      img: state.imgOrig,
      stretchedW: state.imgW, stretchedH: state.imgH,
      scaleX: 1, scaleY: 1,
    });
    fitToView(); render(); setSteps();
    statScaleWrap.style.display = 'none';
    updateApplyButton();
    setCalibCollapsed(false);
  });

  applyCalib.addEventListener('click', () => {
    if (applyCalib.disabled) return;
    const rW = parseFloat(realW.value), rH = parseFloat(realH.value);
    state.unit = unitSelect.value;
    state.realW = rW; state.realH = rH;
    updateUnitDisplay();

    const src = state.calibPoints.map(p => ({ x: p.x, y: p.y }));

    // Pixel area of the source quad (Shoelace)
    let quadAreaPx = 0;
    for (let i = 0; i < 4; i++) {
      const a = src[i], b = src[(i + 1) % 4];
      quadAreaPx += a.x * b.y - b.x * a.y;
    }
    quadAreaPx = Math.abs(quadAreaPx) / 2;

    let pxPerUnit = Math.sqrt(quadAreaPx / (rW * rH));
    if (!isFinite(pxPerUnit) || pxPerUnit <= 0) pxPerUnit = 1;

    const makeDst = (ppu) => ([
      { x: 0,       y: 0 },
      { x: rW * ppu, y: 0 },
      { x: rW * ppu, y: rH * ppu },
      { x: 0,       y: rH * ppu },
    ]);
    let dst = makeDst(pxPerUnit);
    let H = computeHomography(src, dst);
    if (!H) { alert('Perspektive konnte nicht berechnet werden — die vier Eckpunkte liegen möglicherweise auf einer Linie.'); return; }

    // Find the bounding box of the warped full image
    const imgCorners = [{ x: 0, y: 0 }, { x: state.imgW, y: 0 }, { x: state.imgW, y: state.imgH }, { x: 0, y: state.imgH }];
    let mapped = imgCorners.map(c => applyH(H, c.x, c.y));
    let minX = Math.min(...mapped.map(m => m.x)), maxX = Math.max(...mapped.map(m => m.x));
    let minY = Math.min(...mapped.map(m => m.y)), maxY = Math.max(...mapped.map(m => m.y));
    let dstW = maxX - minX, dstH = maxY - minY;

    // Cap destination size
    const MAX_DIM = 4096;
    const scaleDown = Math.min(MAX_DIM / dstW, MAX_DIM / dstH, 1);
    if (scaleDown < 1) {
      pxPerUnit *= scaleDown;
      dst = makeDst(pxPerUnit);
      H = computeHomography(src, dst);
      mapped = imgCorners.map(c => applyH(H, c.x, c.y));
      minX = Math.min(...mapped.map(m => m.x)); maxX = Math.max(...mapped.map(m => m.x));
      minY = Math.min(...mapped.map(m => m.y)); maxY = Math.max(...mapped.map(m => m.y));
      dstW = maxX - minX; dstH = maxY - minY;
    }

    const dstT    = dst.map(d => ({ x: d.x - minX, y: d.y - minY }));
    const Hfinal  = computeHomography(src, dstT);
    if (!Hfinal) { alert('Perspektivische Transformation konnte nicht abgeschlossen werden.'); return; }
    const Hinv = invert3(Hfinal);
    if (!Hinv) { alert('Die Homographie ist nicht invertierbar — bitte deutlichere Eckpunkte wählen.'); return; }

    const rectW = Math.max(1, Math.round(dstW));
    const rectH = Math.max(1, Math.round(dstH));
    const rectified = document.createElement('canvas');
    rectified.width = rectW; rectified.height = rectH;
    warpImageInverse(state.imgOrig, rectified, rectW, rectH, Hinv, 60);

    state.img         = rectified;
    state.stretchedW  = rectW;
    state.stretchedH  = rectH;
    state.scaleX      = 1 / pxPerUnit;
    state.scaleY      = 1 / pxPerUnit;
    state.calibration = {
      method: 'homography',
      origImgW: state.imgW, origImgH: state.imgH,
      srcPoints: src, dstPointsLocal: dstT,
      realW: rW, realH: rH,
      pxPerUnit, uniformScale: 1 / pxPerUnit,
      rectifiedW: rectW, rectifiedH: rectH,
      quadAreaPx, H: Hfinal, Hinv,
      unit: state.unit,
    };
    state.calibPoints = [];
    state.mode = 'measure';
    if (!state.areas.length) {
      state.areas = [{ id: Date.now(), name: 'Bereich 1', main: null, subs: [] }];
      state.activeAreaIdx = 0;
    }

    fitToView(); render(); setSteps();
    statScaleWrap.style.display = 'flex';
    statScale.textContent = `${(1 / pxPerUnit).toFixed(4)} ${state.unit}/px`;
    setCalibCollapsed(true);
  });

  // ===========================================================
  // Drawing controls
  // ===========================================================

  drawMainBtn.addEventListener('click', () => {
    const area = activeArea();
    if (!area) return;
    if (state.drawing === 'main') {
      area.main = null; state.drawing = null;
    } else {
      area.main = { points: [], closed: false };
      area.subs = []; state.drawing = 'main';
    }
    drawOverlay(); setSteps();
  });

  addSubBtn.addEventListener('click', () => {
    if (addSubBtn.disabled) return;
    const area = activeArea();
    if (!area) return;
    area.subs.push({ points: [], closed: false });
    state.drawing = 'sub';
    drawOverlay(); setSteps();
  });

  function closeCurrentShape() {
    const shape = currentShape();
    if (!shape || shape.points.length < 3) return;
    shape.closed = true; state.drawing = null;
    drawOverlay(); setSteps();
  }

  undoPoint.addEventListener('click', () => {
    const shape = currentShape();
    if (shape) { shape.points.pop(); drawOverlay(); setSteps(); }
  });

  closeShape.addEventListener('click', closeCurrentShape);
  closeFab  .addEventListener('click', closeCurrentShape);

  cancelDraw.addEventListener('click', () => {
    if (!state.drawing) return;
    const area = activeArea();
    if (area) {
      if (state.drawing === 'main') {
        if (area.main && !area.main.closed) area.main = null;
      } else if (state.drawing === 'sub') {
        const last = area.subs[area.subs.length - 1];
        if (last && !last.closed) area.subs.pop();
      }
    }
    state.drawing = null;
    drawOverlay(); setSteps();
  });

  clearAll.addEventListener('click', () => {
    state.areas.forEach(a => { a.main = null; a.subs = []; });
    state.drawing = null;
    drawOverlay(); setSteps();
  });

  addAreaBtn.addEventListener('click', () => {
    if (state.mode !== 'measure') return;
    const n = state.areas.length + 1;
    state.areas.push({ id: Date.now(), name: `Bereich ${n}`, main: null, subs: [] });
    state.activeAreaIdx = state.areas.length - 1;
    drawOverlay(); setSteps();
  });


  // ===========================================================
  // Click: place corner (calibrate) or polygon point (draw)
  // ===========================================================

  overlay.addEventListener('click', (e) => {
    if (panMoved || dragMoved || _mousedownOnPoint || e.button !== 0) return;
    const p = eventToCanvas(e);

    if (state.mode === 'calibrate') {
      if (state.calibPoints.length < 4) {
        state.calibPoints.push(p);
        drawOverlay(); updateApplyButton(); setSteps();
      }
      return;
    }

    if (!state.drawing) return;
    const shape = currentShape();
    if (!shape) return;
    if (shape.points.length >= 3) {
      const first = shape.points[0];
      const dist  = Math.hypot((p.x - first.x) * state.displayScale, (p.y - first.y) * state.displayScale);
      if (dist < 14) { closeCurrentShape(); return; }
    }
    shape.points.push(p);
    drawOverlay(); setSteps();
  });

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    if (e.key === 'Enter' && state.drawing) { closeCurrentShape(); return; }
    if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const shape = currentShape();
      if (shape) { shape.points.pop(); drawOverlay(); setSteps(); }
    }
    if (e.key === 'Escape' && state.drawing) cancelDraw.click();
  });

  // ===========================================================
  // Export — report text (.txt)
  // ===========================================================

  const nf  = (n, d = 6) => Number(n).toFixed(d);
  const nfs = (n) => nf(n, 4);
  const nf3 = (n) => nf(n, 3);
  const nf2 = (n) => nf(n, 2);

  function shoelaceBreakdown(pts) {
    const n = pts.length;
    const terms = [];
    let sumSigned = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, a = pts[i], b = pts[j];
      const prod1 = a.x * b.y, prod2 = b.x * a.y, term = prod1 - prod2;
      sumSigned += term;
      terms.push({ i, j, x1: a.x, y1: a.y, x2: b.x, y2: b.y, prod1, prod2, term });
    }
    const sumAbs = Math.abs(sumSigned), areaPx = sumAbs / 2;
    const perimEdges = [];
    let totalPerimPx = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, a = pts[i], b = pts[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dx2 = dx * dx, dy2 = dy * dy, sumSq = dx2 + dy2, len = Math.sqrt(sumSq);
      totalPerimPx += len;
      perimEdges.push({ i, j, x1: a.x, y1: a.y, x2: b.x, y2: b.y, dx, dy, dx2, dy2, sumSq, len });
    }
    return { terms, sumSigned, sumAbs, areaPx, perimEdges, totalPerimPx };
  }

  function writePolygonBreakdown(L, name, pts, calib) {
    const u = calib.unit, s = calib.uniformScale, areaScale = s * s;

    L.push('');
    L.push(`[${name}]  Eckpunkte`);
    pts.forEach((p, i) => {
      L.push(`  P${i+1}  px=(${nf3(p.x)}, ${nf3(p.y)})   ${u}=(${nf3(p.x * s)}, ${nf3(p.y * s)})`);
    });

    const b = shoelaceBreakdown(pts);

    L.push('');
    L.push(`[${name}]  Umfang`);
    L.push(`  len(i,j) = sqrt((x_j-x_i)² + (y_j-y_i)²)`);
    b.perimEdges.forEach(e => {
      L.push(`  P${e.i+1}→P${e.j+1}  Δ=(${nf3(e.dx)}, ${nf3(e.dy)})  len = sqrt(${nf3(e.dx2)}+${nf3(e.dy2)}) = sqrt(${nf3(e.sumSq)}) = ${nf3(e.len)} px = ${nf3(e.len * s)} ${u}`);
    });
    L.push(`  Σlen  = ${nf3(b.totalPerimPx)} px`);
    L.push(`        = ${nf3(b.totalPerimPx * s)} ${u}`);

    L.push('');
    L.push(`[${name}]  Fläche  (Gauß'sche Trapezformel)`);
    L.push(`  A = |Σ(x_i·y_{i+1} - x_{i+1}·y_i)| / 2`);
    b.terms.forEach(t => {
      L.push(`  P${t.i+1}→P${t.j+1}  ${nf3(t.x1)}·${nf3(t.y2)} - ${nf3(t.x2)}·${nf3(t.y1)} = ${nf3(t.prod1)} - ${nf3(t.prod2)} = ${nf3(t.term)}`);
    });
    L.push(`  Σ      = ${nf3(b.sumSigned)}`);
    L.push(`  |Σ|/2  = ${nf3(b.areaPx)} px²`);
    const realArea = b.areaPx * areaScale;
    L.push(`  × s²   = ${nf3(b.areaPx)} × ${nf(areaScale, 8)} = ${nf3(realArea)} ${u}²`);

    return { areaPx: b.areaPx, realArea, realPerim: b.totalPerimPx * s };
  }

  function buildReportText() {
    const closedAreas = state.areas.filter(a => a.main && a.main.closed);
    if (!closedAreas.length || !state.calibration) return '';
    const c = state.calibration, u = c.unit;
    const L = [], H1 = '='.repeat(72);

    L.push('PLANAR — Berechnungs-Bericht');
    L.push(H1);
    L.push(`Erstellt:   ${new Date().toLocaleString('de-DE')}`);
    L.push(`Bild:       ${state.fileName || '(unbekannt)'}   ${c.origImgW} × ${c.origImgH} px`);
    L.push(`Einheit:    ${u}`);
    L.push('');

    L.push('[KALIBRIERUNG]  4-Punkt-Homographie');
    L.push(`  Referenz-Rechteck:  ${c.realW} × ${c.realH} ${u}`);
    L.push('  Quell-Eckpunkte (px):');
    c.srcPoints.forEach((p, i) => L.push(`    C${i+1}:  (${nf3(p.x)}, ${nf3(p.y)})`));
    L.push('  Ziel-Eckpunkte (entzerrt, px):');
    c.dstPointsLocal.forEach((p, i) => L.push(`    D${i+1}:  (${nf3(p.x)}, ${nf3(p.y)})`));
    L.push(`  A_quad      = ${nf3(c.quadAreaPx)} px²`);
    L.push(`  pxPerUnit   = sqrt(A_quad / (W·H)) = sqrt(${nf3(c.quadAreaPx)} / ${nf3(c.realW * c.realH)}) = ${nf(c.pxPerUnit, 6)} px/${u}`);
    if (c.H) {
      const H = c.H;
      L.push(`  H = [ ${nf(H[0],6).padStart(12)}  ${nf(H[1],6).padStart(12)}  ${nf(H[2],6).padStart(12)} ]`);
      L.push(`      [ ${nf(H[3],6).padStart(12)}  ${nf(H[4],6).padStart(12)}  ${nf(H[5],6).padStart(12)} ]`);
      L.push(`      [ ${nf(H[6],9).padStart(12)}  ${nf(H[7],9).padStart(12)}  ${nf(H[8],6).padStart(12)} ]`);
    }
    L.push(`  Entzerrt:   ${c.rectifiedW} × ${c.rectifiedH} px`);
    L.push(`  s           = 1 / pxPerUnit = ${nf(c.uniformScale, 8)} ${u}/px`);
    L.push(`  s²          = ${nf(c.uniformScale * c.uniformScale, 10)} ${u}²/px²`);
    L.push('');

    const multi = closedAreas.length > 1;
    const areaResults = closedAreas.map((area) => {
      const prefix = multi ? `${area.name} – ` : '';
      const mainRes = writePolygonBreakdown(L, `${prefix}HAUPT`, area.main.points, c);
      L.push('');
      const closedSubs = area.subs.filter(s => s.closed);
      const subResults = closedSubs.map((sub, si) => {
        const r   = writePolygonBreakdown(L, `${prefix}TEIL #${si + 1}`, sub.points, c);
        const pct = mainRes.realArea > 0 ? (r.realArea / mainRes.realArea) * 100 : 0;
        L.push(`  % der Hauptfläche  = ${nf3(r.realArea)} / ${nf3(mainRes.realArea)} × 100 = ${nf2(pct)} %`);
        return { si, realArea: r.realArea, realPerim: r.realPerim, pct };
      });
      L.push('');
      const subTotal  = subResults.reduce((a, s) => a + s.realArea, 0);
      const coverage  = mainRes.realArea > 0 ? (subTotal / mainRes.realArea) * 100 : 0;
      const uncovered = Math.max(0, mainRes.realArea - subTotal);

      const tag = multi ? ` – ${area.name}` : '';
      L.push(`[GESAMT${tag}]`);
      L.push(`  A_gesamt      = ${subResults.length ? subResults.map(s => nf3(s.realArea)).join(' + ') + ' = ' : ''}${nf3(subTotal)} ${u}²`);
      L.push(`  Abdeckung     = ${nf3(subTotal)} / ${nf3(mainRes.realArea)} × 100 = ${nf2(coverage)} %${coverage > 100 ? '  (ÜBERSCHREITET Hauptfläche)' : ''}`);
      L.push(`  Nicht abged.  = ${nf3(mainRes.realArea)} - ${nf3(subTotal)} = ${nf3(uncovered)} ${u}²`);
      L.push('');
      return { area, mainRes, subResults, subTotal, coverage, uncovered };
    });

    const grandMain     = areaResults.reduce((a, r) => a + r.mainRes.realArea, 0);
    const grandSub      = areaResults.reduce((a, r) => a + r.subTotal, 0);
    const grandCoverage = grandMain > 0 ? (grandSub / grandMain) * 100 : 0;
    const grandUnc      = Math.max(0, grandMain - grandSub);

    L.push('[ZUSAMMENFASSUNG]');
    areaResults.forEach(({ area, mainRes, subResults, subTotal }) => {
      if (multi) L.push(`  --- ${area.name} ---`);
      L.push(`  Hauptfläche       ${nf3(mainRes.realArea).padStart(14)} ${u}²`);
      L.push(`  Hauptumfang       ${nf3(mainRes.realPerim).padStart(14)} ${u}`);
      subResults.forEach(s => {
        L.push(`  Teil #${(s.si+1).toString().padEnd(3)}        ${nf3(s.realArea).padStart(14)} ${u}²   ${nf2(s.pct).padStart(6)} %`);
      });
      L.push(`  Teilfl. gesamt    ${nf3(subTotal).padStart(14)} ${u}²`);
    });
    if (multi) {
      L.push('');
      L.push('  --- Alle Bereiche ---');
      L.push(`  Gesamt-Hauptfl.   ${nf3(grandMain).padStart(14)} ${u}²`);
      L.push(`  Gesamt-Teilfl.    ${nf3(grandSub).padStart(14)} ${u}²`);
    }
    L.push(`  Nicht abged.      ${nf3(grandUnc).padStart(14)} ${u}²`);
    L.push(`  Abdeckung         ${nf2(grandCoverage).padStart(14)} %`);

    return L.join('\n');
  }

  function exportReport() {
    const text = buildReportText();
    if (!text) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `${(state.fileName || 'messung').replace(/\.[^.]+$/, '')}_planar_${stamp}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  // ===========================================================
  // Export — Word document (.docx)
  // ===========================================================

  // Merges the report into a user-supplied .docx template via <w:altChunk>.
  // The template must contain the plain-text markers <planar-start> and
  // <planar-end> on their own paragraphs; they are replaced with the HTML report.
  // Using altChunk avoids all XML-namespace incompatibilities between the two
  // documents — Word handles the HTML→OOXML conversion natively on open.
  async function mergeWithTemplate(templateBlob, contentHtml, vars = {}) {
    const xe = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
    const applyVars = (xml) => xml.replace(/\{\{(\w+)\}\}/g, (m, k) => vars[k] !== undefined ? xe(String(vars[k])) : m);

    const tmplZip = await JSZip.loadAsync(templateBlob);
    let tmplDocXml = await tmplZip.file('word/document.xml').async('string');
    tmplDocXml = applyVars(tmplDocXml);

    // Apply vars to other XML parts (headers, footers) in the template
    for (const fname of Object.keys(tmplZip.files)) {
      if (!fname.startsWith('word/') || !fname.endsWith('.xml') || fname === 'word/document.xml') continue;
      const file = tmplZip.file(fname);
      if (!file || file.dir) continue;
      const content = await file.async('string');
      const applied = applyVars(content);
      if (applied !== content) tmplZip.file(fname, applied);
    }

    // ── Find marker paragraphs by their text content ────────────
    // Word often splits one logical run across multiple <w:r> elements
    // (spell-check, language tags, etc.), so we can't search the raw XML
    // for the literal marker string. Instead we extract the concatenated
    // text of every paragraph and compare that.
    function findParaByText(xml, searchText) {
      const re = /<w:p[ >]/g;
      let m;
      while ((m = re.exec(xml)) !== null) {
        const pStart = m.index;
        const closeIdx = xml.indexOf('</w:p>', pStart);
        if (closeIdx === -1) continue;
        const pEnd = closeIdx + 6;
        const pXml = xml.slice(pStart, pEnd);
        const text = (pXml.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g) || [])
          .map(t => (/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/.exec(t) || [])[1] || '')
          .join('')
          .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        if (text.includes(searchText)) return { start: pStart, end: pEnd };
      }
      return null;
    }

    const sb = findParaByText(tmplDocXml, '<planar-start>');
    const eb = findParaByText(tmplDocXml, '<planar-end>');

    if (!sb || !eb) throw new Error(
      'Die Markierungen <planar-start> und/oder <planar-end> wurden in der Vorlage nicht gefunden.\n' +
      'Schreiben Sie diese exakt als Klartext in Ihre .docx-Vorlage.');

    // ── Ensure r: namespace is present (needed for altChunk r:id) ─
    if (!tmplDocXml.includes('xmlns:r=')) {
      tmplDocXml = tmplDocXml.replace(
        /(<w:document\b)/,
        '$1 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
      );
    }

    // ── Replace marker region with <w:altChunk> ─────────────────
    // altChunk tells Word to import the referenced file as inline content.
    // This completely sidesteps XML namespace merging between two documents.
    const chunkId = 'rIdPlanarChunk';
    tmplDocXml = tmplDocXml.slice(0, sb.start) +
      `<w:altChunk r:id="${chunkId}"/>` +
      tmplDocXml.slice(eb.end);
    tmplZip.file('word/document.xml', tmplDocXml);

    // ── Add the HTML report as a part inside the zip ─────────────
    tmplZip.file('word/planar_report.html', contentHtml);

    const relsXml = await tmplZip.file('word/_rels/document.xml.rels').async('string');
    tmplZip.file('word/_rels/document.xml.rels', relsXml.replace('</Relationships>',
      `<Relationship Id="${chunkId}" ` +
      `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk" ` +
      `Target="planar_report.html"/></Relationships>`));

    let typesXml = await tmplZip.file('[Content_Types].xml').async('string');
    if (!typesXml.includes('planar_report.html')) {
      tmplZip.file('[Content_Types].xml', typesXml.replace('</Types>',
        `<Override PartName="/word/planar_report.html" ContentType="text/html"/></Types>`));
    }

    return tmplZip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  }

  async function injectWordHdrFtr(blob, projName, dateStr) {
    const xe = (s) => String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

    // A4 (11906 twips) minus 1440 left + 1440 right = 9026 twips content width
    const nsW = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const nsR = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

    const rpr = `<w:rPr><w:sz w:val="17"/><w:color w:val="666666"/></w:rPr>`;
    const field = (code) =>
      `<w:r>${rpr}<w:fldChar w:fldCharType="begin"/></w:r>` +
      `<w:r>${rpr}<w:instrText xml:space="preserve"> ${code} </w:instrText></w:r>` +
      `<w:r>${rpr}<w:fldChar w:fldCharType="separate"/></w:r>` +
      `<w:r>${rpr}<w:t>1</w:t></w:r>` +
      `<w:r>${rpr}<w:fldChar w:fldCharType="end"/></w:r>`;

    const headerXml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<w:hdr ${nsW} ${nsR}>` +
        `<w:p>` +
          `<w:pPr>` +
            `<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="CCCCCC"/></w:pBdr>` +
            `<w:tabs><w:tab w:val="right" w:pos="9026"/></w:tabs>` +
          `</w:pPr>` +
          `<w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="1A1A1A"/></w:rPr><w:t>${xe(projName)}</w:t></w:r>` +
          `<w:r><w:rPr><w:sz w:val="17"/><w:color w:val="888888"/></w:rPr><w:tab/><w:t>Planar · Bildflächen-Messung</w:t></w:r>` +
        `</w:p>` +
      `</w:hdr>`;

    const footerXml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<w:ftr ${nsW} ${nsR}>` +
        `<w:p>` +
          `<w:pPr>` +
            `<w:pBdr><w:top w:val="single" w:sz="4" w:space="1" w:color="CCCCCC"/></w:pBdr>` +
            `<w:tabs><w:tab w:val="right" w:pos="9026"/></w:tabs>` +
          `</w:pPr>` +
          `<w:r>${rpr}<w:t xml:space="preserve">${xe(projName)} · ${xe(dateStr)}</w:t></w:r>` +
          `<w:r>${rpr}<w:tab/><w:t xml:space="preserve">Seite </w:t></w:r>` +
          field('PAGE') +
          `<w:r>${rpr}<w:t xml:space="preserve"> / </w:t></w:r>` +
          field('NUMPAGES') +
        `</w:p>` +
      `</w:ftr>`;

    const zip = await JSZip.loadAsync(blob);

    zip.file('word/header1.xml', headerXml);
    zip.file('word/footer1.xml', footerXml);

    // Wire relationships
    const relsXml = await zip.file('word/_rels/document.xml.rels').async('string');
    zip.file('word/_rels/document.xml.rels', relsXml.replace('</Relationships>',
      `<Relationship Id="rIdHdr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>` +
      `<Relationship Id="rIdFtr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>` +
      `</Relationships>`));

    // Wire content types
    const typesXml = await zip.file('[Content_Types].xml').async('string');
    zip.file('[Content_Types].xml', typesXml.replace('</Types>',
      `<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>` +
      `<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>` +
      `</Types>`));

    // Inject header/footer references into document sectPr
    const docXml = await zip.file('word/document.xml').async('string');
    const refs =
      `<w:headerReference w:type="default" r:id="rIdHdr1"/>` +
      `<w:footerReference w:type="default" r:id="rIdFtr1"/>`;
    const updatedDoc = docXml.includes('<w:sectPr')
      ? docXml.replace(/<w:sectPr(\s|>)/, (m) => m + refs)
      : docXml.replace('</w:body>', `<w:sectPr>${refs}</w:sectPr></w:body>`);
    zip.file('word/document.xml', updatedDoc);

    return zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  }

  async function exportDocx() {
    if (!anyMainClosed() || !state.calibration) return;

    if (typeof htmlDocx === 'undefined') {
      alert('Die DOCX-Bibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen.');
      return;
    }

    const c = state.calibration, u = c.unit;

    // Capture annotation at displayScale=1 so the scale bar renders at native canvas pixels.
    const savedDrawing = state.drawing, savedCursor = state.cursor, savedScale = state.displayScale;
    state.drawing = null; state.cursor = null; state.displayScale = 1;
    drawOverlay();
    const annot = document.createElement('canvas');
    annot.width = state.stretchedW; annot.height = state.stretchedH;
    const actx = annot.getContext('2d');
    actx.drawImage(state.img, 0, 0); actx.drawImage(overlay, 0, 0);
    state.drawing = savedDrawing; state.cursor = savedCursor; state.displayScale = savedScale;
    drawOverlay();

    // html-docx-js renders images at native px size (~72dpi in Word).
    // A4 with 1" margins = ~451pt content width, so cap display at 450px.
    // Image data is encoded at full original resolution for maximum quality.
    function toImgInfo(src) {
      const sw = src instanceof HTMLImageElement ? src.naturalWidth  : src.width;
      const sh = src instanceof HTMLImageElement ? src.naturalHeight : src.height;
      const displayScale = Math.min(450 / sw, 1);
      const dw = Math.max(1, Math.round(sw * displayScale));
      const dh = Math.max(1, Math.round(sh * displayScale));
      const cv = document.createElement('canvas');
      cv.width = sw; cv.height = sh;
      cv.getContext('2d').drawImage(src, 0, 0, sw, sh);
      return { url: cv.toDataURL('image/jpeg', 0.92), w: dw, h: dh };
    }

    const orig  = toImgInfo(state.imgOrig);
    const rect  = toImgInfo(state.img);
    const annImg = toImgInfo(annot);

    const fmtDe = (n) => fmt(n).replace('.', ',');
    const pctDe = (n) => n.toFixed(1).replace('.', ',');
    const calcText      = buildReportText();
    const dateStr       = new Date().toLocaleString('de-DE');
    const projName      = state.projectName || 'Planar';
    const shortFileName = (() => { const n = state.fileName || 'unbekannt'; return n.length > 30 ? n.slice(0, 27) + '…' : n; })();

    // Compute per-area stats
    const closedAreas = state.areas.filter(a => a.main && a.main.closed);
    const areaItems = closedAreas.map(area => {
      const mainA = polygonRealArea(area.main.points);
      const mainP = polygonRealPerimeter(area.main.points, true);
      const subs  = area.subs.filter(s => s.closed).map((s, si) => {
        const a = polygonRealArea(s.points);
        return { idx: si + 1, area: a, perim: polygonRealPerimeter(s.points, true), pct: mainA > 0 ? (a / mainA) * 100 : 0 };
      });
      const subTotal  = subs.reduce((acc, s) => acc + s.area, 0);
      const coverage  = mainA > 0 ? (subTotal / mainA) * 100 : 0;
      const uncovered = Math.max(0, mainA - subTotal);
      return { area, mainArea: mainA, mainPerim: mainP, subs, subTotal, coverage, uncovered };
    });
    const grandMain    = areaItems.reduce((a, ai) => a + ai.mainArea, 0);
    const grandSub     = areaItems.reduce((a, ai) => a + ai.subTotal, 0);
    const grandCov     = grandMain > 0 ? (grandSub / grandMain) * 100 : 0;
    const grandUnc     = Math.max(0, grandMain - grandSub);
    const multiArea    = areaItems.length > 1;

    // Build summary rows for the HTML report
    const summaryRows = areaItems.map(ai => {
      const areaLabel = multiArea ? `<strong>${esc(ai.area.name)}</strong><br>` : '';
      const subRows_ = ai.subs.map(s =>
        `<tr><td>${areaLabel}Teilfläche #${s.idx}</td><td class="num">${fmtDe(s.area)} ${u}²</td><td class="num">${fmtDe(s.perim)} ${u}</td><td class="num">${pctDe(s.pct)} %</td></tr>`
      ).join('');
      const mainRow = `<tr><td><strong>${multiArea ? esc(ai.area.name) + ' – ' : ''}Hauptfläche</strong></td><td class="num">${fmtDe(ai.mainArea)} ${u}²</td><td class="num">${fmtDe(ai.mainPerim)} ${u}</td><td class="num">100,0 %</td></tr>`;
      return mainRow + subRows_;
    }).join('');

    const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>
  body { font-family: Calibri, "Segoe UI", Arial, sans-serif; font-size: 11pt; color: #1a1a1a; line-height: 1.45; }
  h1 { font-size: 18pt; margin: 0 0 4pt; }
  h1 .sub { font-size: 12pt; color: #555; font-weight: normal; }
  h2 { font-size: 13pt; border-bottom: 1pt solid #444; padding-bottom: 3pt; margin: 18pt 0 6pt; }
  .meta { font-size: 9pt; color: #555; margin-bottom: 14pt; }
  p { margin: 5pt 0; }
  .img-wrap { text-align: center; margin: 6pt 0 3pt; }
  .img-wrap img { border: 0.75pt solid #888; }
  .caption { text-align: center; font-size: 9pt; color: #555; font-style: italic; margin: 3pt 0 12pt; }
  table { width: 100%; border-collapse: collapse; margin: 6pt 0 12pt; font-size: 10pt; }
  table.kv td { padding: 4pt 8pt; border: 0.75pt solid #aaa; }
  table.kv td.lbl { background-color: #f1efe8; font-weight: bold; width: 40%; }
  table.kv td.val { font-family: Consolas, "Courier New", monospace; }
  table.summ th { padding: 5pt 8pt; border: 0.75pt solid #888; background-color: #e8e3d6; font-weight: bold; text-align: left; }
  table.summ td { padding: 5pt 8pt; border: 0.75pt solid #aaa; }
  table.summ td.num { text-align: right; font-family: Consolas, "Courier New", monospace; }
  table.summ tr.total td { background-color: #f5f2ea; font-weight: bold; border-top: 1pt solid #555; }
  .highlight { background-color: #f5f2ea; border: 0.75pt solid #aaa; border-left: 4pt solid #1860a8; padding: 8pt 12pt; margin: 8pt 0 12pt; }
  .highlight .big { font-size: 14pt; font-weight: bold; color: #1860a8; font-family: Consolas, "Courier New", monospace; }
  .calc { font-family: Consolas, "Courier New", monospace; font-size: 8pt; background-color: #f8f6ef; border: 0.75pt solid #aaa; padding: 8pt; white-space: pre-wrap; line-height: 1.35; }
</style></head><body>
<h1>${esc(projName)} <span class="sub">— Bildflächen-Messbericht</span></h1>
<div class="meta">Erstellt am ${esc(dateStr)} · ${esc(shortFileName)} (${c.origImgW} × ${c.origImgH} px)${state.projectDescription ? '<br><em>' + esc(state.projectDescription) + '</em>' : ''}</div>

<h2>1. Originalbild</h2>
<p class="img-wrap"><img src="${orig.url}" width="${orig.w}" height="${orig.h}" alt="Originalbild"></p>
<div class="caption">Originalfoto, wie es vom Benutzer hochgeladen wurde (${c.origImgW} × ${c.origImgH} Pixel).</div>

<h2>2. Entzerrtes Bild</h2>
<p>Das Originalfoto wurde mittels einer 4-Punkt-Homographie entzerrt. Die vier Eckpunkte eines bekannten Referenz-Rechtecks (${esc(c.realW + ' × ' + c.realH + ' ' + u)}) wurden markiert, daraus wird eine 3×3-Transformationsmatrix berechnet und das Bild in eine maßstabsgetreue Draufsicht umgewandelt.</p>
<table class="kv">
  <tr><td class="lbl">Referenz-Rechteck</td><td class="val">${c.realW} × ${c.realH} ${u}</td></tr>
  <tr><td class="lbl">Pixel-Fläche der Referenz</td><td class="val">${fmtDe(c.quadAreaPx)} px²</td></tr>
  <tr><td class="lbl">Skalierungsfaktor</td><td class="val">${nf(c.pxPerUnit, 4)} px pro ${u}</td></tr>
  <tr><td class="lbl">Maßstab</td><td class="val">1 px = ${nf(c.uniformScale, 6)} ${u}</td></tr>
  <tr><td class="lbl">Größe des entzerrten Bildes</td><td class="val">${c.rectifiedW} × ${c.rectifiedH} px</td></tr>
</table>
<p class="img-wrap"><img src="${rect.url}" width="${rect.w}" height="${rect.h}" alt="Entzerrtes Bild"></p>
<div class="caption">Entzerrtes Bild (Draufsicht), ohne Markierungen.</div>

<h2>3. Markierte Flächen</h2>
<p class="img-wrap"><img src="${annImg.url}" width="${annImg.w}" height="${annImg.h}" alt="Markierte Flächen"></p>
<div class="caption">Entzerrtes Bild mit eingezeichneten Flächen.</div>

<h2>4. Zusammenfassung</h2>
<div class="highlight">Gesamte Hauptfläche: <span class="big">${fmtDe(grandMain)} ${u}²</span> · Teilflächen: <span class="big">${fmtDe(grandSub)} ${u}²</span> · Abdeckung: <span class="big">${pctDe(grandCov)} %</span></div>
<table class="summ">
  <thead><tr><th>Fläche</th><th>Inhalt</th><th>Umfang</th><th>Anteil</th></tr></thead>
  <tbody>
    ${summaryRows}
    <tr class="total"><td>Teilflächen gesamt</td><td class="num">${fmtDe(grandSub)} ${u}²</td><td class="num">—</td><td class="num">${pctDe(grandCov)} %</td></tr>
    <tr><td>Nicht abgedeckter Bereich</td><td class="num">${fmtDe(grandUnc)} ${u}²</td><td class="num">—</td><td class="num">${pctDe(100 - grandCov)} %</td></tr>
  </tbody>
</table>

<h2>5. Vollständige Berechnungen</h2>
<div class="calc">${esc(calcText)}</div>
</body></html>`;

    const margins = { orientation: 'portrait', margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 } };
    let blob;

    if (state._templateBlob) {
      try {
        blob = await mergeWithTemplate(state._templateBlob, html, {
          projektname: projName,
          beschreibung: state.projectDescription || '',
          datum: dateStr,
          bildname: shortFileName,
          einheit: u,
        });
      } catch (err) {
        alert(`Vorlage konnte nicht angewendet werden:\n${err.message}\n\nDas Dokument wird ohne Vorlage erstellt.`);
        blob = htmlDocx.asBlob(html, margins);
        if (typeof JSZip !== 'undefined') blob = await injectWordHdrFtr(blob, projName, dateStr);
      }
    } else {
      blob = htmlDocx.asBlob(html, margins);
      if (typeof JSZip !== 'undefined') blob = await injectWordHdrFtr(blob, projName, dateStr);
    }

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${projName.replace(/[\\/:*?"<>|]/g, '_')}.docx`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); document.body.removeChild(a); }, 1000);
  }
  $('downloadDocxBtn').addEventListener('click', exportDocx);

  // ===========================================================
  // Template upload
  // ===========================================================

  templateFileInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    state._templateBlob = f;
    state._templateName = f.name;
    templateFileNameText.textContent = f.name;
    templateFileNameEl.style.display = 'flex';
    clearTemplateBtn.style.display = '';
    templateFileInput.value = '';
  });

  clearTemplateBtn.addEventListener('click', () => {
    state._templateBlob = null;
    state._templateName = null;
    templateFileNameEl.style.display = 'none';
    clearTemplateBtn.style.display = 'none';
  });

  // ===========================================================
  // Calibration panel collapse
  // ===========================================================

  function setCalibCollapsed(v) {
    state.calibCollapsed = v;
    const collapsed = v && !!state.calibration;
    panel2Body.style.display     = collapsed ? 'none' : '';
    calibSummaryEl.style.display = collapsed ? 'block' : 'none';
    panel2Chevron.classList.toggle('is-collapsed', collapsed);
    if (collapsed) {
      const c = state.calibration;
      calibSummaryEl.textContent =
        `${c.realW} × ${c.realH} ${c.unit} — ${(1 / c.pxPerUnit).toFixed(4)} ${c.unit}/px`;
    }
  }

  panel2Toggle.addEventListener('click', () => {
    if (panel2.classList.contains('disabled')) return;
    setCalibCollapsed(!state.calibCollapsed);
  });

  // ===========================================================
  // Project management
  // ===========================================================

  function updateTopbarProject() {
    topbarProjName.textContent = state.projectName;
  }

  function updateProjInfoPanel() {
    projInfoName.textContent = state.projectName;
    projDescEdit.value       = state.projectDescription;
  }

  function hideLauncher() {
    projLauncher.style.display  = 'none';
    topbarProject.style.display = 'flex';
    projInfoPanel.style.display = 'block';
    updateTopbarProject();
    updateProjInfoPanel();
  }

  function saveProject() {
    const data = {
      version: 1,
      projectName:        state.projectName,
      projectDescription: state.projectDescription,
      fileName:           state.fileName || '',
      imageDataURL: state._imageDataURL || null,
      unit:         state.unit,
      calibPoints:  state.calibPoints,
      calibration:  state.calibration ? {
        method:         state.calibration.method,
        origImgW:       state.calibration.origImgW,
        origImgH:       state.calibration.origImgH,
        srcPoints:      state.calibration.srcPoints,
        dstPointsLocal: state.calibration.dstPointsLocal,
        realW:          state.calibration.realW,
        realH:          state.calibration.realH,
        pxPerUnit:      state.calibration.pxPerUnit,
        uniformScale:   state.calibration.uniformScale,
        rectifiedW:     state.calibration.rectifiedW,
        rectifiedH:     state.calibration.rectifiedH,
        quadAreaPx:     state.calibration.quadAreaPx,
        H:    Array.from(state.calibration.H),
        Hinv: Array.from(state.calibration.Hinv),
        unit: state.calibration.unit,
      } : null,
      areas: state.areas.map(a => ({
        id: a.id,
        name: a.name,
        main: a.main && a.main.closed ? a.main : null,
        subs: (a.subs || []).filter(s => s.closed),
      })),
      activeAreaIdx: state.activeAreaIdx,
    };
    const json = JSON.stringify(data);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const safeName = (state.projectName || 'projekt').replace(/[^\wÀ-ɏ\- ]/g, '_');
    a.download = `${safeName}.planer`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  function areaDataToState(data) {
    if (data.areas && data.areas.length) {
      return {
        areas: data.areas.map(a => ({
          id: a.id || Date.now(),
          name: a.name || 'Bereich 1',
          main: a.main && a.main.closed ? a.main : null,
          subs: (a.subs || []).filter(s => s.closed),
        })),
        activeAreaIdx: Math.min(data.activeAreaIdx || 0, data.areas.length - 1),
      };
    }
    return {
      areas: [{
        id: Date.now(),
        name: 'Bereich 1',
        main: data.main && data.main.closed ? data.main : null,
        subs: (data.subs || []).filter(s => s.closed),
      }],
      activeAreaIdx: 0,
    };
  }

  function restoreProjectData(data) {
    state.projectName        = data.projectName        || 'Unbekanntes Projekt';
    state.projectDescription = data.projectDescription || '';
    state._imageDataURL      = data.imageDataURL        || null;
    hideLauncher();

    if (!data.imageDataURL) {
      state.unit = data.unit || 'cm';
      unitSelect.value = state.unit;
      updateUnitDisplay();
      setSteps();
      return;
    }

    const img = new Image();
    img.onerror = () => alert('Das Bild in der Projektdatei konnte nicht geladen werden.');
    img.onload = () => {
      Object.assign(state, {
        imgOrig:     img,
        imgW:        img.naturalWidth,
        imgH:        img.naturalHeight,
        fileName:    data.fileName || '',
        unit:        data.unit || 'cm',
        calibPoints: data.calibPoints || [],
        drawing:     null,
      });

      unitSelect.value = state.unit;
      updateUnitDisplay();

      if (data.calibration) {
        const c = data.calibration;
        const rectified = document.createElement('canvas');
        rectified.width  = c.rectifiedW;
        rectified.height = c.rectifiedH;
        warpImageInverse(img, rectified, c.rectifiedW, c.rectifiedH, c.Hinv, 60);

        const areaState = areaDataToState(data);
        if (!areaState.areas.length) {
          areaState.areas = [{ id: Date.now(), name: 'Bereich 1', main: null, subs: [] }];
          areaState.activeAreaIdx = 0;
        }
        Object.assign(state, {
          img:        rectified,
          stretchedW: c.rectifiedW,
          stretchedH: c.rectifiedH,
          scaleX:     c.uniformScale,
          scaleY:     c.uniformScale,
          calibration: c,
          mode:       'measure',
          ...areaState,
        });

        realW.value = c.realW;
        realH.value = c.realH;
        statScaleWrap.style.display = 'flex';
        statScale.textContent = `${c.uniformScale.toFixed(4)} ${c.unit}/px`;
        setCalibCollapsed(true);
      } else {
        Object.assign(state, {
          img:        img,
          stretchedW: img.naturalWidth,
          stretchedH: img.naturalHeight,
          scaleX:     1,
          scaleY:     1,
          calibration: null,
          mode:       'calibrate',
          areas:      [],
          activeAreaIdx: 0,
        });
        statScaleWrap.style.display = 'none';
        setCalibCollapsed(false);
      }

      emptyMsg.style.display   = 'none';
      canvasWrap.style.display = 'block';
      toolbar.style.display    = 'flex';

      uploadZone.classList.add('has-file');
      uploadTitle.textContent = data.fileName || 'Geladenes Bild';
      uploadSub.textContent   = `${state.imgW} × ${state.imgH} px`;
      uploadIcon.innerHTML    = '<polyline points="20 6 9 17 4 12"/>';
      uploadIcon.setAttribute('stroke-width', '2.5');
      statImage.textContent   = `${state.imgW}×${state.imgH}`;

      fitToView();
      render();
      setSteps();
      updateApplyButton();
    };
    img.src = data.imageDataURL;
  }

  function loadPlanarFile(file) {
    const reader = new FileReader();
    reader.onerror = () => alert('Die Projektdatei konnte nicht gelesen werden.');
    reader.onload = (ev) => {
      let data;
      try { data = JSON.parse(ev.target.result); } catch (err) {
        alert('Ungültige .planer Datei — JSON-Fehler.');
        return;
      }
      if (!data || data.version !== 1) { alert('Nicht unterstütztes Dateiformat.'); return; }
      restoreProjectData(data);
    };
    reader.readAsText(file);
  }

  newProjBtn.addEventListener('click', () => {
    projOptions.style.display = 'none';
    newProjForm.style.display = 'block';
    projectNameInput.focus();
  });

  backProjBtn.addEventListener('click', () => {
    newProjForm.style.display = 'none';
    projOptions.style.display = 'grid';
    projectNameInput.value    = '';
    projectDescInput.value    = '';
    startProjBtn.disabled     = true;
  });

  projectNameInput.addEventListener('input', () => {
    startProjBtn.disabled = projectNameInput.value.trim().length === 0;
  });

  projectNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !startProjBtn.disabled) startProjBtn.click();
  });

  startProjBtn.addEventListener('click', () => {
    if (startProjBtn.disabled) return;
    state.projectName        = projectNameInput.value.trim();
    state.projectDescription = projectDescInput.value.trim();
    hideLauncher();
    persistState();
  });

  projInfoToggle.addEventListener('click', () => {
    const isOpen = projInfoBody.style.display !== 'none';
    projInfoBody.style.display = isOpen ? 'none' : 'block';
    projInfoChevron.classList.toggle('is-collapsed', isOpen);
  });

  projDescEdit.addEventListener('input', () => {
    state.projectDescription = projDescEdit.value;
    persistState();
  });

  planerFileInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) loadPlanarFile(f);
    planerFileInput.value = '';
  });

  saveProjBtn.addEventListener('click', saveProject);

  // ===========================================================
  // Back to launcher
  // ===========================================================

  function goBackToLauncher() {
    try { localStorage.removeItem('planer_autosave'); } catch (e) {}

    Object.assign(state, {
      img: null, imgOrig: null,
      areas: [], activeAreaIdx: 0, drawing: null,
      calibPoints: [], calibration: null,
      mode: 'idle', scaleX: 1, scaleY: 1,
      realW: null, realH: null,
      _imageDataURL: null, calibCollapsed: false,
      projectName: '', projectDescription: '', fileName: '',
    });

    emptyMsg.style.display       = 'block';
    canvasWrap.style.display     = 'none';
    toolbar.style.display        = 'none';
    fileInput.value              = '';
    realW.value                  = '';
    realH.value                  = '';
    uploadZone.classList.remove('has-file');
    uploadTitle.textContent      = 'Bild hierher ziehen oder klicken';
    uploadSub.textContent        = 'JPG, PNG, WebP';
    uploadIcon.innerHTML         = '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>';
    uploadIcon.setAttribute('stroke-width', '2');
    statImage.textContent        = '—';
    statScaleWrap.style.display  = 'none';
    statCursor.textContent       = '—';

    projInfoPanel.style.display  = 'none';
    projInfoBody.style.display   = 'none';
    projInfoChevron.classList.add('is-collapsed');
    topbarProject.style.display  = 'none';

    projLauncher.style.display   = '';
    projOptions.style.display    = 'grid';
    newProjForm.style.display    = 'none';
    projectNameInput.value       = '';
    projectDescInput.value       = '';
    startProjBtn.disabled        = true;

    setCalibCollapsed(false);
    setSteps();
  }

  backToLauncherBtn.addEventListener('click', () => {
    leaveModal.style.display = 'flex';
  });

  modalCancelBtn.addEventListener('click', () => {
    leaveModal.style.display = 'none';
  });

  modalDiscardBtn.addEventListener('click', () => {
    leaveModal.style.display = 'none';
    goBackToLauncher();
  });

  modalSaveBtn.addEventListener('click', () => {
    leaveModal.style.display = 'none';
    saveProject();
    goBackToLauncher();
  });

  leaveModal.addEventListener('click', (e) => {
    if (e.target === leaveModal) leaveModal.style.display = 'none';
  });

  // ===========================================================
  // Auto-save to localStorage
  // ===========================================================

  let _persistTimer = 0;
  function persistState() {
    if (!state.projectName) return;
    clearTimeout(_persistTimer);
    _persistTimer = setTimeout(() => {
      const data = {
        version:            1,
        projectName:        state.projectName,
        projectDescription: state.projectDescription,
        fileName:           state.fileName || '',
        imageDataURL:       state._imageDataURL || null,
        unit:               state.unit,
        calibPoints:        state.calibPoints,
        calibration: state.calibration ? {
          method:         state.calibration.method,
          origImgW:       state.calibration.origImgW,
          origImgH:       state.calibration.origImgH,
          srcPoints:      state.calibration.srcPoints,
          dstPointsLocal: state.calibration.dstPointsLocal,
          realW:          state.calibration.realW,
          realH:          state.calibration.realH,
          pxPerUnit:      state.calibration.pxPerUnit,
          uniformScale:   state.calibration.uniformScale,
          rectifiedW:     state.calibration.rectifiedW,
          rectifiedH:     state.calibration.rectifiedH,
          quadAreaPx:     state.calibration.quadAreaPx,
          H:    Array.from(state.calibration.H),
          Hinv: Array.from(state.calibration.Hinv),
          unit: state.calibration.unit,
        } : null,
        areas: state.areas.map(a => ({
          id: a.id,
          name: a.name,
          main: a.main && a.main.closed ? a.main : null,
          subs: (a.subs || []).filter(s => s.closed),
        })),
        activeAreaIdx: state.activeAreaIdx,
        savedAt: new Date().toISOString(),
      };
      try { localStorage.setItem('planer_autosave', JSON.stringify(data)); } catch (e) {}
    }, 800);
  }

  // ===========================================================
  // Init
  // ===========================================================

  (() => {
    try {
      const saved = localStorage.getItem('planer_autosave');
      if (saved) {
        const data = JSON.parse(saved);
        if (data && data.version === 1 && data.projectName && continueProjBtn) {
          continueProjName.textContent = data.projectName;
          continueProjDate.textContent = data.savedAt
            ? `Gespeichert: ${new Date(data.savedAt).toLocaleString('de-DE')}`
            : 'Letztes Projekt fortsetzen';
          continueProjBtn.style.display = 'flex';
          continueProjBtn.addEventListener('click', () => restoreProjectData(data));
        }
      }
    } catch (e) {}
  })();

  setSteps();
  updateUnitDisplay();

})();
