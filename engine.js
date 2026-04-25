const EPSILON = 1e-6;
const MAX_WARNING_COUNT = 24;
const EXPENSIVE_MODES = new Set(["heatmap", "solid", "depth", "contour", "hiddenline"]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function degreesToRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function edgeFunction(ax, ay, bx, by, px, py) {
  return (px - ax) * (by - ay) - (py - ay) * (bx - ax);
}

function parseFiniteNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  add(other) {
    return new Vector3(this.x + other.x, this.y + other.y, this.z + other.z);
  }

  subtract(other) {
    return new Vector3(this.x - other.x, this.y - other.y, this.z - other.z);
  }

  scale(scalar) {
    return new Vector3(this.x * scalar, this.y * scalar, this.z * scalar);
  }

  dot(other) {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  cross(other) {
    return new Vector3(
      this.y * other.z - this.z * other.y,
      this.z * other.x - this.x * other.z,
      this.x * other.y - this.y * other.x,
    );
  }

  length() {
    return Math.hypot(this.x, this.y, this.z);
  }

  normalize() {
    const magnitude = this.length();
    if (magnitude < EPSILON) {
      return new Vector3(0, 0, 0);
    }
    return this.scale(1 / magnitude);
  }

  clone() {
    return new Vector3(this.x, this.y, this.z);
  }

  toVector4(w = 1) {
    return new Vector4(this.x, this.y, this.z, w);
  }

  static fromArray(array, offset = 0) {
    return new Vector3(array[offset], array[offset + 1], array[offset + 2]);
  }

  static lerp(a, b, t) {
    return new Vector3(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));
  }
}

export class Vector4 {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }

  toVector3() {
    if (Math.abs(this.w) < EPSILON) {
      return new Vector3(this.x, this.y, this.z);
    }

    return new Vector3(this.x / this.w, this.y / this.w, this.z / this.w);
  }
}

export class Matrix4 {
  constructor(elements = null) {
    this.elements = elements ? Float32Array.from(elements) : Matrix4.identity().elements;
  }

  clone() {
    return new Matrix4(this.elements);
  }

  multiply(other) {
    const a = this.elements;
    const b = other.elements;
    const out = new Float32Array(16);

    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 4; column += 1) {
        let sum = 0;

        for (let index = 0; index < 4; index += 1) {
          sum += a[row * 4 + index] * b[index * 4 + column];
        }

        out[row * 4 + column] = sum;
      }
    }

    return new Matrix4(out);
  }

  /**
   * Matrix x Vector follows the exact row-dot-column formula.
   * Every transformed coordinate is the weighted sum of one matrix row with the input vector.
   */
  transformVector4(vector) {
    const m = this.elements;

    return new Vector4(
      m[0] * vector.x + m[1] * vector.y + m[2] * vector.z + m[3] * vector.w,
      m[4] * vector.x + m[5] * vector.y + m[6] * vector.z + m[7] * vector.w,
      m[8] * vector.x + m[9] * vector.y + m[10] * vector.z + m[11] * vector.w,
      m[12] * vector.x + m[13] * vector.y + m[14] * vector.z + m[15] * vector.w,
    );
  }

  transpose() {
    const m = this.elements;
    return new Matrix4([
      m[0], m[4], m[8], m[12],
      m[1], m[5], m[9], m[13],
      m[2], m[6], m[10], m[14],
      m[3], m[7], m[11], m[15],
    ]);
  }

  /**
   * Gauss-Jordan elimination mirrors the classroom method:
   * augment the matrix with identity, row-reduce the left side into identity,
   * and the right side becomes the inverse.
   */
  inverse() {
    const m = this.elements;
    const augmented = Array.from({ length: 4 }, (_, row) => {
      const left = Array.from({ length: 4 }, (_, column) => m[row * 4 + column]);
      const right = Array.from({ length: 4 }, (_, column) => (row === column ? 1 : 0));
      return [...left, ...right];
    });

    for (let pivotIndex = 0; pivotIndex < 4; pivotIndex += 1) {
      let pivotRow = pivotIndex;

      for (let row = pivotIndex + 1; row < 4; row += 1) {
        if (Math.abs(augmented[row][pivotIndex]) > Math.abs(augmented[pivotRow][pivotIndex])) {
          pivotRow = row;
        }
      }

      if (Math.abs(augmented[pivotRow][pivotIndex]) < EPSILON) {
        return Matrix4.identity();
      }

      if (pivotRow !== pivotIndex) {
        [augmented[pivotIndex], augmented[pivotRow]] = [augmented[pivotRow], augmented[pivotIndex]];
      }

      const pivotValue = augmented[pivotIndex][pivotIndex];
      for (let column = 0; column < 8; column += 1) {
        augmented[pivotIndex][column] /= pivotValue;
      }

      for (let row = 0; row < 4; row += 1) {
        if (row === pivotIndex) {
          continue;
        }

        const factor = augmented[row][pivotIndex];
        for (let column = 0; column < 8; column += 1) {
          augmented[row][column] -= factor * augmented[pivotIndex][column];
        }
      }
    }

    const result = new Float32Array(16);
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 4; column += 1) {
        result[row * 4 + column] = augmented[row][column + 4];
      }
    }

    return new Matrix4(result);
  }

  static identity() {
    return new Matrix4([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  }

  static translation(x, y, z) {
    return new Matrix4([
      1, 0, 0, x,
      0, 1, 0, y,
      0, 0, 1, z,
      0, 0, 0, 1,
    ]);
  }

  static scaling(x, y, z) {
    return new Matrix4([
      x, 0, 0, 0,
      0, y, 0, 0,
      0, 0, z, 0,
      0, 0, 0, 1,
    ]);
  }

  static rotationX(radians) {
    const c = Math.cos(radians);
    const s = Math.sin(radians);

    return new Matrix4([
      1, 0, 0, 0,
      0, c, -s, 0,
      0, s, c, 0,
      0, 0, 0, 1,
    ]);
  }

  static rotationY(radians) {
    const c = Math.cos(radians);
    const s = Math.sin(radians);

    return new Matrix4([
      c, 0, s, 0,
      0, 1, 0, 0,
      -s, 0, c, 0,
      0, 0, 0, 1,
    ]);
  }

  static rotationZ(radians) {
    const c = Math.cos(radians);
    const s = Math.sin(radians);

    return new Matrix4([
      c, -s, 0, 0,
      s, c, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  }

  static orthographic(left, right, bottom, top, near, far) {
    return new Matrix4([
      2 / (right - left), 0, 0, -(right + left) / (right - left),
      0, 2 / (top - bottom), 0, -(top + bottom) / (top - bottom),
      0, 0, -2 / (far - near), -(far + near) / (far - near),
      0, 0, 0, 1,
    ]);
  }

  static multiplyMany(...matrices) {
    return matrices.reduce((accumulator, matrix) => accumulator.multiply(matrix), Matrix4.identity());
  }
}

export class OBJParser {
  constructor() {
    this.warnings = [];
  }

  warn(message) {
    if (this.warnings.length < MAX_WARNING_COUNT) {
      this.warnings.push(message);
    }
  }

  resolveIndex(rawIndex, vertexCount) {
    if (!Number.isInteger(rawIndex) || rawIndex === 0) {
      return null;
    }

    const resolved = rawIndex > 0 ? rawIndex - 1 : vertexCount + rawIndex;
    return resolved >= 0 && resolved < vertexCount ? resolved : null;
  }

  parseFaceToken(token, vertexCount) {
    const [vertexToken] = token.split("/");
    const parsedIndex = Number.parseInt(vertexToken, 10);
    return this.resolveIndex(parsedIndex, vertexCount);
  }

  parse(text) {
    const vertices = [];
    const faces = [];
    let polygonFaceCount = 0;
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);

    lines.forEach((line, lineIndex) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }

      const parts = trimmed.split(/\s+/);
      const keyword = parts[0];

      if (keyword === "v") {
        const x = parseFiniteNumber(parts[1]);
        const y = parseFiniteNumber(parts[2]);
        const z = parseFiniteNumber(parts[3]);

        if (x === null || y === null || z === null) {
          this.warn(`Line ${lineIndex + 1}: malformed vertex skipped.`);
          return;
        }

        vertices.push(new Vector3(x, y, z));
        return;
      }

      if (keyword !== "f") {
        return;
      }

      if (parts.length < 4) {
        this.warn(`Line ${lineIndex + 1}: malformed face skipped.`);
        return;
      }

      const polygon = [];

      for (let index = 1; index < parts.length; index += 1) {
        const resolvedIndex = this.parseFaceToken(parts[index], vertices.length);

        if (resolvedIndex === null) {
          this.warn(`Line ${lineIndex + 1}: invalid face index "${parts[index]}" skipped.`);
          return;
        }

        polygon.push(resolvedIndex);
      }

      if (new Set(polygon).size < 3) {
        this.warn(`Line ${lineIndex + 1}: degenerate polygon skipped.`);
        return;
      }

      polygonFaceCount += 1;

      for (let triangleIndex = 1; triangleIndex < polygon.length - 1; triangleIndex += 1) {
        faces.push([polygon[0], polygon[triangleIndex], polygon[triangleIndex + 1]]);
      }
    });

    return {
      vertices,
      faces,
      polygonFaceCount,
      triangulatedFaceCount: faces.length,
      warnings: [...this.warnings],
    };
  }
}

export class Camera {
  constructor() {
    this.position = new Vector3(2.9, 2.3, 3.2);
    this.target = new Vector3(0, 0, 0);
    this.up = new Vector3(0, 1, 0);
    this.zoom = 1.25;
    this.panX = 0;
    this.panY = 0;
    this.orthoHeight = 3.2;
    this.near = 0.1;
    this.far = 20;
    this.customBounds = null;
  }

  setOrthographicBounds(left, right, bottom, top, near, far) {
    this.customBounds = { left, right, bottom, top, near, far };
  }

  clearCustomBounds() {
    this.customBounds = null;
  }

  setPreset(name) {
    switch (name) {
      case "top":
        this.position = new Vector3(0, 4.8, 0.0001);
        this.target = new Vector3(0, 0, 0);
        this.up = new Vector3(0, 0, -1);
        break;
      case "front":
        this.position = new Vector3(0, 0, 4.8);
        this.target = new Vector3(0, 0, 0);
        this.up = new Vector3(0, 1, 0);
        break;
      case "side":
        this.position = new Vector3(4.8, 0, 0);
        this.target = new Vector3(0, 0, 0);
        this.up = new Vector3(0, 1, 0);
        break;
      case "iso":
      default:
        this.position = new Vector3(2.9, 2.3, 3.2);
        this.target = new Vector3(0, 0, 0);
        this.up = new Vector3(0, 1, 0);
        break;
    }
  }

  fitToBounds(bounds) {
    const maxDimension = Math.max(bounds.size.x, bounds.size.y, bounds.size.z, 1);
    this.orthoHeight = maxDimension * 2;
    this.zoom = 1.25;
    this.panX = 0;
    this.panY = 0;
    this.near = 0.1;
    this.far = maxDimension * 12;
  }

  getForwardVector() {
    return this.target.subtract(this.position).normalize();
  }

  getViewMatrix() {
    const forward = this.target.subtract(this.position).normalize();
    const right = forward.cross(this.up).normalize();
    const trueUp = right.cross(forward).normalize();

    return new Matrix4([
      right.x, right.y, right.z, -right.dot(this.position),
      trueUp.x, trueUp.y, trueUp.z, -trueUp.dot(this.position),
      -forward.x, -forward.y, -forward.z, forward.dot(this.position),
      0, 0, 0, 1,
    ]);
  }

  getProjectionMatrix(aspectRatio) {
    if (this.customBounds) {
      const { left, right, bottom, top, near, far } = this.customBounds;
      return Matrix4.orthographic(left, right, bottom, top, near, far);
    }

    const halfHeight = this.orthoHeight / (2 * this.zoom);
    const halfWidth = halfHeight * aspectRatio;
    const left = -halfWidth + this.panX;
    const right = halfWidth + this.panX;
    const bottom = -halfHeight + this.panY;
    const top = halfHeight + this.panY;
    return Matrix4.orthographic(left, right, bottom, top, this.near, this.far);
  }

  saveState() {
    return {
      position: { x: this.position.x, y: this.position.y, z: this.position.z },
      target: { x: this.target.x, y: this.target.y, z: this.target.z },
      up: { x: this.up.x, y: this.up.y, z: this.up.z },
      zoom: this.zoom,
      panX: this.panX,
      panY: this.panY,
      orthoHeight: this.orthoHeight,
      near: this.near,
      far: this.far,
    };
  }

  restoreState(state) {
    this.position = new Vector3(state.position.x, state.position.y, state.position.z);
    this.target = new Vector3(state.target.x, state.target.y, state.target.z);
    this.up = new Vector3(state.up.x, state.up.y, state.up.z);
    this.zoom = state.zoom;
    this.panX = state.panX;
    this.panY = state.panY;
    this.orthoHeight = state.orthoHeight;
    this.near = state.near;
    this.far = state.far;
  }
}

export class DepthBuffer {
  constructor(width = 0, height = 0) {
    this.width = 0;
    this.height = 0;
    this.values = new Float32Array(0);
    if (width > 0 && height > 0) {
      this.resize(width, height);
    }
  }

  resize(width, height) {
    if (width === this.width && height === this.height) {
      return;
    }
    this.width = width;
    this.height = height;
    this.values = new Float32Array(width * height);
    this.clear();
  }

  clear(fillValue = Number.POSITIVE_INFINITY) {
    this.values.fill(fillValue);
  }

  getIndex(x, y) {
    return y * this.width + x;
  }

  get(x, y) {
    return this.values[this.getIndex(x, y)];
  }

  testAndSet(x, y, depth) {
    const index = this.getIndex(x, y);
    if (depth < this.values[index]) {
      this.values[index] = depth;
      return true;
    }
    return false;
  }
}

export class HeatmapShader {
  constructor() {
    this.minZ = 0;
    this.maxZ = 1;
    this.stops = [
      { t: 0, color: [38, 87, 216] },
      { t: 0.45, color: [255, 97, 88] },
      { t: 0.74, color: [255, 230, 109] },
      { t: 1, color: [255, 255, 255] },
    ];
  }

  setRange(minZ, maxZ) {
    this.minZ = minZ;
    this.maxZ = maxZ === minZ ? minZ + 1 : maxZ;
  }

  normalize(z) {
    return clamp((z - this.minZ) / (this.maxZ - this.minZ), 0, 1);
  }

  srgbToLinear(channel) {
    const normalized = channel / 255;
    if (normalized <= 0.04045) {
      return normalized / 12.92;
    }
    return ((normalized + 0.055) / 1.055) ** 2.4;
  }

  linearToSrgb(channel) {
    const clampedChannel = clamp(channel, 0, 1);
    if (clampedChannel <= 0.0031308) {
      return clampedChannel * 12.92 * 255;
    }
    return (1.055 * (clampedChannel ** (1 / 2.4)) - 0.055) * 255;
  }

  sample(z) {
    const t = this.normalize(z);

    for (let index = 0; index < this.stops.length - 1; index += 1) {
      const current = this.stops[index];
      const next = this.stops[index + 1];

      if (t >= current.t && t <= next.t) {
        const localT = (t - current.t) / (next.t - current.t);
        const linearCurrent = current.color.map((channel) => this.srgbToLinear(channel));
        const linearNext = next.color.map((channel) => this.srgbToLinear(channel));
        const interpolated = linearCurrent.map((channel, channelIndex) =>
          this.linearToSrgb(lerp(channel, linearNext[channelIndex], localT)),
        );

        return {
          r: Math.round(interpolated[0]),
          g: Math.round(interpolated[1]),
          b: Math.round(interpolated[2]),
          a: 255,
        };
      }
    }

    return { r: 255, g: 255, b: 255, a: 255 };
  }

  sampleFromDepth(depth) {
    const shade = Math.round(lerp(230, 42, clamp(depth, 0, 1)));
    return { r: shade, g: shade, b: shade, a: 255 };
  }
}

export class Scene {
  constructor() {
    this.settings = {
      renderMode: "heatmap",
      runtimeRenderMode: "heatmap",
      showGrid: true,
      showAxes: true,
      showBoundingBox: false,
      showNormals: false,
      backfaceCulling: true,
      adaptive: true,
      heatmapInterpolation: true,
      includeUIInExport: false,
      pointSize: 2,
      opacity: 1,
      contourDensity: 12,
      theme: "light",
    };

    this.transform = {
      rotationX: degreesToRadians(-23),
      rotationY: degreesToRadians(-35),
      rotationZ: degreesToRadians(12),
      scale: 1,
      zScale: 1,
    };

    this.snapshots = [];
    this.dirty = true;
    this.clear();
  }

  static createEmptyBounds() {
    return {
      min: new Vector3(0, 0, 0),
      max: new Vector3(0, 0, 0),
      size: new Vector3(0, 0, 0),
      center: new Vector3(0, 0, 0),
    };
  }

  static computeBoundsFromPositions(positions) {
    if (!positions.length) {
      return Scene.createEmptyBounds();
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < positions.length; index += 3) {
      const x = positions[index];
      const y = positions[index + 1];
      const z = positions[index + 2];
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }

    const min = new Vector3(minX, minY, minZ);
    const max = new Vector3(maxX, maxY, maxZ);
    const size = max.subtract(min);
    const center = min.add(max).scale(0.5);
    return { min, max, size, center };
  }

  static createTypedPositionArray(vertices) {
    const positions = new Float32Array(vertices.length * 3);
    vertices.forEach((vertex, index) => {
      positions[index * 3] = vertex.x;
      positions[index * 3 + 1] = vertex.y;
      positions[index * 3 + 2] = vertex.z;
    });
    return positions;
  }

  clear() {
    this.modelName = "No model loaded";
    this.vertexCount = 0;
    this.faceCount = 0;
    this.triangleCount = 0;
    this.rawPositions = new Float32Array(0);
    this.normalizedPositions = new Float32Array(0);
    this.indices = new Uint32Array(0);
    this.vertexNormals = new Float32Array(0);
    this.edgeMap = [];
    this.meshWarnings = [];
    this.rawBounds = Scene.createEmptyBounds();
    this.normalizedBounds = Scene.createEmptyBounds();
    this.normalization = {
      center: new Vector3(0, 0, 0),
      scale: 1,
    };
    this.markDirty("clear");
  }

  markDirty() {
    this.dirty = true;
  }

  consumeDirtyFlag() {
    const wasDirty = this.dirty;
    this.dirty = false;
    return wasDirty;
  }

  beginInteraction() {
    if (this.settings.adaptive && EXPENSIVE_MODES.has(this.settings.renderMode)) {
      this.settings.runtimeRenderMode = "wireframe";
      this.markDirty("adaptive-preview");
    }
  }

  endInteraction() {
    this.settings.runtimeRenderMode = this.settings.renderMode;
    this.markDirty("adaptive-restore");
  }

  setRenderMode(mode) {
    this.settings.renderMode = mode;
    this.settings.runtimeRenderMode = mode;
    this.markDirty("render-mode");
  }

  loadOBJText(text, fileName = "model.obj") {
    const parser = new OBJParser();
    const parsed = parser.parse(text);
    return this.loadParsedMesh(parsed, fileName);
  }

  loadParsedMesh(parsed, fileName = "model.obj") {
    if (!parsed.vertices.length || !parsed.faces.length) {
      throw new Error("The OBJ file does not contain enough valid vertices and faces to render.");
    }

    const rawPositions = Scene.createTypedPositionArray(parsed.vertices);
    const rawBounds = Scene.computeBoundsFromPositions(rawPositions);
    const maxDimension = Math.max(rawBounds.size.x, rawBounds.size.y, rawBounds.size.z, 1);
    const normalizationScale = 2.2 / maxDimension;
    const normalizedPositions = new Float32Array(rawPositions.length);

    for (let index = 0; index < rawPositions.length; index += 3) {
      normalizedPositions[index] = (rawPositions[index] - rawBounds.center.x) * normalizationScale;
      normalizedPositions[index + 1] = (rawPositions[index + 1] - rawBounds.center.y) * normalizationScale;
      normalizedPositions[index + 2] = (rawPositions[index + 2] - rawBounds.center.z) * normalizationScale;
    }

    const cleanedFaces = [];
    const warnings = [...parsed.warnings];

    parsed.faces.forEach((face, faceIndex) => {
      const [a, b, c] = face;
      const ax = normalizedPositions[a * 3];
      const ay = normalizedPositions[a * 3 + 1];
      const az = normalizedPositions[a * 3 + 2];
      const bx = normalizedPositions[b * 3];
      const by = normalizedPositions[b * 3 + 1];
      const bz = normalizedPositions[b * 3 + 2];
      const cx = normalizedPositions[c * 3];
      const cy = normalizedPositions[c * 3 + 1];
      const cz = normalizedPositions[c * 3 + 2];

      const areaVector = new Vector3(bx - ax, by - ay, bz - az)
        .cross(new Vector3(cx - ax, cy - ay, cz - az));

      if (areaVector.length() < EPSILON) {
        if (warnings.length < MAX_WARNING_COUNT) {
          warnings.push(`Triangle ${faceIndex + 1}: degenerate face removed during validation.`);
        }
        return;
      }

      cleanedFaces.push(face);
    });

    if (!cleanedFaces.length) {
      throw new Error("All faces in the OBJ file were degenerate after validation.");
    }

    this.modelName = fileName;
    this.vertexCount = parsed.vertices.length;
    this.faceCount = parsed.polygonFaceCount;
    this.triangleCount = cleanedFaces.length;
    this.rawPositions = rawPositions;
    this.normalizedPositions = normalizedPositions;
    this.indices = new Uint32Array(cleanedFaces.length * 3);

    cleanedFaces.forEach((face, faceIndex) => {
      this.indices[faceIndex * 3] = face[0];
      this.indices[faceIndex * 3 + 1] = face[1];
      this.indices[faceIndex * 3 + 2] = face[2];
    });

    this.rawBounds = rawBounds;
    this.normalizedBounds = Scene.computeBoundsFromPositions(normalizedPositions);
    this.normalization = {
      center: rawBounds.center.clone(),
      scale: normalizationScale,
    };
    this.meshWarnings = warnings;
    this.vertexNormals = this.computeVertexNormals();
    this.edgeMap = this.buildEdgeMap();
    this.markDirty("mesh-load");

    return {
      name: this.modelName,
      vertexCount: this.vertexCount,
      faceCount: this.faceCount,
      triangleCount: this.triangleCount,
      bounds: this.rawBounds,
      warnings: this.meshWarnings,
    };
  }

  computeVertexNormals() {
    const normals = new Float32Array(this.vertexCount * 3);

    for (let faceIndex = 0; faceIndex < this.triangleCount; faceIndex += 1) {
      const a = this.indices[faceIndex * 3];
      const b = this.indices[faceIndex * 3 + 1];
      const c = this.indices[faceIndex * 3 + 2];

      const ax = this.normalizedPositions[a * 3];
      const ay = this.normalizedPositions[a * 3 + 1];
      const az = this.normalizedPositions[a * 3 + 2];
      const bx = this.normalizedPositions[b * 3];
      const by = this.normalizedPositions[b * 3 + 1];
      const bz = this.normalizedPositions[b * 3 + 2];
      const cx = this.normalizedPositions[c * 3];
      const cy = this.normalizedPositions[c * 3 + 1];
      const cz = this.normalizedPositions[c * 3 + 2];

      const normal = new Vector3(bx - ax, by - ay, bz - az)
        .cross(new Vector3(cx - ax, cy - ay, cz - az))
        .normalize();

      [a, b, c].forEach((vertexIndex) => {
        normals[vertexIndex * 3] += normal.x;
        normals[vertexIndex * 3 + 1] += normal.y;
        normals[vertexIndex * 3 + 2] += normal.z;
      });
    }

    for (let vertexIndex = 0; vertexIndex < this.vertexCount; vertexIndex += 1) {
      const offset = vertexIndex * 3;
      const normal = new Vector3(normals[offset], normals[offset + 1], normals[offset + 2]).normalize();
      normals[offset] = normal.x;
      normals[offset + 1] = normal.y;
      normals[offset + 2] = normal.z;
    }

    return normals;
  }

  buildEdgeMap() {
    const edgeMap = new Map();

    for (let faceIndex = 0; faceIndex < this.triangleCount; faceIndex += 1) {
      const a = this.indices[faceIndex * 3];
      const b = this.indices[faceIndex * 3 + 1];
      const c = this.indices[faceIndex * 3 + 2];
      const edges = [
        [a, b],
        [b, c],
        [c, a],
      ];

      edges.forEach(([start, end]) => {
        const minIndex = Math.min(start, end);
        const maxIndex = Math.max(start, end);
        const key = `${minIndex}:${maxIndex}`;

        if (!edgeMap.has(key)) {
          edgeMap.set(key, { a: minIndex, b: maxIndex, faces: [] });
        }

        edgeMap.get(key).faces.push(faceIndex);
      });
    }

    return [...edgeMap.values()];
  }

  getModelMatrix() {
    const scaleMatrix = Matrix4.scaling(
      this.transform.scale,
      this.transform.scale,
      this.transform.scale * this.transform.zScale,
    );
    const rotationX = Matrix4.rotationX(this.transform.rotationX);
    const rotationY = Matrix4.rotationY(this.transform.rotationY);
    const rotationZ = Matrix4.rotationZ(this.transform.rotationZ);
    return Matrix4.multiplyMany(rotationZ, rotationY, rotationX, scaleMatrix);
  }

  getBoundingBoxCorners() {
    const { min, max } = this.normalizedBounds;
    return [
      new Vector3(min.x, min.y, min.z),
      new Vector3(max.x, min.y, min.z),
      new Vector3(max.x, max.y, min.z),
      new Vector3(min.x, max.y, min.z),
      new Vector3(min.x, min.y, max.z),
      new Vector3(max.x, min.y, max.z),
      new Vector3(max.x, max.y, max.z),
      new Vector3(min.x, max.y, max.z),
    ];
  }

  getContourLevels() {
    const levels = [];
    const minZ = this.rawBounds.min.z;
    const maxZ = this.rawBounds.max.z;

    if (Math.abs(maxZ - minZ) < EPSILON) {
      levels.push(minZ);
      return levels;
    }

    const count = Math.max(2, this.settings.contourDensity);
    const step = (maxZ - minZ) / (count + 1);

    for (let index = 1; index <= count; index += 1) {
      levels.push(minZ + step * index);
    }

    return levels;
  }

  captureSnapshot(camera, label = "Saved View") {
    const snapshot = {
      id: `snapshot-${Date.now()}`,
      label,
      createdAt: Date.now(),
      transform: { ...this.transform },
      settings: {
        renderMode: this.settings.renderMode,
        runtimeRenderMode: this.settings.runtimeRenderMode,
        showGrid: this.settings.showGrid,
        showAxes: this.settings.showAxes,
        showBoundingBox: this.settings.showBoundingBox,
        showNormals: this.settings.showNormals,
        backfaceCulling: this.settings.backfaceCulling,
        adaptive: this.settings.adaptive,
        heatmapInterpolation: this.settings.heatmapInterpolation,
        includeUIInExport: this.settings.includeUIInExport,
        pointSize: this.settings.pointSize,
        opacity: this.settings.opacity,
        contourDensity: this.settings.contourDensity,
      },
      camera: camera.saveState(),
    };

    this.snapshots.unshift(snapshot);
    this.snapshots = this.snapshots.slice(0, 8);
    return snapshot;
  }

  applySnapshot(snapshot, camera) {
    Object.assign(this.transform, snapshot.transform);
    Object.assign(this.settings, snapshot.settings);
    camera.restoreState(snapshot.camera);
    this.markDirty("snapshot-restore");
  }
}

export class Renderer {
  constructor(canvas, scene, camera, heatmapShader) {
    this.canvas = canvas;
    this.scene = scene;
    this.camera = camera;
    this.heatmapShader = heatmapShader;
    this.context = canvas.getContext("2d", { alpha: true });
    this.pixelRatio = 1;
    this.displayWidth = 0;
    this.displayHeight = 0;
    this.pixelWidth = 0;
    this.pixelHeight = 0;
    this.depthBuffer = new DepthBuffer();
    this.frameImageData = null;
    this.projected = {
      worldPositions: new Float32Array(0),
      viewPositions: new Float32Array(0),
      screenPositions: new Float32Array(0),
      depths: new Float32Array(0),
      rawZValues: new Float32Array(0),
    };
    this.lastFrameFaces = [];
    this.lastFrameInfo = {
      visibleFaceCount: 0,
      canvasWidth: 0,
      canvasHeight: 0,
    };
  }

  getThemeColors() {
    if (this.scene.settings.theme === "dark") {
      return {
        grid: "rgba(255,255,255,0.08)",
        axisX: "rgba(255, 104, 104, 0.96)",
        axisY: "rgba(72, 214, 150, 0.96)",
        axisZ: "rgba(103, 169, 255, 0.96)",
        boundingBox: "rgba(255,255,255,0.18)",
        wire: "rgba(255,255,255,0.2)",
        silhouette: "rgba(255,255,255,0.68)",
        normal: "rgba(255, 199, 91, 0.88)",
        point: "rgba(255,255,255,0.95)",
        background: "#0c0f14",
      };
    }

    return {
      grid: "rgba(17,18,22,0.08)",
      axisX: "rgba(255, 86, 86, 0.96)",
      axisY: "rgba(33, 190, 120, 0.96)",
      axisZ: "rgba(48, 118, 245, 0.96)",
      boundingBox: "rgba(17,18,22,0.14)",
      wire: "rgba(17,18,22,0.16)",
      silhouette: "rgba(17,18,22,0.56)",
      normal: "rgba(202, 130, 26, 0.92)",
      point: "rgba(17,18,22,0.92)",
      background: "#f5f5f7",
    };
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));

    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }

    this.pixelRatio = dpr;
    this.displayWidth = width;
    this.displayHeight = height;
    this.pixelWidth = pixelWidth;
    this.pixelHeight = pixelHeight;
    this.ensureFrameResources(pixelWidth, pixelHeight);
  }

  ensureFrameResources(width, height) {
    if (this.depthBuffer.width !== width || this.depthBuffer.height !== height) {
      this.depthBuffer.resize(width, height);
    }

    if (!this.frameImageData || this.frameImageData.width !== width || this.frameImageData.height !== height) {
      this.frameImageData = this.context.createImageData(width, height);
    }
  }

  ensureProjectedResources(vertexCount) {
    const xyzLength = vertexCount * 3;
    const xyLength = vertexCount * 2;

    if (this.projected.worldPositions.length !== xyzLength) {
      this.projected.worldPositions = new Float32Array(xyzLength);
      this.projected.viewPositions = new Float32Array(xyzLength);
      this.projected.screenPositions = new Float32Array(xyLength);
      this.projected.depths = new Float32Array(vertexCount);
      this.projected.rawZValues = new Float32Array(vertexCount);
    }
  }

  clearFrame(target) {
    target.depthBuffer.clear();
    target.imageData.data.fill(0);
  }

  projectVertices(modelMatrix, viewMatrix, projectionMatrix, width, height) {
    const vertexCount = this.scene.vertexCount;
    this.ensureProjectedResources(vertexCount);

    for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
      const sourceOffset = vertexIndex * 3;
      const modelPosition = new Vector4(
        this.scene.normalizedPositions[sourceOffset],
        this.scene.normalizedPositions[sourceOffset + 1],
        this.scene.normalizedPositions[sourceOffset + 2],
        1,
      );

      const world = modelMatrix.transformVector4(modelPosition);
      const view = viewMatrix.transformVector4(world);
      const clip = projectionMatrix.transformVector4(view);
      const ndc = clip.toVector3();
      const depth = clamp((ndc.z + 1) * 0.5, 0, 1);

      this.projected.worldPositions[sourceOffset] = world.x;
      this.projected.worldPositions[sourceOffset + 1] = world.y;
      this.projected.worldPositions[sourceOffset + 2] = world.z;

      this.projected.viewPositions[sourceOffset] = view.x;
      this.projected.viewPositions[sourceOffset + 1] = view.y;
      this.projected.viewPositions[sourceOffset + 2] = view.z;

      this.projected.screenPositions[vertexIndex * 2] = (ndc.x * 0.5 + 0.5) * width;
      this.projected.screenPositions[vertexIndex * 2 + 1] = (1 - (ndc.y * 0.5 + 0.5)) * height;
      this.projected.depths[vertexIndex] = depth;
      this.projected.rawZValues[vertexIndex] = this.scene.rawPositions[sourceOffset + 2];
    }
  }

  buildVisibleFaces(modelMatrix) {
    const faces = [];
    const visibility = new Array(this.scene.triangleCount).fill(false);
    const normalMatrix = modelMatrix.inverse().transpose();

    for (let faceIndex = 0; faceIndex < this.scene.triangleCount; faceIndex += 1) {
      const a = this.scene.indices[faceIndex * 3];
      const b = this.scene.indices[faceIndex * 3 + 1];
      const c = this.scene.indices[faceIndex * 3 + 2];

      const wa = Vector3.fromArray(this.projected.worldPositions, a * 3);
      const wb = Vector3.fromArray(this.projected.worldPositions, b * 3);
      const wc = Vector3.fromArray(this.projected.worldPositions, c * 3);
      const va = Vector3.fromArray(this.projected.viewPositions, a * 3);
      const vb = Vector3.fromArray(this.projected.viewPositions, b * 3);
      const vc = Vector3.fromArray(this.projected.viewPositions, c * 3);

      const faceNormal = wb.subtract(wa).cross(wc.subtract(wa)).normalize();
      const faceCenter = wa.add(wb).add(wc).scale(1 / 3);
      const viewVector = this.camera.position.subtract(faceCenter).normalize();
      const shouldRender = !this.scene.settings.backfaceCulling || faceNormal.dot(viewVector) > 0;

      if (!shouldRender) {
        continue;
      }

      visibility[faceIndex] = true;
      const screenA = {
        x: this.projected.screenPositions[a * 2],
        y: this.projected.screenPositions[a * 2 + 1],
        depth: this.projected.depths[a],
        rawZ: this.projected.rawZValues[a],
      };
      const screenB = {
        x: this.projected.screenPositions[b * 2],
        y: this.projected.screenPositions[b * 2 + 1],
        depth: this.projected.depths[b],
        rawZ: this.projected.rawZValues[b],
      };
      const screenC = {
        x: this.projected.screenPositions[c * 2],
        y: this.projected.screenPositions[c * 2 + 1],
        depth: this.projected.depths[c],
        rawZ: this.projected.rawZValues[c],
      };

      const transformedVertexNormal = normalMatrix
        .transformVector4(
          new Vector4(
            this.scene.vertexNormals[a * 3],
            this.scene.vertexNormals[a * 3 + 1],
            this.scene.vertexNormals[a * 3 + 2],
            0,
          ),
        )
        .toVector3()
        .normalize();

      faces.push({
        faceIndex,
        indices: [a, b, c],
        p0: screenA,
        p1: screenB,
        p2: screenC,
        averageViewZ: (va.z + vb.z + vc.z) / 3,
        averageDepth: (screenA.depth + screenB.depth + screenC.depth) / 3,
        averageRawZ: (screenA.rawZ + screenB.rawZ + screenC.rawZ) / 3,
        worldCenter: faceCenter,
        normal: faceNormal,
        vertexNormalA: transformedVertexNormal,
      });
    }

    faces.sort((leftFace, rightFace) => leftFace.averageViewZ - rightFace.averageViewZ);
    return { faces, visibility };
  }

  prepareTarget(ctx, width, height) {
    return {
      ctx,
      width,
      height,
      depthBuffer: new DepthBuffer(width, height),
      imageData: ctx.createImageData(width, height),
    };
  }

  beginCanvasFrame(ctx, width, height, background = false) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (background) {
      ctx.fillStyle = this.getThemeColors().background;
      ctx.fillRect(0, 0, width, height);
    }

    ctx.restore();
  }

  render(options = {}) {
    this.resize();

    const target = {
      ctx: this.context,
      width: this.pixelWidth,
      height: this.pixelHeight,
      depthBuffer: this.depthBuffer,
      imageData: this.frameImageData,
    };

    return this.renderToTarget(target, {
      background: false,
      recordResult: true,
      ...options,
    });
  }

  renderToOffscreen(scale = 4) {
    if (typeof document === "undefined") {
      throw new Error("Offscreen export is only available in a browser context.");
    }

    const width = Math.max(1, Math.round(this.displayWidth * scale));
    const height = Math.max(1, Math.round(this.displayHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: true });
    const target = this.prepareTarget(ctx, width, height);
    const info = this.renderToTarget(target, {
      background: true,
      recordResult: false,
    });
    return { canvas, info };
  }

  renderToTarget(target, options = {}) {
    const { background = false, recordResult = true } = options;
    this.beginCanvasFrame(target.ctx, target.width, target.height, background);
    this.clearFrame(target);

    if (this.scene.vertexCount === 0 || this.scene.triangleCount === 0) {
      if (recordResult) {
        this.lastFrameFaces = [];
        this.lastFrameInfo = {
          visibleFaceCount: 0,
          canvasWidth: target.width,
          canvasHeight: target.height,
        };
      }
      return this.lastFrameInfo;
    }

    const aspectRatio = target.width / target.height;
    const modelMatrix = this.scene.getModelMatrix();
    const viewMatrix = this.camera.getViewMatrix();
    const projectionMatrix = this.camera.getProjectionMatrix(aspectRatio);
    this.heatmapShader.setRange(this.scene.rawBounds.min.z, this.scene.rawBounds.max.z);
    this.projectVertices(modelMatrix, viewMatrix, projectionMatrix, target.width, target.height);
    const { faces, visibility } = this.buildVisibleFaces(modelMatrix);
    const runtimeMode = this.scene.settings.runtimeRenderMode;

    if (this.scene.settings.showGrid) {
      this.drawGrid(target.ctx, viewMatrix, projectionMatrix, target.width, target.height);
    }

    if (runtimeMode === "solid") {
      faces.forEach((face) => this.rasterizeTriangle(target, face, "solid"));
    } else if (runtimeMode === "heatmap") {
      faces.forEach((face) => this.rasterizeTriangle(target, face, "heatmap"));
    } else if (runtimeMode === "depth") {
      faces.forEach((face) => this.rasterizeTriangle(target, face, "depth"));
    } else if (runtimeMode === "contour") {
      faces.forEach((face) => this.rasterizeTriangle(target, face, "heatmap"));
    } else if (runtimeMode === "hiddenline") {
      faces.forEach((face) => this.rasterizeTriangle(target, face, "depth-only"));
    }

    if (runtimeMode === "solid" || runtimeMode === "heatmap" || runtimeMode === "depth" || runtimeMode === "contour" || runtimeMode === "hiddenline") {
      target.ctx.putImageData(target.imageData, 0, 0);
    }

    if (runtimeMode === "wireframe") {
      const colors = this.getThemeColors();
      this.drawWireframe(target.ctx, faces, colors.wire, colors.silhouette, visibility);
    }

    if (runtimeMode === "points") {
      this.drawPointCloud(target.ctx, this.getThemeColors().point);
    }

    if (runtimeMode === "hiddenline") {
      this.drawHiddenLines(target, visibility);
      target.ctx.putImageData(target.imageData, 0, 0);
    }

    if (runtimeMode === "contour") {
      this.drawContours(target, faces);
      target.ctx.putImageData(target.imageData, 0, 0);
    }

    if (runtimeMode === "heatmap" || runtimeMode === "solid" || runtimeMode === "depth") {
      this.drawSilhouetteOverlay(target.ctx, visibility, this.getThemeColors().silhouette);
    }

    if (this.scene.settings.showBoundingBox) {
      this.drawBoundingBox(target.ctx, modelMatrix, viewMatrix, projectionMatrix, this.getThemeColors().boundingBox, target.width, target.height);
    }

    if (this.scene.settings.showAxes) {
      const colors = this.getThemeColors();
      this.drawAxes(target.ctx, viewMatrix, projectionMatrix, colors, target.width, target.height);
      this.drawOrientationGizmo(target.ctx, modelMatrix, viewMatrix, projectionMatrix, colors, target.width, target.height);
    }

    if (this.scene.settings.showNormals) {
      this.drawNormals(target.ctx, faces, this.getThemeColors().normal, viewMatrix, projectionMatrix, target.width, target.height);
    }

    if (recordResult) {
      this.lastFrameFaces = faces;
      this.lastFrameInfo = {
        visibleFaceCount: faces.length,
        canvasWidth: target.width,
        canvasHeight: target.height,
      };
    }

    return this.lastFrameInfo;
  }

  projectPoint(point, modelMatrix, viewMatrix, projectionMatrix, width, height) {
    const world = modelMatrix.transformVector4(point.toVector4(1));
    const view = viewMatrix.transformVector4(world);
    const clip = projectionMatrix.transformVector4(view);
    const ndc = clip.toVector3();
    return {
      x: (ndc.x * 0.5 + 0.5) * width,
      y: (1 - (ndc.y * 0.5 + 0.5)) * height,
      depth: clamp((ndc.z + 1) * 0.5, 0, 1),
    };
  }

  drawGrid(ctx, viewMatrix, projectionMatrix, width, height) {
    const extent = Math.max(this.scene.normalizedBounds.size.x, this.scene.normalizedBounds.size.y, 2.4) * 0.75;
    const planeZ = this.scene.normalizedBounds.min.z - 0.02;
    const colors = this.getThemeColors();

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = Math.max(1, this.pixelRatio * 0.8);

    for (let index = -10; index <= 10; index += 1) {
      const offset = (index / 10) * extent;
      const lineAStart = this.projectPoint(new Vector3(-extent, offset, planeZ), Matrix4.identity(), viewMatrix, projectionMatrix, width, height);
      const lineAEnd = this.projectPoint(new Vector3(extent, offset, planeZ), Matrix4.identity(), viewMatrix, projectionMatrix, width, height);
      ctx.beginPath();
      ctx.moveTo(lineAStart.x, lineAStart.y);
      ctx.lineTo(lineAEnd.x, lineAEnd.y);
      ctx.stroke();

      const lineBStart = this.projectPoint(new Vector3(offset, -extent, planeZ), Matrix4.identity(), viewMatrix, projectionMatrix, width, height);
      const lineBEnd = this.projectPoint(new Vector3(offset, extent, planeZ), Matrix4.identity(), viewMatrix, projectionMatrix, width, height);
      ctx.beginPath();
      ctx.moveTo(lineBStart.x, lineBStart.y);
      ctx.lineTo(lineBEnd.x, lineBEnd.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawAxes(ctx, viewMatrix, projectionMatrix, colors, width, height) {
    const axisLength = 1.35;
    const origin = this.projectPoint(new Vector3(0, 0, 0), Matrix4.identity(), viewMatrix, projectionMatrix, width, height);
    const axes = [
      { point: new Vector3(axisLength, 0, 0), color: colors.axisX, label: "X" },
      { point: new Vector3(0, axisLength, 0), color: colors.axisY, label: "Y" },
      { point: new Vector3(0, 0, axisLength), color: colors.axisZ, label: "Z" },
    ];

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.lineWidth = Math.max(1.2, this.pixelRatio);
    ctx.font = `${11 * this.pixelRatio}px Inter, sans-serif`;

    axes.forEach((axis) => {
      const endpoint = this.projectPoint(axis.point, Matrix4.identity(), viewMatrix, projectionMatrix, width, height);
      ctx.beginPath();
      ctx.strokeStyle = axis.color;
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(endpoint.x, endpoint.y);
      ctx.stroke();
      ctx.fillStyle = axis.color;
      ctx.fillText(axis.label, endpoint.x + 4 * this.pixelRatio, endpoint.y - 4 * this.pixelRatio);
    });

    ctx.restore();
  }

  drawBoundingBox(ctx, modelMatrix, viewMatrix, projectionMatrix, color, width, height) {
    const corners = this.scene.getBoundingBoxCorners().map((corner) =>
      this.projectPoint(corner, modelMatrix, viewMatrix, projectionMatrix, width, height),
    );

    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.lineWidth = Math.max(1, this.pixelRatio * 0.8);
    ctx.strokeStyle = color;

    edges.forEach(([start, end]) => {
      ctx.beginPath();
      ctx.moveTo(corners[start].x, corners[start].y);
      ctx.lineTo(corners[end].x, corners[end].y);
      ctx.stroke();
    });

    ctx.restore();
  }

  drawOrientationGizmo(ctx, modelMatrix, viewMatrix, projectionMatrix, colors, width, height) {
    const originX = width - 88 * this.pixelRatio;
    const originY = 96 * this.pixelRatio;
    const radius = 34 * this.pixelRatio;
    const combined = Matrix4.multiplyMany(projectionMatrix, viewMatrix, modelMatrix);
    const axes = [
      { vector: new Vector3(1, 0, 0), label: "X", color: colors.axisX },
      { vector: new Vector3(0, 1, 0), label: "Y", color: colors.axisY },
      { vector: new Vector3(0, 0, 1), label: "Z", color: colors.axisZ },
    ];

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath();
    ctx.fillStyle = this.scene.settings.theme === "dark" ? "rgba(24,28,35,0.68)" : "rgba(255,255,255,0.72)";
    ctx.strokeStyle = this.scene.settings.theme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(17,18,22,0.08)";
    ctx.lineWidth = 1;
    ctx.arc(originX, originY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    axes.forEach((axis) => {
      const projected = combined.transformVector4(axis.vector.toVector4(0)).toVector3().normalize();
      const endX = originX + projected.x * radius * 0.78;
      const endY = originY - projected.y * radius * 0.78;
      ctx.beginPath();
      ctx.strokeStyle = axis.color;
      ctx.lineWidth = Math.max(1.2, this.pixelRatio);
      ctx.moveTo(originX, originY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.fillStyle = axis.color;
      ctx.font = `${11 * this.pixelRatio}px Inter, sans-serif`;
      ctx.fillText(axis.label, endX + 4 * this.pixelRatio, endY - 2 * this.pixelRatio);
    });

    ctx.restore();
  }

  drawNormals(ctx, faces, color, viewMatrix, projectionMatrix, width, height) {
    const sampleStride = Math.max(1, Math.floor(faces.length / 320));

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, this.pixelRatio * 0.8);

    for (let index = 0; index < faces.length; index += sampleStride) {
      const face = faces[index];
      const start = this.projectPoint(face.worldCenter, Matrix4.identity(), viewMatrix, projectionMatrix, width, height);
      const end = this.projectPoint(face.worldCenter.add(face.normal.scale(0.18)), Matrix4.identity(), viewMatrix, projectionMatrix, width, height);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawPointCloud(ctx) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const size = Math.max(1, this.scene.settings.pointSize * this.pixelRatio);

    for (let vertexIndex = 0; vertexIndex < this.scene.vertexCount; vertexIndex += 1) {
      const x = this.projected.screenPositions[vertexIndex * 2];
      const y = this.projected.screenPositions[vertexIndex * 2 + 1];
      const z = this.projected.rawZValues[vertexIndex];
      const color = this.heatmapShader.sample(z);
      ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.95)`;
      ctx.fillRect(x - size * 0.5, y - size * 0.5, size, size);
    }

    ctx.restore();
  }

  drawWireframe(ctx, faces, wireColor, silhouetteColor, visibility) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = wireColor;
    ctx.lineWidth = Math.max(1, this.pixelRatio * 0.85);

    faces.forEach((face) => {
      ctx.beginPath();
      ctx.moveTo(face.p0.x, face.p0.y);
      ctx.lineTo(face.p1.x, face.p1.y);
      ctx.lineTo(face.p2.x, face.p2.y);
      ctx.closePath();
      ctx.stroke();
    });

    this.drawSilhouetteOverlay(ctx, visibility, silhouetteColor);
    ctx.restore();
  }

  drawSilhouetteOverlay(ctx, visibility, silhouetteColor) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = silhouetteColor;
    ctx.lineWidth = Math.max(1.2, this.pixelRatio * 1.2);

    this.scene.edgeMap.forEach((edge) => {
      const faceAVisible = edge.faces[0] !== undefined ? visibility[edge.faces[0]] : false;
      const faceBVisible = edge.faces[1] !== undefined ? visibility[edge.faces[1]] : false;
      const isSilhouette = edge.faces.length === 1 || faceAVisible !== faceBVisible;

      if (!isSilhouette || (!faceAVisible && !faceBVisible)) {
        return;
      }

      const start = {
        x: this.projected.screenPositions[edge.a * 2],
        y: this.projected.screenPositions[edge.a * 2 + 1],
      };
      const end = {
        x: this.projected.screenPositions[edge.b * 2],
        y: this.projected.screenPositions[edge.b * 2 + 1],
      };

      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    });

    ctx.restore();
  }

  drawHiddenLines(target, visibility) {
    const color = this.scene.settings.theme === "dark"
      ? { r: 255, g: 255, b: 255, a: 255 }
      : { r: 24, g: 26, b: 31, a: 255 };

    this.scene.edgeMap.forEach((edge) => {
      const faceAVisible = edge.faces[0] !== undefined ? visibility[edge.faces[0]] : false;
      const faceBVisible = edge.faces[1] !== undefined ? visibility[edge.faces[1]] : false;

      if (!faceAVisible && !faceBVisible) {
        return;
      }

      const start = {
        x: this.projected.screenPositions[edge.a * 2],
        y: this.projected.screenPositions[edge.a * 2 + 1],
        depth: this.projected.depths[edge.a],
      };
      const end = {
        x: this.projected.screenPositions[edge.b * 2],
        y: this.projected.screenPositions[edge.b * 2 + 1],
        depth: this.projected.depths[edge.b],
      };

      this.drawDepthTestedLine(target, start, end, color, 0.002);
    });
  }

  drawContours(target, faces) {
    const levels = this.scene.getContourLevels();
    const lineColor = this.scene.settings.theme === "dark"
      ? { r: 255, g: 255, b: 255, a: 215 }
      : { r: 18, g: 19, b: 24, a: 150 };

    faces.forEach((face) => {
      const vertices = [face.p0, face.p1, face.p2];

      levels.forEach((level, levelIndex) => {
        const intersections = [];

        for (let edgeIndex = 0; edgeIndex < 3; edgeIndex += 1) {
          const start = vertices[edgeIndex];
          const end = vertices[(edgeIndex + 1) % 3];
          const minZ = Math.min(start.rawZ, end.rawZ);
          const maxZ = Math.max(start.rawZ, end.rawZ);

          if (level < minZ || level > maxZ || Math.abs(end.rawZ - start.rawZ) < EPSILON) {
            continue;
          }

          const t = (level - start.rawZ) / (end.rawZ - start.rawZ);
          intersections.push({
            x: lerp(start.x, end.x, t),
            y: lerp(start.y, end.y, t),
            depth: lerp(start.depth, end.depth, t),
          });
        }

        if (intersections.length === 2) {
          this.drawDepthTestedLine(target, intersections[0], intersections[1], lineColor, 0.001 + levelIndex * 0.000005);
        }
      });
    });
  }

  drawDepthTestedLine(target, start, end, color, depthBias = 0) {
    const steps = Math.max(2, Math.ceil(Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y))));

    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const x = Math.round(lerp(start.x, end.x, t));
      const y = Math.round(lerp(start.y, end.y, t));
      const depth = lerp(start.depth, end.depth, t) + depthBias;

      if (x < 0 || x >= target.width || y < 0 || y >= target.height) {
        continue;
      }

      if (depth <= target.depthBuffer.get(x, y) + 0.003) {
        this.writePixel(target, x, y, depth, color);
        this.writePixel(target, x + 1, y, depth, { ...color, a: Math.round(color.a * 0.35) });
        this.writePixel(target, x, y + 1, depth, { ...color, a: Math.round(color.a * 0.35) });
      }
    }
  }

  shadeSolid(normal, depth) {
    const lightDirection = new Vector3(0.32, 0.58, 0.74).normalize();
    const diffuse = clamp(normal.normalize().dot(lightDirection) * 0.5 + 0.5, 0.18, 1);
    const base = this.scene.settings.theme === "dark" ? 205 : 238;
    const accent = this.scene.settings.theme === "dark" ? 24 : -18;
    const depthTerm = lerp(26, 0, clamp(depth, 0, 1));

    return {
      r: clamp(Math.round(base * diffuse + accent + depthTerm), 0, 255),
      g: clamp(Math.round(base * diffuse + depthTerm), 0, 255),
      b: clamp(Math.round(base * diffuse - accent + depthTerm), 0, 255),
      a: Math.round(this.scene.settings.opacity * 255),
    };
  }

  rasterizeTriangle(target, face, mode) {
    const minX = clamp(Math.floor(Math.min(face.p0.x, face.p1.x, face.p2.x)), 0, target.width - 1);
    const maxX = clamp(Math.ceil(Math.max(face.p0.x, face.p1.x, face.p2.x)), 0, target.width - 1);
    const minY = clamp(Math.floor(Math.min(face.p0.y, face.p1.y, face.p2.y)), 0, target.height - 1);
    const maxY = clamp(Math.ceil(Math.max(face.p0.y, face.p1.y, face.p2.y)), 0, target.height - 1);
    const area = edgeFunction(face.p0.x, face.p0.y, face.p1.x, face.p1.y, face.p2.x, face.p2.y);

    if (Math.abs(area) < EPSILON) {
      return;
    }

    const solidColor = mode === "solid" ? this.shadeSolid(face.normal, face.averageDepth) : null;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const sampleX = x + 0.5;
        const sampleY = y + 0.5;
        const w0 = edgeFunction(face.p1.x, face.p1.y, face.p2.x, face.p2.y, sampleX, sampleY);
        const w1 = edgeFunction(face.p2.x, face.p2.y, face.p0.x, face.p0.y, sampleX, sampleY);
        const w2 = edgeFunction(face.p0.x, face.p0.y, face.p1.x, face.p1.y, sampleX, sampleY);

        const inside = area > 0
          ? w0 >= -EPSILON && w1 >= -EPSILON && w2 >= -EPSILON
          : w0 <= EPSILON && w1 <= EPSILON && w2 <= EPSILON;

        if (!inside) {
          continue;
        }

        const alpha = w0 / area;
        const beta = w1 / area;
        const gamma = w2 / area;
        const depth = alpha * face.p0.depth + beta * face.p1.depth + gamma * face.p2.depth;

        if (!target.depthBuffer.testAndSet(x, y, depth)) {
          continue;
        }

        if (mode === "depth-only") {
          continue;
        }

        if (mode === "solid") {
          this.writePixel(target, x, y, depth, solidColor, false);
          continue;
        }

        if (mode === "depth") {
          const color = this.heatmapShader.sampleFromDepth(depth);
          color.a = Math.round(this.scene.settings.opacity * 255);
          this.writePixel(target, x, y, depth, color, false);
          continue;
        }

        if (mode === "heatmap") {
          const zValue = this.scene.settings.heatmapInterpolation
            ? alpha * face.p0.rawZ + beta * face.p1.rawZ + gamma * face.p2.rawZ
            : face.averageRawZ;
          const color = this.heatmapShader.sample(zValue);
          color.a = Math.round(this.scene.settings.opacity * 255);
          this.writePixel(target, x, y, depth, color, false);
        }
      }
    }
  }

  writePixel(target, x, y, depth, color, depthTested = true) {
    if (x < 0 || y < 0 || x >= target.width || y >= target.height) {
      return;
    }

    if (depthTested && !target.depthBuffer.testAndSet(x, y, depth)) {
      return;
    }

    const pixelIndex = (y * target.width + x) * 4;
    const buffer = target.imageData.data;
    const sourceAlpha = clamp((color.a ?? 255) / 255, 0, 1);

    if (sourceAlpha >= 0.999) {
      buffer[pixelIndex] = color.r;
      buffer[pixelIndex + 1] = color.g;
      buffer[pixelIndex + 2] = color.b;
      buffer[pixelIndex + 3] = color.a ?? 255;
      return;
    }

    const destinationAlpha = buffer[pixelIndex + 3] / 255;
    const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);

    const blendChannel = (sourceChannel, destinationChannel) => {
      const sourceLinear = this.heatmapShader.srgbToLinear(sourceChannel);
      const destinationLinear = this.heatmapShader.srgbToLinear(destinationChannel);
      const blendedLinear =
        (sourceLinear * sourceAlpha + destinationLinear * destinationAlpha * (1 - sourceAlpha)) /
        Math.max(outputAlpha, EPSILON);
      return Math.round(this.heatmapShader.linearToSrgb(blendedLinear));
    };

    buffer[pixelIndex] = blendChannel(color.r, buffer[pixelIndex]);
    buffer[pixelIndex + 1] = blendChannel(color.g, buffer[pixelIndex + 1]);
    buffer[pixelIndex + 2] = blendChannel(color.b, buffer[pixelIndex + 2]);
    buffer[pixelIndex + 3] = Math.round(outputAlpha * 255);
  }

  pick(clientX, clientY) {
    if (!this.lastFrameFaces.length) {
      return null;
    }

    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * this.pixelRatio;
    const y = (clientY - rect.top) * this.pixelRatio;

    if (x < 0 || y < 0 || x >= this.pixelWidth || y >= this.pixelHeight) {
      return null;
    }

    const storedDepth = this.depthBuffer.get(Math.floor(x), Math.floor(y));

    for (let index = this.lastFrameFaces.length - 1; index >= 0; index -= 1) {
      const face = this.lastFrameFaces[index];
      const area = edgeFunction(face.p0.x, face.p0.y, face.p1.x, face.p1.y, face.p2.x, face.p2.y);

      if (Math.abs(area) < EPSILON) {
        continue;
      }

      const w0 = edgeFunction(face.p1.x, face.p1.y, face.p2.x, face.p2.y, x, y);
      const w1 = edgeFunction(face.p2.x, face.p2.y, face.p0.x, face.p0.y, x, y);
      const w2 = edgeFunction(face.p0.x, face.p0.y, face.p1.x, face.p1.y, x, y);
      const inside = area > 0
        ? w0 >= -EPSILON && w1 >= -EPSILON && w2 >= -EPSILON
        : w0 <= EPSILON && w1 <= EPSILON && w2 <= EPSILON;

      if (!inside) {
        continue;
      }

      const alpha = w0 / area;
      const beta = w1 / area;
      const gamma = w2 / area;
      const depth = alpha * face.p0.depth + beta * face.p1.depth + gamma * face.p2.depth;

      if (depth > storedDepth + 0.004) {
        continue;
      }

      return {
        x: clientX,
        y: clientY,
        depth,
        rawZ: alpha * face.p0.rawZ + beta * face.p1.rawZ + gamma * face.p2.rawZ,
        faceIndex: face.faceIndex,
      };
    }

    return null;
  }

  getCanvasSizeLabel() {
    return `${this.displayWidth} × ${this.displayHeight}`;
  }

  getCurrentRuntimeModeLabel() {
    const mode = this.scene.settings.runtimeRenderMode;
    const labels = {
      heatmap: "Heatmap",
      solid: "Solid Fill",
      wireframe: "Wireframe",
      points: "Point Cloud",
      hiddenline: "Hidden Line",
      depth: "Depth Shading",
      contour: "Contour Lines",
    };
    return labels[mode] ?? mode;
  }
}
