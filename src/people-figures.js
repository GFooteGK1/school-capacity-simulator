// ============================================================
// LIFELIKE HUMAN FIGURE SVGs
// Standing, sitting, walking poses with natural variation
// ============================================================

const FIGURE_COLORS = {
  Teacher:   { body: '#2D5A7B', accent: '#4A90B8' },
  Student:   { body: '#4A6741', accent: '#6B9B5E' },
  Admin:     { body: '#5B4A7B', accent: '#8B7AAF' },
  Visitor:   { body: '#7B5A3A', accent: '#A88B6A' },
  Staff:     { body: '#3A6B6B', accent: '#5A9E9E' },
  Parent:    { body: '#6B4A5A', accent: '#9E7A8B' },
  Custodian: { body: '#5A5A3A', accent: '#8B8B6A' },
  Other:     { body: '#4A4A5B', accent: '#7A7A8B' },
};

// Standing poses — multiple variations
const STANDING_POSES = [
  // Relaxed stand
  (c) => `
    <circle cx="20" cy="8" r="5.5" fill="${c.body}"/>
    <path d="M20 13.5 L20 28" stroke="${c.body}" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M20 28 L14 42" stroke="${c.body}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M20 28 L26 42" stroke="${c.body}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M20 17 L12 24" stroke="${c.body}" stroke-width="3" stroke-linecap="round"/>
    <path d="M20 17 L28 22" stroke="${c.body}" stroke-width="3" stroke-linecap="round"/>
  `,
  // Arms at sides
  (c) => `
    <circle cx="20" cy="8" r="5.5" fill="${c.body}"/>
    <path d="M20 13.5 L20 28" stroke="${c.body}" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M20 28 L15 42" stroke="${c.body}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M20 28 L25 42" stroke="${c.body}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M20 16 L14 28" stroke="${c.body}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M20 16 L26 28" stroke="${c.body}" stroke-width="2.5" stroke-linecap="round"/>
  `,
  // Hands on hips
  (c) => `
    <circle cx="20" cy="8" r="5.5" fill="${c.body}"/>
    <path d="M20 13.5 L20 28" stroke="${c.body}" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M20 28 L14 42" stroke="${c.body}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M20 28 L26 42" stroke="${c.body}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M20 17 L13 21 L15 26" stroke="${c.body}" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <path d="M20 17 L27 21 L25 26" stroke="${c.body}" stroke-width="2.5" stroke-linecap="round" fill="none"/>
  `,
];

// Walking poses
const WALKING_POSES = [
  // Mid-stride
  (c) => `
    <circle cx="20" cy="8" r="5.5" fill="${c.body}"/>
    <path d="M20 13.5 L20 27" stroke="${c.body}" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M20 27 L12 41" stroke="${c.body}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M20 27 L28 41" stroke="${c.body}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M20 17 L13 22" stroke="${c.body}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M20 17 L27 24" stroke="${c.body}" stroke-width="2.5" stroke-linecap="round"/>
  `,
  // Walking forward
  (c) => `
    <circle cx="20" cy="8" r="5.5" fill="${c.body}"/>
    <path d="M20 13.5 L21 27" stroke="${c.body}" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M21 27 L14 42" stroke="${c.body}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M21 27 L27 40" stroke="${c.body}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M20 17 L14 14" stroke="${c.body}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M20 17 L26 22" stroke="${c.body}" stroke-width="2.5" stroke-linecap="round"/>
  `,
];

// Sitting poses
const SITTING_POSES = [
  // Sitting in chair
  (c) => `
    <circle cx="20" cy="8" r="5.5" fill="${c.body}"/>
    <path d="M20 13.5 L20 24" stroke="${c.body}" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M20 24 L12 24 L12 34" stroke="${c.body}" stroke-width="3.5" stroke-linecap="round" fill="none"/>
    <path d="M20 24 L28 24 L28 34" stroke="${c.body}" stroke-width="3.5" stroke-linecap="round" fill="none"/>
    <path d="M20 17 L14 22" stroke="${c.body}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M20 17 L26 22" stroke="${c.body}" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="8" y="22" width="24" height="2" rx="1" fill="${c.accent}" opacity="0.4"/>
  `,
];

// Group of standing people (for bulk fill look)
const GROUP_CLUSTER_POSES = [
  // Person slightly turned
  (c) => `
    <circle cx="20" cy="8" r="5.5" fill="${c.body}"/>
    <path d="M20 13.5 L19 28" stroke="${c.body}" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M19 28 L13 42" stroke="${c.body}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M19 28 L24 42" stroke="${c.body}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M20 17 L12 20" stroke="${c.body}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M20 17 L27 20" stroke="${c.body}" stroke-width="2.5" stroke-linecap="round"/>
  `,
];

// Combine all poses for random selection
const ALL_POSES = [
  ...STANDING_POSES,
  ...STANDING_POSES, // weighted more heavily
  ...WALKING_POSES,
  ...SITTING_POSES,
  ...GROUP_CLUSTER_POSES,
];

/**
 * Generate an SVG string for a human figure
 * @param {string} role - Person role (Teacher, Student, etc.)
 * @param {object} options - { pose: 'random'|'standing'|'walking'|'sitting', flip: bool }
 * @returns {string} SVG markup
 */
export function generateFigureSVG(role = 'Other', options = {}) {
  const colors = FIGURE_COLORS[role] || FIGURE_COLORS.Other;
  const flip = options.flip || Math.random() > 0.5;

  let poses;
  switch (options.pose) {
    case 'standing': poses = STANDING_POSES; break;
    case 'walking': poses = WALKING_POSES; break;
    case 'sitting': poses = SITTING_POSES; break;
    default: poses = ALL_POSES;
  }

  const poseFn = poses[Math.floor(Math.random() * poses.length)];
  const bodyMarkup = poseFn(colors);

  return `<svg viewBox="0 0 40 46" xmlns="http://www.w3.org/2000/svg" style="transform: scaleX(${flip ? -1 : 1}); filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3));">
    ${bodyMarkup}
  </svg>`;
}

/**
 * Generate a simple icon representation
 */
export function generateIconSVG(role = 'Other') {
  const colors = FIGURE_COLORS[role] || FIGURE_COLORS.Other;
  return `<svg viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    <circle cx="14" cy="14" r="13" fill="${colors.body}" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
    <circle cx="14" cy="10" r="4" fill="rgba(255,255,255,0.8)"/>
    <path d="M6 24c0-4.418 3.582-8 8-8s8 3.582 8 8" fill="rgba(255,255,255,0.6)"/>
  </svg>`;
}

/**
 * Generate a dot representation
 */
export function generateDotSVG(role = 'Other') {
  const colors = FIGURE_COLORS[role] || FIGURE_COLORS.Other;
  return `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="7" fill="${colors.body}" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
  </svg>`;
}

export { FIGURE_COLORS };
