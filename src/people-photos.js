// ============================================================
// PHOTO-REALISTIC FIGURE RENDERER
// Uses PNG cutout images (transparent background) per role
// ============================================================

// Role-based size multipliers — students look smaller/younger
const ROLE_SIZE_MULTIPLIER = {
  Student:   0.78,
  Teacher:   1.10,
};

let manifest = null;   // { role: [filename, ...] }
let ready = false;
const BASE = import.meta.env.BASE_URL || '/';

/**
 * Fetch manifest.json and preload all photo assets.
 * Non-blocking — the app works without photos until they load.
 */
export async function initPhotoAssets() {
  try {
    const res = await fetch(`${BASE}people/manifest.json`);
    if (!res.ok) throw new Error(`manifest.json ${res.status}`);
    manifest = await res.json();

    // Preload all images so they render instantly
    const preloads = [];
    for (const [role, files] of Object.entries(manifest)) {
      for (const file of files) {
        const img = new Image();
        img.src = `${BASE}people/${role}/${file}`;
        preloads.push(new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve; // don't block on missing images
        }));
      }
    }
    await Promise.all(preloads);
    ready = true;
  } catch (e) {
    console.warn('Photo assets not available:', e.message);
    ready = false;
  }
}

/**
 * Check if photo assets are loaded and ready.
 */
export function photoAssetsReady() {
  return ready;
}

/**
 * Generate an <img> tag for a photo cutout figure.
 * @param {string} role - Person role (Teacher, Student, etc.)
 * @param {object} options - { poseIndex, flip }
 * @returns {string} HTML string (img tag or fallback message)
 */
export function generatePhotoHTML(role = 'Other', options = {}) {
  const roleKey = role.toLowerCase();
  const files = manifest?.[roleKey];

  if (!files || files.length === 0) {
    // No photos for this role — return a placeholder
    return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:10px;color:rgba(255,255,255,0.4);">?</div>`;
  }

  // Deterministic image selection based on poseIndex
  const poseIndex = options.poseIndex ?? 0;
  const imageIndex = poseIndex % files.length;
  const file = files[imageIndex];
  const src = `${BASE}people/${roleKey}/${file}`;

  const flip = options.flip ? 'transform: scaleX(-1);' : '';

  return `<img src="${src}" alt="${role}" draggable="false" style="width:100%;height:100%;object-fit:contain;object-position:center bottom;${flip}">`;
}

/**
 * Get the size multiplier for a given role.
 */
export function getRoleSizeMultiplier(role) {
  return ROLE_SIZE_MULTIPLIER[role] ?? 1.0;
}

export { ROLE_SIZE_MULTIPLIER };
