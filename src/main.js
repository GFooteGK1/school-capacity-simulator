import { generateFigureSVG, generateIconSVG, generateDotSVG, FIGURE_COLORS } from './people-figures.js';
import { initPhotoAssets, photoAssetsReady, generatePhotoHTML, getPhotoContainerSize } from './people-photos.js';
import {
  initSdk, subscribeToPose, getCurrentIntersection,
  worldToScreen, screenToFloor, isSdkReady, dispose as disposeSdk,
} from './sdk-connection.js';

// ============================================================
// CONFIG
// ============================================================
const CONFIG = {
  SDK_KEY: import.meta.env.VITE_MATTERPORT_SDK_KEY || '',
  MODEL_SID: import.meta.env.VITE_MATTERPORT_MODEL_SID || 'hvvUfPkLBME',
};

// Available Matterport scans — add your models here
const AVAILABLE_SCANS = [
  { label: 'Miami', sid: 'hvvUfPkLBME' },
  { label: 'NYC', sid: 'eF6draWWSc4' },
  { label: 'SF', sid: 'bnbm9Ld3ZKw' },
  { label: 'Santa Barbara', sid: 't97Z5DfGrvT' },
  { label: 'Co2', sid: '88Uft666Xwm' },
  { label: 'Spyglass', sid: '9qADiP1MbGQ' },
];

// ============================================================
// CONSTANTS
// ============================================================
const ROLES = ['Teacher', 'Student', 'Admin', 'Visitor', 'Staff', 'Parent', 'Custodian', 'Other'];
const ROLE_ICONS = {
  Teacher: '📚', Student: '🎒', Admin: '💼', Visitor: '👋',
  Staff: '🔧', Parent: '👨‍👩‍👧', Custodian: '🧹', Other: '👤',
};
const MIXED_WEIGHTS = { Student: 0.5, Teacher: 0.15, Admin: 0.05, Staff: 0.1, Visitor: 0.1, Parent: 0.1 };

// ============================================================
// STATE
// ============================================================
let people = [];
let figureStyle = 'photo';
let figureSize = 60;
let perspectiveStrength = 70;
let selectedRole = 'Student';
let placementMode = null; // null | 'bulk' | 'single'
let nextId = 1;

// SDK state
let sdkReady = false;
let sdkFallbackMode = false;

// Lasso drawing state
let lassoPoints = [];    // array of {x, y} pixel points
let isDrawingLasso = false;
let savedIntersection = null; // 3D reference captured before canvas overlay appears

// Per-figure selection
let selectedPersonId = null;

// Camera-tracking render loop
let rafPending = false;

// ============================================================
// DOM
// ============================================================
const $ = (id) => document.getElementById(id);

// ============================================================
// INIT
// ============================================================
async function init() {
  loadState();
  buildRoleGrid();
  buildScanSelect();
  bindEvents();
  renderAll();

  // Connect to Matterport — non-blocking, UI is already usable
  loadMatterportScan(CONFIG.MODEL_SID);

  // Load photo assets in background — non-blocking
  await initPhotoAssets();
  renderFigures();
}

// ============================================================
// MATTERPORT
// ============================================================
async function loadMatterportScan(sid) {
  $('statusText').textContent = `Loading ${sid}...`;
  $('statusText').classList.remove('connected');

  // Try SDK connection first
  if (CONFIG.SDK_KEY) {
    try {
      // Remove the old iframe — let setupSdk create a fresh one
      const oldIframe = $('mpIframe');
      if (oldIframe) oldIframe.remove();

      // Timeout after 30s to allow for slow connections
      const sdkPromise = initSdk(CONFIG.SDK_KEY, sid);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SDK connection timed out')), 30000)
      );
      await Promise.race([sdkPromise, timeoutPromise]);

      sdkReady = true;
      sdkFallbackMode = false;

      // Subscribe to camera pose changes → update figure positions every frame
      subscribeToPose(onCameraPoseChange);

      $('statusText').textContent = `● SDK Connected — ${sid}`;
      $('statusText').classList.add('connected');
      showToast('SDK connected — figures anchor in 3D');

      // Update positions for any existing anchored figures
      schedulePositionUpdate();
      return;
    } catch (err) {
      console.error('SDK connection failed:', err);
      sdkReady = false;
      sdkFallbackMode = true;
      showToast(`SDK failed: ${err.message || err}`);
    }
  } else {
    sdkFallbackMode = true;
  }

  // Fallback: direct iframe URL (legacy mode)
  // Ensure iframe exists
  let iframe = $('mpIframe');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'mpIframe';
    iframe.allow = 'fullscreen; xr-spatial-tracking';
    iframe.allowFullscreen = true;
    $('viewport').insertBefore(iframe, $('viewport').firstChild);
  }
  iframe.src = `https://my.matterport.com/show/?m=${sid}&play=1&qs=1&help=0&brand=0&gt=0&hr=0&mls=2&mt=0&pin=0&portal=0&lang=en`;
  iframe.addEventListener('load', () => {
    $('statusText').textContent = `● Connected (2D) — ${sid}`;
    $('statusText').classList.add('connected');
  }, { once: true });
}

// ============================================================
// EVENTS
// ============================================================
function bindEvents() {
  // Bulk placement
  $('placeBtn').addEventListener('click', startBulkPlacement);
  $('cancelBtn').addEventListener('click', cancelPlacement);

  // Single placement
  $('placeSingleBtn').addEventListener('click', startSinglePlacement);

  // Zone canvas — draw rectangle for bulk placement (legacy fallback)
  const canvas = $('zoneCanvas');
  canvas.addEventListener('mousedown', onZoneMouseDown);
  canvas.addEventListener('mousemove', onZoneMouseMove);
  canvas.addEventListener('mouseup', onZoneMouseUp);

  // SDK mode: detect clicks on iframe via window.blur
  window.addEventListener('blur', onWindowBlur);

  // Panel
  $('panelToggle').addEventListener('click', togglePanel);
  $('clearBtn').addEventListener('click', clearAll);
  $('exportBtn').addEventListener('click', exportJSON);
  $('limitInput').addEventListener('change', () => { updateOccupancy(); saveState(); });

  // Load scan on dropdown selection
  $('scanSelect').addEventListener('change', async () => {
    const sid = $('scanSelect').value;
    const scanLabel = AVAILABLE_SCANS.find(s => s.sid === sid)?.label || sid;
    if (sid) {
      if (people.some(p => p.anchor)) {
        showToast('Switching scans — 3D-anchored people are scan-specific');
      }
      CONFIG.MODEL_SID = sid;
      await loadMatterportScan(sid);
      if (sdkReady) schedulePositionUpdate();
      showToast(`Loading ${scanLabel}...`);
    }
  });

  // Load custom model
  $('loadModelBtn').addEventListener('click', async () => {
    const sid = $('modelInput').value.trim();
    if (sid) {
      CONFIG.MODEL_SID = sid;
      await loadMatterportScan(sid);
      if (sdkReady) schedulePositionUpdate();
      showToast(`Loading model ${sid}...`);
    }
  });

  // Figure size slider
  $('figureSize').addEventListener('input', (e) => {
    figureSize = parseInt(e.target.value);
    $('sizeVal').textContent = figureSize + 'px';
    renderFigures();
    saveState();
  });

  // Perspective slider
  $('perspectiveSlider').addEventListener('input', (e) => {
    perspectiveStrength = parseInt(e.target.value);
    $('perspectiveVal').textContent = perspectiveStrength + '%';
    renderFigures();
    saveState();
  });

  // Deselect on viewport background click
  $('viewport').addEventListener('click', (e) => {
    if (e.target === $('viewport') || e.target === $('mpIframe')) {
      deselectPerson();
    }
  });

  // Deselect on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && selectedPersonId !== null) {
      deselectPerson();
    }
  });

  // Scale popup — prevent clicks from bubbling to viewport
  $('scalePopup').addEventListener('click', (e) => e.stopPropagation());

  // Scale slider input
  $('scaleSlider').addEventListener('input', (e) => {
    if (selectedPersonId === null) return;
    const p = people.find(p => p.id === selectedPersonId);
    if (!p) return;
    p.scale = parseFloat(e.target.value);
    $('scaleValueDisplay').textContent = p.scale.toFixed(2) + '×';
    renderFigures();
    saveState();
  });

  // Scale reset button
  $('scaleResetBtn').addEventListener('click', () => {
    if (selectedPersonId === null) return;
    const p = people.find(p => p.id === selectedPersonId);
    if (!p) return;
    p.scale = 1.0;
    $('scaleSlider').value = '1.0';
    $('scaleValueDisplay').textContent = '1.00×';
    renderFigures();
    saveState();
  });

  // Scale popup close button
  $('scalePopupClose').addEventListener('click', () => deselectPerson());

  // Resize canvas with viewport
  window.addEventListener('resize', () => {
    resizeCanvas();
    if (sdkReady) schedulePositionUpdate();
  });
  resizeCanvas();
}

// ============================================================
// SDK CLICK DETECTION (window.blur)
// When user clicks on iframe in SDK mode, parent window loses focus.
// We read the cached Pointer.intersection for the 3D click position.
// ============================================================
function onWindowBlur() {
  // Only handles single placement in SDK mode
  // (bulk uses canvas lasso in all modes)
  if (!sdkReady || placementMode !== 'single') return;

  const intersection = getCurrentIntersection();
  if (!intersection || !intersection.position) return;

  const anchor = {
    x: intersection.position.x,
    y: intersection.position.y,
    z: intersection.position.z,
  };
  const floorIndex = intersection.floorIndex;

  addSinglePerson3D(anchor, floorIndex);
  // Stay in single placement mode — user can keep clicking to place more
  $('placementText').innerHTML = `Placed! Keep clicking to place more <strong>${selectedRole}s</strong>. Press Cancel to stop.`;
  // Refocus parent so next iframe click triggers another blur
  setTimeout(() => window.focus(), 50);
}

// ============================================================
// ROLE GRID (for single placement)
// ============================================================
const SINGLE_ROLES = ['Teacher', 'Student'];

function buildRoleGrid() {
  $('roleGrid').innerHTML = SINGLE_ROLES.map((r) =>
    `<button class="role-chip ${r === selectedRole ? 'active' : ''}" data-role="${r}">
      <span>${ROLE_ICONS[r]}</span><span style="font-size:11px">${r}</span>
    </button>`
  ).join('');
  $('roleGrid').querySelectorAll('.role-chip').forEach((btn) => {
    btn.addEventListener('click', () => { selectedRole = btn.dataset.role; buildRoleGrid(); });
  });
}

// ============================================================
// SCAN SELECT (for loading different models)
// ============================================================
function buildScanSelect() {
  const select = $('scanSelect');
  select.innerHTML = AVAILABLE_SCANS.map((scan, index) =>
    `<option value="${scan.sid}" ${scan.sid === CONFIG.MODEL_SID ? 'selected' : ''}>
      ${scan.label}
    </option>`
  ).join('');
}

// ============================================================
// BULK PLACEMENT — zone-based
// ============================================================
function startBulkPlacement() {
  if (placementMode === 'bulk') { cancelPlacement(); return; }
  placementMode = 'bulk';
  const count = parseInt($('countInput').value) || 10;
  const role = $('roleSelect').value;

  // Capture the 3D intersection BEFORE the canvas overlay blocks the iframe
  if (sdkReady) {
    savedIntersection = getCurrentIntersection();
  }

  $('placementText').innerHTML = `Draw a shape around the area for <strong>${count} ${role === 'Mixed' ? 'people' : role + 's'}</strong>`;
  $('placementBanner').classList.add('active');
  $('zoneCanvas').classList.add('active');
  resizeCanvas();

  $('placeBtn').textContent = '⏸ Cancel';
  $('placeBtn').classList.add('active-mode');
}

function startSinglePlacement() {
  if (placementMode === 'single') { cancelPlacement(); return; }
  placementMode = 'single';

  if (sdkReady) {
    // SDK mode: click on the 3D model
    $('placementText').innerHTML = `Click on the model to place a <strong>${selectedRole}</strong>`;
    $('placementBanner').classList.add('active');
    // Don't show canvas — let clicks pass to iframe
  } else {
    // Legacy: click on canvas overlay
    $('placementText').innerHTML = `Click to place a <strong>${selectedRole}</strong>`;
    $('placementBanner').classList.add('active');
    $('zoneCanvas').classList.add('active');
    resizeCanvas();
  }

  $('placeSingleBtn').textContent = '⏸ Cancel';
  $('placeSingleBtn').classList.add('active-mode');
}

function cancelPlacement() {
  placementMode = null;
  lassoPoints = [];
  isDrawingLasso = false;
  savedIntersection = null;
  clearCanvas();
  $('placementBanner').classList.remove('active');
  $('zoneCanvas').classList.remove('active');
  $('placeBtn').textContent = '📍 Select Area & Place';
  $('placeBtn').classList.remove('active-mode');
  $('placeSingleBtn').textContent = '👤 Place One Person';
  $('placeSingleBtn').classList.remove('active-mode');
}

// ============================================================
// ZONE CANVAS — freeform lasso drawing
// ============================================================
function resizeCanvas() {
  const canvas = $('zoneCanvas');
  const vp = $('viewport');
  canvas.width = vp.clientWidth;
  canvas.height = vp.clientHeight;
}

function clearCanvas() {
  const canvas = $('zoneCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function onZoneMouseDown(e) {
  if (!placementMode) return;
  const rect = $('viewport').getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (placementMode === 'single') {
    const px = x / rect.width;
    const py = y / rect.height;
    addSinglePersonLegacy(px, py);
    // Stay in single placement mode — user can keep clicking
    $('placementText').innerHTML = `Placed! Keep clicking to place more <strong>${selectedRole}s</strong>. Press Cancel to stop.`;
    return;
  }

  // Start lasso drawing for bulk
  isDrawingLasso = true;
  lassoPoints = [{ x, y }];
}

function onZoneMouseMove(e) {
  if (!isDrawingLasso || placementMode !== 'bulk') return;
  const rect = $('viewport').getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  lassoPoints.push({ x, y });
  drawLasso();
}

function onZoneMouseUp(e) {
  if (!isDrawingLasso || placementMode !== 'bulk') return;
  isDrawingLasso = false;

  if (lassoPoints.length < 3) {
    showToast('Draw a larger shape');
    clearCanvas();
    lassoPoints = [];
    return;
  }

  // Close the lasso and fill
  drawLasso(true);

  // Compute bounding box of lasso in viewport percentages
  const vpRect = $('viewport').getBoundingClientRect();
  const count = Math.min(parseInt($('countInput').value) || 10, 200);
  const role = $('roleSelect').value;

  // Convert lasso points to viewport percentages for point-in-polygon testing
  const polyPct = lassoPoints.map(p => ({
    x: p.x / vpRect.width,
    y: p.y / vpRect.height,
  }));

  addBulkPeopleInLasso(count, role, polyPct);
  cancelPlacement();
}

function drawLasso(closed = false) {
  const canvas = $('zoneCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (lassoPoints.length < 2) return;

  // Draw the lasso path
  ctx.beginPath();
  ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
  for (let i = 1; i < lassoPoints.length; i++) {
    ctx.lineTo(lassoPoints[i].x, lassoPoints[i].y);
  }
  if (closed) ctx.closePath();

  ctx.strokeStyle = 'rgba(232,93,58,0.8)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.stroke();

  // Semi-transparent fill
  if (closed) {
    ctx.fillStyle = 'rgba(232,93,58,0.08)';
    ctx.fill();
  }

  // Show count label at centroid
  const count = parseInt($('countInput').value) || 10;
  const cx = lassoPoints.reduce((s, p) => s + p.x, 0) / lassoPoints.length;
  const cy = lassoPoints.reduce((s, p) => s + p.y, 0) / lassoPoints.length;
  ctx.fillStyle = 'rgba(232,93,58,0.9)';
  ctx.font = 'bold 13px DM Sans, sans-serif';
  ctx.textAlign = 'center';
  ctx.setLineDash([]);
  ctx.fillText(`${count} people`, cx, cy + 5);
}

/**
 * Ray-casting point-in-polygon test.
 * Returns true if point (px, py) is inside the polygon defined by vertices.
 */
function pointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// ============================================================
// ADD PEOPLE — SDK 3D mode
// ============================================================
function addSinglePerson3D(anchor, floorIndex) {
  const name = `${selectedRole} ${nextId}`;
  people.push({
    id: nextId++,
    name,
    role: selectedRole,
    anchor: { x: anchor.x, y: anchor.y, z: anchor.z },
    floorIndex: floorIndex,
    scale: 1.0,
    colorIndex: Math.floor(Math.random() * 8),
    poseIndex: Math.floor(Math.random() * 100),
    flip: Math.random() > 0.5,
    timestamp: new Date().toISOString(),
  });
  renderAll();
  saveState();
  showToast(`Placed ${name} in 3D`);
}

function addBulkPeople3D(count, role, corner1, corner2, floorIndex) {
  const newPeople = [];

  // Bounding box in 3D — scatter on the floor plane (use Y from corner average)
  const minX = Math.min(corner1.x, corner2.x);
  const maxX = Math.max(corner1.x, corner2.x);
  const minZ = Math.min(corner1.z, corner2.z);
  const maxZ = Math.max(corner1.z, corner2.z);
  // Average Y (height) of the two corners — figures stand on the floor
  const floorY = (corner1.y + corner2.y) / 2;

  for (let i = 0; i < count; i++) {
    // Gaussian scatter within the 3D bounding box
    const ax = minX + (maxX - minX) * jitteredRandom();
    const az = minZ + (maxZ - minZ) * jitteredRandom();

    let thisRole = role;
    if (role === 'Mixed') {
      thisRole = weightedRandomRole();
    }

    const name = `${thisRole} ${nextId}`;
    newPeople.push({
      id: nextId++,
      name,
      role: thisRole,
      anchor: { x: ax, y: floorY, z: az },
      floorIndex: floorIndex,
      scale: 1.0,
      colorIndex: Math.floor(Math.random() * 8),
      poseIndex: Math.floor(Math.random() * 100),
      flip: Math.random() > 0.5,
      timestamp: new Date().toISOString(),
    });
  }

  people.push(...newPeople);
  renderAll();
  saveState();
  showToast(`Added ${count} ${role === 'Mixed' ? 'people' : role + 's'} in 3D`);
}

// ============================================================
// ADD PEOPLE — Legacy 2D mode (canvas click / lasso)
// ============================================================
function addSinglePersonLegacy(px, py) {
  const name = `${selectedRole} ${nextId}`;
  people.push({
    id: nextId++,
    name,
    role: selectedRole,
    position: { x: px, y: py },
    legacy: true,
    scale: 1.0,
    colorIndex: Math.floor(Math.random() * 8),
    poseIndex: Math.floor(Math.random() * 100),
    flip: Math.random() > 0.5,
    timestamp: new Date().toISOString(),
  });
  renderAll();
  saveState();
  showToast(`Placed ${name}`);
}

function addBulkPeopleInLasso(count, role, polygon) {
  // Compute bounding box of the lasso polygon
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  // If SDK is ready, try to project lasso points to 3D
  const use3D = sdkReady;
  let refPoint = null;
  let floorIndex = undefined;
  let iframeSize = null;

  if (use3D) {
    const iframe = $('mpIframe');
    iframeSize = { w: iframe.clientWidth, h: iframe.clientHeight };

    // Use the intersection captured when entering placement mode
    const intersection = savedIntersection;
    if (intersection && intersection.position) {
      refPoint = { x: intersection.position.x, y: intersection.position.y, z: intersection.position.z };
      floorIndex = intersection.floorIndex;
      console.log('3D ref point:', refPoint, 'floor:', floorIndex);
    } else {
      console.warn('No 3D intersection available — placing as 2D. Hover over the scan before entering placement mode.');
    }
  }

  const newPeople = [];
  const maxAttempts = count * 20;
  let attempts = 0;

  while (newPeople.length < count && attempts < maxAttempts) {
    attempts++;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const hw = (maxX - minX) / 2;
    const hh = (maxY - minY) / 2;

    const px = cx + hw * (jitteredRandom() * 2 - 1);
    const py = cy + hh * (jitteredRandom() * 2 - 1);

    if (!pointInPolygon(px, py, polygon)) continue;

    let thisRole = role;
    if (role === 'Mixed') {
      thisRole = weightedRandomRole();
    }

    const name = `${thisRole} ${nextId}`;
    const person = {
      id: nextId++,
      name,
      role: thisRole,
      scale: 1.0,
      colorIndex: Math.floor(Math.random() * 8),
      poseIndex: Math.floor(Math.random() * 100),
      flip: Math.random() > 0.5,
      timestamp: new Date().toISOString(),
    };

    // Try 3D anchoring via screen-to-floor projection
    if (use3D && refPoint && iframeSize) {
      const screenPx = px * iframeSize.w;
      const screenPy = py * iframeSize.h;
      const worldPos = screenToFloor(screenPx, screenPy, refPoint, iframeSize);
      if (worldPos) {
        person.anchor = worldPos;
        person.floorIndex = floorIndex;
      } else {
        // Fallback to 2D
        person.position = { x: px, y: py };
        person.legacy = true;
      }
    } else {
      person.position = { x: px, y: py };
      person.legacy = true;
    }

    newPeople.push(person);
  }

  people.push(...newPeople);
  renderAll();
  saveState();
  const mode = (use3D && refPoint) ? ' in 3D' : '';
  showToast(`Added ${newPeople.length} ${role === 'Mixed' ? 'people' : role + 's'}${mode}`);
}

// Gaussian-ish random that clusters toward center
function jitteredRandom() {
  const u1 = Math.random();
  const u2 = Math.random();
  // Box-Muller-ish — clamp to 0..1
  let val = 0.5 + 0.2 * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(0.02, Math.min(0.98, val));
}

function weightedRandomRole() {
  const r = Math.random();
  let cumulative = 0;
  for (const [role, weight] of Object.entries(MIXED_WEIGHTS)) {
    cumulative += weight;
    if (r <= cumulative) return role;
  }
  return 'Student';
}

// ============================================================
// CAMERA-TRACKING RENDER LOOP
// Projects 3D-anchored figures to screen coordinates every frame.
// ============================================================
function onCameraPoseChange() {
  schedulePositionUpdate();
}

function schedulePositionUpdate() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    updateFigurePositions();
  });
}

function updateFigurePositions() {
  if (!sdkReady) return;

  const iframe = $('mpIframe');
  if (!iframe) return;
  const iframeSize = { w: iframe.clientWidth, h: iframe.clientHeight };
  if (iframeSize.w === 0 || iframeSize.h === 0) return;

  people.forEach((p) => {
    if (!p.anchor) return; // Skip legacy figures
    const screen = worldToScreen(p.anchor, iframeSize);
    if (screen) {
      p._screenPos = { x: screen.x, y: screen.y, z: screen.z };
    } else {
      p._screenPos = null;
    }
  });

  applyFigurePositions();
}

function computeDepthScale(z, strength) {
  if (strength === 0) return 1.0;
  const refDepth = 8.0; // figures at 8m render at base size
  const rawScale = refDepth / Math.max(z, 0.5);
  const depthScale = 1.0 + (rawScale - 1.0) * strength;
  return Math.max(0.15, Math.min(3.0, depthScale));
}

function applyFigurePositions() {
  const layer = $('figuresLayer');
  if (!layer) return;

  people.forEach((p) => {
    if (!p.anchor) return; // Legacy figures use CSS percentages directly

    const el = layer.querySelector(`[data-id="${p.id}"]`);
    if (!el) return;

    if (!p._screenPos) {
      el.style.display = 'none';
      return;
    }

    const { x, y, z } = p._screenPos;

    // Hide if behind camera (z < 0) or way off screen
    if (z < 0) {
      el.style.display = 'none';
      return;
    }

    el.style.display = '';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    // Depth-based z-index: closer figures render on top (smaller z = closer)
    el.style.zIndex = Math.max(1, Math.round(1000 - z * 10));

    // Perspective scaling: closer figures appear larger, multiplied by per-person scale
    const personScale = p.scale ?? 1.0;
    const depthScale = computeDepthScale(z, perspectiveStrength / 100);
    const totalScale = depthScale * personScale;
    el.style.transform = `translate(-50%, -90%) scale(${totalScale.toFixed(3)})`;
    el.style.transformOrigin = '50% 90%'; // grow upward from feet
  });

  updateScalePopupPosition();
}

// ============================================================
// RENDER FIGURES
// ============================================================
function renderAll() {
  renderFigures();
  renderPeopleList();
  updateStats();
  updateOccupancy();
}

function computeLegacyPerspectiveScale(yPosition) {
  const strength = perspectiveStrength / 100;
  if (strength === 0) return 1.0;
  const power = 1.5 + strength * 0.8;
  const minScale = 1.0 - strength * 0.85;
  const maxScale = 1.0 + strength * 1.0;
  return minScale + (maxScale - minScale) * Math.pow(yPosition, power);
}

function renderFigures() {
  const layer = $('figuresLayer');
  const size = figureSize;

  layer.innerHTML = people.map((p) => {
    let figureHTML;
    let containerW, containerH;
    const personScale = p.scale ?? 1.0;

    if (figureStyle === 'photo' && photoAssetsReady()) {
      figureHTML = generatePhotoHTML(p.role, { poseIndex: p.poseIndex, flip: p.flip });
      const dims = getPhotoContainerSize(p.role, p.poseIndex, size * personScale);
      containerW = dims.width;
      containerH = dims.height;
    } else {
      switch (figureStyle === 'photo' ? 'silhouette' : figureStyle) {
        case 'silhouette': figureHTML = generateFigureSVG(p.role, { flip: p.flip }); break;
        case 'icon': figureHTML = generateIconSVG(p.role); break;
        case 'dot': figureHTML = generateDotSVG(p.role); break;
        default: figureHTML = generateFigureSVG(p.role, { flip: p.flip });
      }
      containerW = Math.round(size * personScale);
      containerH = Math.round(size * 1.15 * personScale);
    }

    const isLegacy = !p.anchor;
    const legacyClass = isLegacy ? ' legacy-figure' : '';
    const selectedClass = p.id === selectedPersonId ? ' selected' : '';

    if (isLegacy) {
      // Legacy: percentage-based positioning with perspective via Y position
      const perspScale = computeLegacyPerspectiveScale(p.position.y);
      const legacyZIndex = Math.round(p.position.y * 1000);
      return `
        <div class="figure-marker${legacyClass}${selectedClass}" style="
          left: ${p.position.x * 100}%;
          top: ${p.position.y * 100}%;
          width: ${Math.round(containerW * perspScale)}px;
          height: ${Math.round(containerH * perspScale)}px;
          z-index: ${legacyZIndex};
        " data-id="${p.id}" title="${p.name} (${p.role})">
          ${figureHTML}
        </div>`;
    } else {
      // SDK-anchored: position set off-screen initially, updated by render loop
      return `
        <div class="figure-marker${legacyClass}${selectedClass}" style="
          left: -200px;
          top: -200px;
          width: ${containerW}px;
          height: ${containerH}px;
        " data-id="${p.id}" title="${p.name} (${p.role})">
          ${figureHTML}
        </div>`;
    }
  }).join('');

  // Right-click to remove, left-click to select
  layer.querySelectorAll('.figure-marker').forEach((el) => {
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const id = parseInt(el.dataset.id);
      removePerson(id);
    });
    el.addEventListener('click', (e) => {
      if (placementMode !== null) return; // Don't select during placement
      e.stopPropagation();
      const id = parseInt(el.dataset.id);
      selectPerson(id);
    });
  });

  // After rendering, update SDK-anchored figure positions
  if (sdkReady) {
    updateFigurePositions();
  } else {
    updateScalePopupPosition();
  }
}

// ============================================================
// FIGURE SELECTION & SCALE POPUP
// ============================================================
function selectPerson(id) {
  // Deselect previous
  if (selectedPersonId !== null) {
    const prev = $('figuresLayer').querySelector(`[data-id="${selectedPersonId}"]`);
    if (prev) prev.classList.remove('selected');
  }

  selectedPersonId = id;
  const el = $('figuresLayer').querySelector(`[data-id="${id}"]`);
  if (el) el.classList.add('selected');

  // Init slider to this person's scale
  const p = people.find(p => p.id === id);
  if (p) {
    const s = p.scale ?? 1.0;
    $('scaleSlider').value = s;
    $('scaleValueDisplay').textContent = s.toFixed(2) + '×';
  }

  $('scalePopup').style.display = '';
  updateScalePopupPosition();
}

function deselectPerson() {
  if (selectedPersonId !== null) {
    const el = $('figuresLayer').querySelector(`[data-id="${selectedPersonId}"]`);
    if (el) el.classList.remove('selected');
  }
  selectedPersonId = null;
  $('scalePopup').style.display = 'none';
}

function updateScalePopupPosition() {
  if (selectedPersonId === null) {
    $('scalePopup').style.display = 'none';
    return;
  }

  const el = $('figuresLayer').querySelector(`[data-id="${selectedPersonId}"]`);
  if (!el || el.style.display === 'none') {
    $('scalePopup').style.display = 'none';
    return;
  }

  const popup = $('scalePopup');
  const vpRect = $('viewport').getBoundingClientRect();
  const figRect = el.getBoundingClientRect();

  // Position popup above the figure, centered horizontally
  let left = figRect.left + figRect.width / 2 - vpRect.left;
  let top = figRect.top - vpRect.top - 44; // 44px above figure

  // Constrain to viewport bounds
  const popupW = popup.offsetWidth || 280;
  left = Math.max(8, Math.min(left - popupW / 2, vpRect.width - popupW - 8));
  top = Math.max(8, top);

  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
  popup.style.display = '';
}

// ============================================================
// PEOPLE LIST
// ============================================================
function renderPeopleList() {
  const list = $('peopleList');
  $('peopleTitle').textContent = `People (${people.length})`;

  // Role summary
  const counts = {};
  people.forEach((p) => (counts[p.role] = (counts[p.role] || 0) + 1));
  $('roleSummary').innerHTML = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([role, count]) => {
      const colors = FIGURE_COLORS[role] || FIGURE_COLORS.Other;
      return `<span class="role-badge" style="background:${colors.body}20;color:${colors.accent};border-color:${colors.body}40">${ROLE_ICONS[role]} ${count} ${role}${count > 1 ? 's' : ''}</span>`;
    }).join('');

  if (people.length === 0) {
    list.innerHTML = '<p class="empty-text">No one placed yet.</p>';
    return;
  }

  // Show grouped summary if >20 people, individual cards if ≤20
  if (people.length > 20) {
    list.innerHTML = `
      <p class="summary-text">${people.length} people placed across the space. Right-click any figure to remove it.</p>
    `;
  } else {
    list.innerHTML = people.map((p) => {
      const colors = FIGURE_COLORS[p.role] || FIGURE_COLORS.Other;
      const modeLabel = p.anchor ? '3D' : '2D';
      return `
        <div class="person-card">
          <div class="person-avatar" style="background:${colors.body}">${ROLE_ICONS[p.role]}</div>
          <div class="person-info">
            <span class="person-name" data-edit="${p.id}">${p.name}</span>
            <span class="person-role-label" style="color:${colors.accent}">${p.role} <span style="opacity:0.5;font-size:9px">${modeLabel}</span></span>
          </div>
          <button class="remove-btn" data-remove="${p.id}">✕</button>
        </div>`;
    }).join('');

    list.querySelectorAll('[data-edit]').forEach((el) => {
      el.addEventListener('click', () => editPersonName(parseInt(el.dataset.edit)));
    });
    list.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => removePerson(parseInt(btn.dataset.remove)));
    });
  }
}

// ============================================================
// CRUD
// ============================================================
function removePerson(id) {
  if (selectedPersonId === id) deselectPerson();
  people = people.filter((p) => p.id !== id);
  renderAll();
  saveState();
}

function editPersonName(id) {
  const el = document.querySelector(`[data-edit="${id}"]`);
  const p = people.find((p) => p.id === id);
  if (!p || !el) return;
  const input = document.createElement('input');
  input.value = p.name;
  input.className = 'edit-inline';
  input.onblur = () => { p.name = input.value || p.name; renderAll(); saveState(); };
  input.onkeydown = (e) => { if (e.key === 'Enter') input.blur(); };
  el.replaceWith(input);
  input.focus();
  input.select();
}

function clearAll() {
  if (people.length === 0) return;
  deselectPerson();
  people = [];
  renderAll();
  saveState();
  showToast('All people cleared');
}

// ============================================================
// STATS & OCCUPANCY
// ============================================================
function updateStats() {
  const counts = {};
  people.forEach((p) => (counts[p.role] = (counts[p.role] || 0) + 1));
  $('statsBar').innerHTML = Object.entries(counts)
    .map(([role, count]) =>
      `<div class="stat-chip"><span>${ROLE_ICONS[role]}</span><span class="stat-label">${role}</span><span class="stat-count">${count}</span></div>`
    ).join('');
}

function updateOccupancy() {
  const limit = Math.max(1, parseInt($('limitInput').value) || 50);
  const pct = Math.min((people.length / limit) * 100, 100);
  const color = pct > 90 ? '#E85D3A' : pct > 70 ? '#D4A843' : '#2B8A6E';
  $('occBar').style.width = pct + '%';
  $('occBar').style.background = color;
  $('occText').style.color = color;
  $('occText').textContent = `${people.length}/${limit}`;
}

// ============================================================
// EXPORT
// ============================================================
function exportJSON() {
  const data = {
    modelSid: CONFIG.MODEL_SID,
    exportedAt: new Date().toISOString(),
    occupancyLimit: parseInt($('limitInput').value) || 50,
    totalPeople: people.length,
    figureStyle,
    figureSize,
    people: people.map((p) => {
      const entry = { name: p.name, role: p.role };
      if (p.anchor) {
        entry.anchor = p.anchor;
        entry.floorIndex = p.floorIndex;
      }
      if (p.position) {
        entry.position = p.position;
      }
      return entry;
    }),
    roleSummary: people.reduce((acc, p) => { acc[p.role] = (acc[p.role] || 0) + 1; return acc; }, {}),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `school-capacity-${CONFIG.MODEL_SID}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exported JSON');
}

// ============================================================
// PERSISTENCE
// ============================================================
function saveState() {
  try {
    // Strip transient _screenPos before saving
    const toSave = people.map(({ _screenPos, ...rest }) => rest);
    localStorage.setItem('pp_people', JSON.stringify(toSave));
    localStorage.setItem('pp_nextId', nextId);
    localStorage.setItem('pp_limit', $('limitInput').value);
    localStorage.setItem('pp_style', figureStyle);
    localStorage.setItem('pp_size', figureSize);
    localStorage.setItem('pp_perspective', perspectiveStrength);
  } catch (e) { /* */ }
}

function loadState() {
  try {
    const saved = localStorage.getItem('pp_people');
    if (saved) {
      people = JSON.parse(saved);

      // Migrate old data: people with position but no anchor are legacy
      people.forEach((p) => {
        if (p.position && !p.anchor) {
          p.legacy = true;
        }
      });

      nextId = parseInt(localStorage.getItem('pp_nextId')) || people.length + 1;
    }
    const limit = localStorage.getItem('pp_limit');
    if (limit) $('limitInput').value = limit;
    // figureStyle is always 'photo' now
    const size = localStorage.getItem('pp_size');
    if (size) {
      figureSize = parseInt(size);
      $('figureSize').value = figureSize;
      $('sizeVal').textContent = figureSize + 'px';
    }
    const perspective = localStorage.getItem('pp_perspective');
    if (perspective) {
      perspectiveStrength = parseInt(perspective);
      $('perspectiveSlider').value = perspectiveStrength;
      $('perspectiveVal').textContent = perspectiveStrength + '%';
    }
  } catch (e) { /* */ }
}

// ============================================================
// PANEL & TOAST
// ============================================================
function togglePanel() {
  const panel = $('panel');
  const btn = $('panelToggle');
  panel.classList.toggle('hidden');
  btn.textContent = panel.classList.contains('hidden') ? '☰' : '✕';
}

function showToast(msg) {
  const toast = $('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ============================================================
// BOOT
// ============================================================
init();
