// ============================================================
// MATTERPORT EMBED SDK CONNECTION
// Handles SDK init, camera pose tracking, pointer intersection,
// and 3D→2D coordinate conversion (worldToScreen).
// ============================================================

let mpSdk = null;
let currentPose = null;
let currentIntersection = null;
let poseSub = null;
let intersectionSub = null;
let poseCallbacks = [];

/**
 * Connect to the Matterport Embed SDK.
 * setupSdk creates a fresh iframe inside the viewport container.
 * @param {string} sdkKey - Matterport SDK key
 * @param {string} modelSid - Model space ID
 * @returns {Promise<boolean>} true if connected
 */
export async function initSdk(sdkKey, modelSid) {
  dispose(); // Clean up any previous connection

  const { setupSdk } = await import('@matterport/sdk');

  const container = document.getElementById('viewport');

  mpSdk = await setupSdk(sdkKey, {
    space: modelSid,
    container: container,
    iframeAttributes: {
      id: 'mpIframe',
      style: 'width:100%;height:100%;border:none;display:block;position:absolute;top:0;left:0;z-index:1;',
      allow: 'fullscreen; xr-spatial-tracking',
    },
    iframeQueryParams: {
      play: 1,
      qs: 1,
      help: 0,
      brand: 0,
      gt: 0,
      hr: 0,
      mls: 2,
      mt: 0,
      pin: 0,
      portal: 0,
      lang: 'en',
    },
  });

  // Subscribe to camera pose updates
  poseSub = mpSdk.Camera.pose.subscribe((pose) => {
    currentPose = pose;
    for (const cb of poseCallbacks) {
      cb(pose);
    }
  });

  // Subscribe to pointer intersection (tracks mouse over 3D model)
  intersectionSub = mpSdk.Pointer.intersection.subscribe((intersection) => {
    currentIntersection = intersection;
  });

  return true;
}

/**
 * Register a callback for camera pose changes.
 * Returns an unsubscribe function.
 */
export function subscribeToPose(callback) {
  poseCallbacks.push(callback);
  return () => {
    poseCallbacks = poseCallbacks.filter((cb) => cb !== callback);
  };
}

/**
 * Get the last known pointer intersection with the 3D model.
 * Returns { position: {x,y,z}, normal: {x,y,z}, floorIndex, object } or null.
 */
export function getCurrentIntersection() {
  return currentIntersection;
}

/**
 * Get the current camera pose.
 */
export function getCurrentPose() {
  return currentPose;
}

/**
 * Project a 3D world position to 2D screen pixels.
 * @param {{ x: number, y: number, z: number }} worldPos
 * @param {{ w: number, h: number }} iframeSize - iframe client dimensions
 * @returns {{ x: number, y: number, z: number } | null} screen coords (z = depth), or null if unavailable
 */
export function worldToScreen(worldPos, iframeSize) {
  if (!mpSdk || !currentPose) return null;
  return mpSdk.Conversion.worldToScreen(worldPos, currentPose, iframeSize);
}

/**
 * Convert a 2D screen pixel position to a 3D world position on the floor plane.
 * Uses the current camera view to project basis vectors and invert the mapping.
 *
 * @param {number} screenX - pixel X position on iframe
 * @param {number} screenY - pixel Y position on iframe
 * @param {{ x: number, y: number, z: number }} refPoint - a known 3D point on the floor
 * @param {{ w: number, h: number }} iframeSize
 * @returns {{ x: number, y: number, z: number } | null}
 */
export function screenToFloor(screenX, screenY, refPoint, iframeSize) {
  if (!mpSdk || !currentPose) return null;

  const w2s = (pos) => mpSdk.Conversion.worldToScreen(pos, currentPose, iframeSize);

  // Project reference point and two offset points to screen
  const refScreen = w2s(refPoint);
  const refPlusX = w2s({ x: refPoint.x + 1, y: refPoint.y, z: refPoint.z });
  const refPlusZ = w2s({ x: refPoint.x, y: refPoint.y, z: refPoint.z + 1 });

  if (!refScreen || !refPlusX || !refPlusZ) return null;

  // Screen-space basis vectors (how 1 meter in world X/Z maps to pixels)
  const bxX = refPlusX.x - refScreen.x;
  const bxY = refPlusX.y - refScreen.y;
  const bzX = refPlusZ.x - refScreen.x;
  const bzY = refPlusZ.y - refScreen.y;

  // Invert the 2x2 matrix [bxX bzX; bxY bzY] to go screen → world
  const det = bxX * bzY - bzX * bxY;
  if (Math.abs(det) < 0.001) return null; // degenerate — camera looking straight down at edge

  const dsx = screenX - refScreen.x;
  const dsy = screenY - refScreen.y;

  const worldDX = (bzY * dsx - bzX * dsy) / det;
  const worldDZ = (-bxY * dsx + bxX * dsy) / det;

  return {
    x: refPoint.x + worldDX,
    y: refPoint.y,
    z: refPoint.z + worldDZ,
  };
}

/**
 * Check if SDK is connected and ready.
 */
export function isSdkReady() {
  return mpSdk !== null;
}

/**
 * Get the raw SDK instance (for advanced usage).
 */
export function getSdk() {
  return mpSdk;
}

/**
 * Clean up all subscriptions and reset state.
 */
export function dispose() {
  if (poseSub) { poseSub.cancel(); poseSub = null; }
  if (intersectionSub) { intersectionSub.cancel(); intersectionSub = null; }
  mpSdk = null;
  currentPose = null;
  currentIntersection = null;
  poseCallbacks = [];
}
