// csTimer's standard 3×3 QWERTY controls, grouped by move.
export const cubeKeyRows = [
  ["R / R′", "I", "K"], ["L / L′", "D", "E"],
  ["U / U′", "J", "F"], ["D / D′", "S", "L"],
  ["F / F′", "H", "G"], ["B / B′", "W", "O"],
  ["Rw / Rw′", "U", "M"], ["Lw / Lw′", "V", "R"],
  ["Uw / Uw′", ",", "C"], ["Dw / Dw′", "Z", "/"],
  ["M / M′", "5、6", ".、X"], ["E / E′", "2", "9"], ["S / S′", "0", "1"],
  ["x / x′", "T、Y", "B、N"], ["y / y′", ";", "A"], ["z / z′", "P", "Q"],
] as const;

const keyCodes: Record<string, string> = {
  ",": "Comma", ".": "Period", ";": "Semicolon", "/": "Slash",
};
const cubeKeys = new Map<string, string>();
for (const [label, forward, backward] of cubeKeyRows) {
  const move = label.split(" ")[0];
  for (const [keys, suffix] of [[forward, ""], [backward, "'"]] as const) {
    for (const key of keys.split("、")) {
      const code = keyCodes[key] ?? (/^\d$/.test(key) ? `Digit${key}` : `Key${key}`);
      cubeKeys.set(code, move + suffix);
    }
  }
}

export function keyboardCubeMove(code: string, leftWide: boolean, rightWide: boolean) {
  if (leftWide && code === "KeyX") return "R";
  if (leftWide && code === "Digit5") return "R'";
  if (rightWide && code === "Period") return "L'";
  if (rightWide && code === "Digit6") return "L";
  const move = cubeKeys.get(code);
  if (!move) return;
  const face = move[0];
  const wide = (face === "L" && leftWide) || (face === "R" && rightWide);
  if (!wide) return move;
  const inverse = move.endsWith("'");
  if (move[1] !== "w") return face + "w" + (inverse ? "'" : "");
  return "x" + (inverse === (face === "R") ? "'" : "");
}

type Point = { x: number; y: number };
type Vector = [number, number, number];
type Ray = { origin: Vector; direction: Vector };
export type CubeCamera = {
  matrixWorld: { elements: readonly number[] };
  projectionMatrix: { elements: readonly number[] };
};
export type CubeHit = { axis: number; normal: number; position: Vector };

// Cubing.js renders its 3×3 in world coordinates from −0.5 to +0.5.
const halfCube = 0.5;
const axes = [0, 1, 2] as const;

function cameraRay(camera: CubeCamera, bounds: DOMRect, point: Point): Ray {
  const world = camera.matrixWorld.elements;
  const projection = camera.projectionMatrix.elements;
  const x = (2 * (point.x - bounds.left) / bounds.width - 1) / projection[0];
  const y = (1 - 2 * (point.y - bounds.top) / bounds.height) / projection[5];
  return {
    origin: [world[12], world[13], world[14]],
    direction: axes.map((axis) => world[axis] * x + world[axis + 4] * y - world[axis + 8]) as Vector,
  };
}

function onPlane(ray: Ray, axis: number, normal: number) {
  return (normal * halfCube - ray.origin[axis]) / ray.direction[axis];
}

function pointOnRay(ray: Ray, distance: number): Vector {
  return axes.map((axis) => ray.origin[axis] + distance * ray.direction[axis]) as Vector;
}

export function pickCubeFace(camera: CubeCamera, bounds: DOMRect, point: Point): CubeHit | undefined {
  const ray = cameraRay(camera, bounds, point);
  let nearest = Infinity;
  let hit: CubeHit | undefined;
  for (const axis of axes) {
    const normal = Math.sign(ray.origin[axis]);
    const distance = onPlane(ray, axis, normal);
    if (Math.abs(ray.origin[axis]) <= halfCube || distance <= 0 || distance >= nearest) continue;
    const position = pointOnRay(ray, distance);
    if (position.some((value, i) => i !== axis && Math.abs(value) > halfCube)) continue;
    nearest = distance;
    hit = { axis, normal, position };
  }
  return hit;
}

const layerMoves = [["L", "M", "R"], ["D", "E", "U"], ["B", "S", "F"]] as const;

const moveAxes: Record<string, [axis: number, side: number]> = {
  L: [0, -1], R: [0, 1], D: [1, -1], U: [1, 1], B: [2, -1], F: [2, 1],
  M: [0, -1], E: [1, -1], S: [2, 1], x: [0, 1], y: [1, 1], z: [2, 1],
};

// Match the camera to the nearest right-handed cube orientation, so a
// diagonal view still has one consistent right, up and front.
export function viewedCubeMove(move: string, latitude: number, longitude: number) {
  const pitch = latitude * Math.PI / 180;
  const yaw = longitude * Math.PI / 180;
  const up: Vector = [-Math.sin(pitch) * Math.sin(yaw), Math.cos(pitch), -Math.sin(pitch) * Math.cos(yaw)];
  const front: Vector = [Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)];
  let best = -Infinity;
  let orientation = [1, 2, 3];
  for (const upAxis of axes) {
    for (const frontAxis of axes) {
      if (upAxis === frontAxis) continue;
      const rightAxis = 3 - upAxis - frontAxis;
      const upSign = up[upAxis] < 0 ? -1 : 1;
      const frontSign = front[frontAxis] < 0 ? -1 : 1;
      const rightSign = upSign * frontSign * ((upAxis + 1) % 3 === frontAxis ? 1 : -1);
      const right = [Math.cos(yaw), 0, -Math.sin(yaw)][rightAxis];
      const score = upSign * up[upAxis] + frontSign * front[frontAxis] + rightSign * right;
      if (score > best) {
        best = score;
        orientation = [rightSign * (rightAxis + 1), upSign * (upAxis + 1), frontSign * (frontAxis + 1)];
      }
    }
  }

  const [relativeAxis, side] = moveAxes[move[0]];
  const mappedAxis = orientation[relativeAxis];
  const axis = Math.abs(mappedAxis) - 1;
  const mappedSide = Math.sign(mappedAxis) * side;
  const slice = "MES".includes(move[0]);
  const rotation = "xyz".includes(move[0]);
  const mapped = rotation ? "xyz"[axis] : layerMoves[axis][slice ? 1 : mappedSide > 0 ? 2 : 0];
  const reversed = (slice || rotation) && mappedSide !== moveAxes[mapped][1];
  const suffix = move.endsWith("'") !== reversed ? "'" : "";
  return mapped + (move.includes("w") ? "w" : "") + suffix;
}

export function swipeCubeMove(
  camera: CubeCamera, bounds: DOMRect, hit: CubeHit, start: Point, end: Point,
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 14) return;
  // Sample close to the starting sticker to keep the direction local to its face.
  const scale = Math.min(1, 24 / length);
  const ray = cameraRay(camera, bounds, { x: start.x + dx * scale, y: start.y + dy * scale });
  const distance = onPlane(ray, hit.axis, hit.normal);
  if (!Number.isFinite(distance) || distance <= 0) return;
  const position = pointOnRay(ray, distance);
  const first = (hit.axis + 1) % 3;
  const second = (hit.axis + 2) % 3;
  const a = position[first] - hit.position[first];
  const b = position[second] - hit.position[second];
  const alongFirst = Math.abs(a) >= Math.abs(b);
  const axis = alongFirst ? second : first;
  const direction = hit.normal * (alongFirst ? a : -b);
  if (direction === 0) return;
  const coordinate = hit.position[axis];
  const layer = coordinate > halfCube / 3 ? 2 : coordinate < -halfCube / 3 ? 0 : 1;
  const clockwiseDirection = layer === 2 || (axis === 2 && layer === 1) ? -1 : 1;
  return layerMoves[axis][layer] + (Math.sign(direction) === clockwiseDirection ? "" : "'");
}
