// ============================================================
// PHOTO-REALISTIC FIGURE RENDERER
// Uses PNG cutout images (transparent background) per role
// ============================================================

// Per-image height scales — controls relative visual height
// Adults: 1.0, Teens: ~0.90-0.95, Kids: ~0.70-0.78
const PHOTO_SCALES = {
  'student/student_01.png': 0.92,
  'student/student_02.png': 0.93,
  'student/student_03.png': 0.91,
  'student/student_04.png': 0.94,
  'student/student_05.png': 0.90,
  'student/student_06.png': 0.92,
  'student/kid_01.png': 0.75,
  'student/kid_02.png': 0.73,
  'student/kid_03.png': 0.76,
  'student/kid_04.png': 0.74,
  'student/kid_05.png': 0.78,
  'student/kid_06.png': 0.72,
  'student/kid_07.png': 0.75,
  'teacher/teacher_01.png': 1.0,
  'teacher/admin_01.png': 1.0,
  'teacher/staff_01.png': 1.0,
  'teacher/staff_02.png': 1.0,
  'teacher/staff_03.png': 1.0,
  'teacher/staff_04.png': 1.0,
  'teacher/staff_05.png': 1.0,
  'teacher/visitor_01.png': 1.0,
};

// Target height-to-width ratio for the container (standing human ~2:1)
const TARGET_HEIGHT_RATIO = 2.0;

// Measured image dimensions: "role/filename" -> { width, height, aspect }
const imageDimensions = new Map();

let manifest = null;   // { role: [filename, ...] }
let ready = false;
const BASE = import.meta.env.BASE_URL || '/';

/**
 * Fetch manifest.json and preload all photo assets.
 * Captures natural dimensions of each image for height normalization.
 * Non-blocking — the app works without photos until they load.
 */
export async function initPhotoAssets() {
  try {
    const res = await fetch(`${BASE}people/manifest.json`);
    if (!res.ok) throw new Error(`manifest.json ${res.status}`);
    manifest = await res.json();

    // Preload all images and measure their natural dimensions
    const preloads = [];
    for (const [role, files] of Object.entries(manifest)) {
      for (const file of files) {
        const img = new Image();
        const key = `${role}/${file}`;
        img.src = `${BASE}people/${role}/${file}`;
        preloads.push(new Promise((resolve) => {
          img.onload = () => {
            imageDimensions.set(key, {
              width: img.naturalWidth,
              height: img.naturalHeight,
              aspect: img.naturalHeight / img.naturalWidth,
            });
            resolve();
          };
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
 * Compute container dimensions for a photo figure so all adults render at the
 * same visual height, with teens slightly shorter and kids noticeably shorter.
 *
 * @param {string} role - Person role (Teacher, Student, etc.)
 * @param {number} poseIndex - Index into the role's image list
 * @param {number} baseSize - The user's figure-size slider value (px)
 * @returns {{ width: number, height: number }}
 */
export function getPhotoContainerSize(role, poseIndex, baseSize) {
  const roleKey = role.toLowerCase();
  const files = manifest?.[roleKey];

  if (!files || files.length === 0) {
    // Fallback for missing manifest
    return { width: baseSize, height: baseSize * TARGET_HEIGHT_RATIO };
  }

  const imageIndex = (poseIndex ?? 0) % files.length;
  const file = files[imageIndex];
  const key = `${roleKey}/${file}`;

  // Per-image height scale (default 1.0 for unlisted images)
  const imageScale = PHOTO_SCALES[key] ?? 1.0;

  // Measured aspect ratio (height / width); fallback to TARGET_HEIGHT_RATIO
  const dims = imageDimensions.get(key);
  const aspect = dims ? dims.aspect : TARGET_HEIGHT_RATIO;

  // Target container height — all adults at baseSize * TARGET_HEIGHT_RATIO,
  // scaled down for teens/kids via imageScale
  const containerHeight = baseSize * TARGET_HEIGHT_RATIO * imageScale;
  const containerWidth = containerHeight / aspect;

  return {
    width: Math.round(containerWidth),
    height: Math.round(containerHeight),
  };
}
