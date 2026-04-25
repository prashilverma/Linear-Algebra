import { Vector3 } from "../math/Vector3.js";

function summarize(points) {
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

export function createTerrainDataset() {
  const columns = 48;
  const rows = 48;
  const width = 108;
  const height = 108;
  const points = [];

  for (let row = 0; row < rows; row += 1) {
    const y = -height / 2 + (row / (rows - 1)) * height;

    for (let column = 0; column < columns; column += 1) {
      const x = -width / 2 + (column / (columns - 1)) * width;

      const longWave = 14 * Math.sin(x * 0.11) * Math.cos(y * 0.08);
      const ridge = 9 * Math.sin((x + y) * 0.09);
      const summit = 28 * Math.exp(-((x + 17) ** 2 + (y - 14) ** 2) / 520);
      const basin = -18 * Math.exp(-((x - 20) ** 2 + (y + 18) ** 2) / 430);
      const terrace = 7 * Math.cos(Math.hypot(x - 8, y + 10) * 0.17);
      const z = longWave + ridge + summit + basin + terrace;

      points.push(new Vector3(x, y, z));
    }
  }

  const stats = summarize(points);

  return {
    id: "terrain",
    name: "Folded Terrain Grid",
    description: "A terrain-like scalar field with ridges, valleys, and one dominant summit.",
    points,
    grid: {
      columns,
      rows,
      points,
      minElevation: stats.minElevation,
      maxElevation: stats.maxElevation,
    },
    stats,
    recommendedContourInterval: 10,
  };
}

export default createTerrainDataset;
