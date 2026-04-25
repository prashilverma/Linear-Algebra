import { Vector3 } from "../math/Vector3.js";

export class FileParser {
  /**
   * Reads an uploaded text file, extracts XYZ coordinates, and returns a dataset object
   * that matches the rest of the application's rendering contract.
   */
  static async parseFile(file) {
    const extension = FileParser.getExtension(file.name);

    if (!["obj", "csv"].includes(extension)) {
      throw new Error("Unsupported file type. Please upload an .obj or .csv file.");
    }

    const text = await file.text();
    const rawPoints = extension === "obj" ? FileParser.parseObj(text) : FileParser.parseCsv(text);

    if (rawPoints.length === 0) {
      throw new Error("No parsable vertices were found in the uploaded file.");
    }

    const normalizedPoints = FileParser.normalizePoints(rawPoints);
    const stats = FileParser.summarize(normalizedPoints);

    return {
      id: `upload-${Date.now()}`,
      name: file.name,
      description: "User-uploaded point geometry normalized into the internal scene frame.",
      sourceType: "upload",
      supportsContours: false,
      points: normalizedPoints,
      grid: null,
      stats,
      recommendedContourInterval: 10,
    };
  }

  static getExtension(filename) {
    const parts = filename.toLowerCase().split(".");
    return parts.length > 1 ? parts.pop() : "";
  }

  /**
   * OBJ parsing keeps only lines that begin with:
   * v x y z
   * Everything else is intentionally ignored so the parser stays lightweight and explicit.
   */
  static parseObj(text) {
    return text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .reduce((points, line) => {
        const trimmed = line.trim();

        if (!trimmed.startsWith("v ")) {
          return points;
        }

        const [, x, y, z] = trimmed.split(/\s+/);
        const coordinates = [x, y, z].map((value) => Number.parseFloat(value));

        if (coordinates.every((value) => Number.isFinite(value))) {
          points.push(new Vector3(coordinates[0], coordinates[1], coordinates[2]));
        }

        return points;
      }, []);
  }

  /**
   * CSV parsing supports either a header row with X/Y/Z labels or plain XYZ rows.
   * If no recognizable headers exist, the parser falls back to columns 0, 1, and 2.
   */
  static parseCsv(text) {
    const rows = text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (rows.length === 0) {
      return [];
    }

    const firstRow = rows[0].split(",").map((cell) => cell.trim());
    const hasHeader = firstRow.some((cell) => /[a-zA-Z]/.test(cell));
    const columnMap = hasHeader ? FileParser.resolveCsvColumns(firstRow) : { x: 0, y: 1, z: 2 };
    const startIndex = hasHeader ? 1 : 0;

    return rows.slice(startIndex).reduce((points, row) => {
      const cells = row.split(",").map((cell) => cell.trim());
      const x = Number.parseFloat(cells[columnMap.x]);
      const y = Number.parseFloat(cells[columnMap.y]);
      const z = Number.parseFloat(cells[columnMap.z]);

      if ([x, y, z].every((value) => Number.isFinite(value))) {
        points.push(new Vector3(x, y, z));
      }

      return points;
    }, []);
  }

  static resolveCsvColumns(headerCells) {
    const normalizedHeaders = headerCells.map((cell) => cell.toLowerCase().replace(/[\s_\-]/g, ""));
    const x = normalizedHeaders.findIndex((cell) => cell === "x" || cell === "xcoord" || cell === "xcoordinate");
    const y = normalizedHeaders.findIndex((cell) => cell === "y" || cell === "ycoord" || cell === "ycoordinate");
    const z = normalizedHeaders.findIndex((cell) => cell === "z" || cell === "zcoord" || cell === "zcoordinate");

    if (x !== -1 && y !== -1 && z !== -1) {
      return { x, y, z };
    }

    return { x: 0, y: 1, z: 2 };
  }

  /**
   * Bounding-box normalization does two things:
   * 1. translates the model so its box center sits at the origin,
   * 2. applies a single uniform scale factor so all axes preserve proportion.
   * This keeps uploaded data predictable before the interactive zoom slider is used.
   */
  static normalizePoints(points, targetExtent = 96) {
    const bounds = FileParser.getBounds(points);
    const center = new Vector3(
      (bounds.minX + bounds.maxX) * 0.5,
      (bounds.minY + bounds.maxY) * 0.5,
      (bounds.minZ + bounds.maxZ) * 0.5,
    );
    const largestDimension = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ, 1);
    const scale = targetExtent / largestDimension;

    return points.map((point) =>
      new Vector3(
        (point.x - center.x) * scale,
        (point.y - center.y) * scale,
        (point.z - center.z) * scale,
      ),
    );
  }

  static getBounds(points) {
    return points.reduce(
      (bounds, point) => ({
        minX: Math.min(bounds.minX, point.x),
        maxX: Math.max(bounds.maxX, point.x),
        minY: Math.min(bounds.minY, point.y),
        maxY: Math.max(bounds.maxY, point.y),
        minZ: Math.min(bounds.minZ, point.z),
        maxZ: Math.max(bounds.maxZ, point.z),
      }),
      {
        minX: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
        minZ: Number.POSITIVE_INFINITY,
        maxZ: Number.NEGATIVE_INFINITY,
      },
    );
  }

  static summarize(points) {
    let minElevation = Number.POSITIVE_INFINITY;
    let maxElevation = Number.NEGATIVE_INFINITY;

    points.forEach((point) => {
      minElevation = Math.min(minElevation, point.z);
      maxElevation = Math.max(maxElevation, point.z);
    });

    return {
      totalPoints: points.length,
      minElevation,
      maxElevation,
    };
  }
}

export default FileParser;
