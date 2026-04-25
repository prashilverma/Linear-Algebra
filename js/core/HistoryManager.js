export class HistoryManager {
  constructor(storageKey = "topography-view-history", maxEntries = 10) {
    this.storageKey = storageKey;
    this.maxEntries = maxEntries;
    this.memoryFallback = [];
  }

  getAll() {
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : this.memoryFallback;
    } catch {
      return this.memoryFallback;
    }
  }

  write(history) {
    this.memoryFallback = [...history];

    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(history));
    } catch {
      // Ignore storage failures and keep the in-memory fallback alive.
    }

    return history;
  }

  push(state, datasetName) {
    const history = this.getAll();
    const snapshot = { ...state };

    if (history[0] && this.isSameState(history[0].state, snapshot)) {
      return history;
    }

    const entry = {
      id: `history-${Date.now()}`,
      title: `${datasetName} • ${this.formatMode(state.renderMode)}`,
      createdAt: new Date().toISOString(),
      state: snapshot,
    };

    history.unshift(entry);
    history.length = Math.min(history.length, this.maxEntries);

    return this.write(history);
  }

  clear() {
    return this.write([]);
  }

  isSameState(a, b) {
    return (
      a.datasetId === b.datasetId &&
      a.renderMode === b.renderMode &&
      a.rotationX === b.rotationX &&
      a.rotationY === b.rotationY &&
      a.rotationZ === b.rotationZ &&
      a.zoom === b.zoom &&
      a.contourInterval === b.contourInterval &&
      a.pointSize === b.pointSize &&
      a.pointDensity === b.pointDensity
    );
  }

  formatMode(mode) {
    const labels = {
      heatmap: "Heatmap",
      contours: "Contours",
      combined: "Combined",
    };

    return labels[mode] ?? mode;
  }
}

export default HistoryManager;
