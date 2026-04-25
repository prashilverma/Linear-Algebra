export class StatsPanel {
  constructor(root) {
    this.root = root;
    this.fields = {
      points: document.getElementById("stats-points"),
      elevation: document.getElementById("stats-elevation"),
      dataset: document.getElementById("stats-dataset"),
      mode: document.getElementById("stats-mode"),
      rotation: document.getElementById("stats-rotation"),
    };
  }

  update({ dataset, state, stats }) {
    this.fields.points.textContent = stats.totalPoints.toLocaleString();
    this.fields.elevation.textContent = `${stats.minElevation.toFixed(1)} to ${stats.maxElevation.toFixed(1)}`;
    this.fields.dataset.textContent = dataset.name;
    this.fields.mode.textContent = this.formatMode(state.renderMode);
    this.fields.rotation.textContent = `X ${state.rotationX}\u00B0, Y ${state.rotationY}\u00B0, Z ${state.rotationZ}\u00B0`;
  }

  formatMode(mode) {
    const labels = {
      heatmap: "Heatmap Only",
      contours: "Contours Only",
      combined: "Combined",
    };

    return labels[mode] ?? mode;
  }
}

export default StatsPanel;
