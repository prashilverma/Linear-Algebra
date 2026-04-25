import { Vector3 } from "../math/Vector3.js";

export class ContourGenerator {
  /**
   * Generates contour segments for a regular scalar grid.
   * Each segment endpoint is returned as a Vector3(x, y, contourLevel),
   * which means the isolines remain valid 3D geometry that can be rotated
   * by the same matrix pipeline as the point cloud.
   */
  static generate(grid, interval) {
    const levels = ContourGenerator.buildLevels(grid.minElevation, grid.maxElevation, interval);
    const lines = levels.map((level, index) => ({
      level,
      major: index % 4 === 0,
      segments: [],
    }));

    for (let row = 0; row < grid.rows - 1; row += 1) {
      for (let column = 0; column < grid.columns - 1; column += 1) {
        const cell = ContourGenerator.getCell(grid, row, column);

        lines.forEach((line) => {
          const segments = ContourGenerator.processCell(cell, line.level);
          if (segments.length > 0) {
            line.segments.push(...segments);
          }
        });
      }
    }

    return lines.filter((line) => line.segments.length > 0);
  }

  static buildLevels(min, max, interval) {
    const levels = [];
    const safeInterval = Math.max(1, interval);
    const first = Math.floor(min / safeInterval) * safeInterval;

    for (let level = first; level <= max; level += safeInterval) {
      if (level > min && level < max) {
        levels.push(Number(level.toFixed(6)));
      }
    }

    if (levels.length === 0) {
      levels.push(Number(((min + max) * 0.5).toFixed(6)));
    }

    return levels;
  }

  static getCell(grid, row, column) {
    const index = (r, c) => r * grid.columns + c;

    return {
      bl: grid.points[index(row, column)],
      br: grid.points[index(row, column + 1)],
      tr: grid.points[index(row + 1, column + 1)],
      tl: grid.points[index(row + 1, column)],
    };
  }

  static processCell(cell, level) {
    const index =
      (cell.bl.z >= level ? 1 : 0) |
      (cell.br.z >= level ? 2 : 0) |
      (cell.tr.z >= level ? 4 : 0) |
      (cell.tl.z >= level ? 8 : 0);

    if (index === 0 || index === 15) {
      return [];
    }

    if (index === 5 || index === 10) {
      return ContourGenerator.resolveAmbiguousCell(cell, level, index);
    }

    const lookup = {
      1: [[3, 0]],
      2: [[0, 1]],
      3: [[3, 1]],
      4: [[1, 2]],
      6: [[0, 2]],
      7: [[3, 2]],
      8: [[2, 3]],
      9: [[0, 2]],
      11: [[1, 2]],
      12: [[3, 1]],
      13: [[0, 1]],
      14: [[3, 0]],
    };

    return lookup[index].map(([edgeA, edgeB]) => ({
      start: ContourGenerator.edgePoint(cell, edgeA, level),
      end: ContourGenerator.edgePoint(cell, edgeB, level),
    }));
  }

  /**
   * Cases 5 and 10 are saddle points where opposite corners sit above the contour level.
   * We use the average cell value as a simple asymptotic decider so the contour topology
   * remains stable instead of randomly crossing the cell.
   */
  static resolveAmbiguousCell(cell, level, index) {
    const centerValue = (cell.bl.z + cell.br.z + cell.tr.z + cell.tl.z) / 4;
    const centerIsHigh = centerValue >= level;

    if (index === 5) {
      return centerIsHigh
        ? [
            { start: ContourGenerator.edgePoint(cell, 0, level), end: ContourGenerator.edgePoint(cell, 1, level) },
            { start: ContourGenerator.edgePoint(cell, 3, level), end: ContourGenerator.edgePoint(cell, 2, level) },
          ]
        : [
            { start: ContourGenerator.edgePoint(cell, 3, level), end: ContourGenerator.edgePoint(cell, 0, level) },
            { start: ContourGenerator.edgePoint(cell, 1, level), end: ContourGenerator.edgePoint(cell, 2, level) },
          ];
    }

    return centerIsHigh
      ? [
          { start: ContourGenerator.edgePoint(cell, 3, level), end: ContourGenerator.edgePoint(cell, 0, level) },
          { start: ContourGenerator.edgePoint(cell, 2, level), end: ContourGenerator.edgePoint(cell, 1, level) },
        ]
      : [
          { start: ContourGenerator.edgePoint(cell, 0, level), end: ContourGenerator.edgePoint(cell, 1, level) },
          { start: ContourGenerator.edgePoint(cell, 3, level), end: ContourGenerator.edgePoint(cell, 2, level) },
        ];
  }

  static edgePoint(cell, edge, level) {
    switch (edge) {
      case 0:
        return ContourGenerator.interpolate(cell.bl, cell.br, level);
      case 1:
        return ContourGenerator.interpolate(cell.br, cell.tr, level);
      case 2:
        return ContourGenerator.interpolate(cell.tl, cell.tr, level);
      case 3:
      default:
        return ContourGenerator.interpolate(cell.bl, cell.tl, level);
    }
  }

  /**
   * Linear interpolation is the geometric heart of Marching Squares:
   * if the contour value sits partway between two samples, the contour point
   * must sit at the same scalar fraction along the edge in x/y space.
   */
  static interpolate(start, end, level) {
    const delta = end.z - start.z;
    const t = delta === 0 ? 0.5 : (level - start.z) / delta;

    return new Vector3(
      start.x + (end.x - start.x) * t,
      start.y + (end.y - start.y) * t,
      level,
    );
  }
}

export default ContourGenerator;
