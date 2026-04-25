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

export function createCylinderDataset() {
  const columns = 54;
  const rows = 54;
  const width = 96;
  const height = 96;
  const points = [];

  for (let row = 0; row < rows; row += 1) {
    const y = -height / 2 + (row / (rows - 1)) * height;

    for (let column = 0; column < columns; column += 1) {
      const x = -width / 2 + (column / (columns - 1)) * width;
      const radius = Math.hypot(x, y);
      const angle = Math.atan2(y, x);

      const outerWall = 44 * Math.exp(-((radius - 28) ** 2) / 40);
      const cavity = -30 * Math.exp(-(radius ** 2) / 180);
      const innerLip = 8 * Math.exp(-((radius - 18) ** 2) / 65);
      const handleOuter = 18 * Math.exp(-((x - 34) ** 2) / 55 - (y ** 2) / 180);
      const handleInnerCut = 12 * Math.exp(-((x - 30) ** 2) / 28 - (y ** 2) / 90);
      const glazeVariation = 3.5 * Math.cos(angle * 2.5) * Math.exp(-((radius - 28) ** 2) / 180);
      const z = outerWall + cavity + innerLip + handleOuter - handleInnerCut + glazeVariation;

      points.push(new Vector3(x, y, z));
    }
  }

  const stats = summarize(points);

  return {
    id: "cylinder",
    name: "Cylindrical Mug Study",
    description: "A mug-like cylindrical scalar field with a cavity, rim, and handle ridge.",
    points,
    grid: {
      columns,
      rows,
      points,
      minElevation: stats.minElevation,
      maxElevation: stats.maxElevation,
    },
    stats,
    recommendedContourInterval: 8,
  };
}

export default createCylinderDataset;
