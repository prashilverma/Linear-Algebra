import { ColorMapper } from "./core/ColorMapper.js";
import { ContourGenerator } from "./core/ContourGenerator.js";
import { HistoryManager } from "./core/HistoryManager.js";
import { Projection } from "./core/Projection.js";
import { RecommendationEngine } from "./core/RecommendationEngine.js";
import { Transform3D } from "./core/Transform3D.js";
import { createCylinderDataset } from "./data/cylinderData.js";
import { FileParser } from "./data/FileParser.js";
import { createTerrainDataset } from "./data/terrainData.js";
import { Vector3 } from "./math/Vector3.js";
import { CanvasRenderer } from "./render/CanvasRenderer.js";
import { Controls } from "./ui/Controls.js";
import { Onboarding } from "./ui/Onboarding.js";
import { StatsPanel } from "./ui/StatsPanel.js";

const builtInDatasets = [createTerrainDataset(), createCylinderDataset()];
const uploadedDatasets = [];
const datasetMap = new Map(builtInDatasets.map((dataset) => [dataset.id, dataset]));
const contourCache = new Map();

function getAvailableDatasets() {
  return [...builtInDatasets, ...uploadedDatasets];
}

function resolveDataset(datasetId) {
  return datasetMap.get(datasetId) ?? builtInDatasets[0];
}

function datasetSupportsContours(dataset) {
  return Boolean(dataset.grid) && dataset.supportsContours !== false;
}

function createDefaultState(datasetId = "terrain") {
  const dataset = resolveDataset(datasetId);

  return {
    datasetId: dataset.id,
    renderMode: datasetSupportsContours(dataset) ? "combined" : "heatmap",
    rotationX: 58,
    rotationY: -18,
    rotationZ: 34,
    zoom: 1,
    contourInterval: dataset.recommendedContourInterval,
    pointSize: 3.5,
    pointDensity: 1,
  };
}

const renderer = new CanvasRenderer(document.getElementById("topography-canvas"));
const controls = new Controls(document.getElementById("controls-panel"));
const statsPanel = new StatsPanel(document.getElementById("stats-panel"));
const onboarding = new Onboarding(document.getElementById("onboarding-modal"));
const historyManager = new HistoryManager();
const recommendationEngine = new RecommendationEngine();

const historyList = document.getElementById("history-list");
const learningTitle = document.getElementById("learning-title");
const learningBody = document.getElementById("learning-body");
const learningHints = document.getElementById("learning-hints");
const legendMin = document.getElementById("legend-min");
const legendMid = document.getElementById("legend-mid");
const legendMax = document.getElementById("legend-max");
const legendSwatch = document.getElementById("legend-swatch");
const toastContainer = document.getElementById("toast-container");

legendSwatch.style.background = ColorMapper.toCSSGradient();

let state = createDefaultState();
let renderQueued = false;
let historyTimer = null;

controls.populateDatasets(getAvailableDatasets());
controls.setUploadStatus("No uploaded dataset loaded yet.");
controls.attach({
  onChange: handleStateChange,
  onReset: resetView,
  onExport: exportCanvas,
  onClearHistory: clearHistory,
  onUpload: handleFileUpload,
});
controls.sync(state);

onboarding.attach();

if (onboarding.shouldShow()) {
  onboarding.show();
}

function sanitizeStateForDataset(candidateState, dataset, { notify = false } = {}) {
  const nextState = { ...candidateState };

  if (!datasetSupportsContours(dataset) && nextState.renderMode !== "heatmap") {
    nextState.renderMode = "heatmap";
    if (notify) {
      showToast("Uploaded point clouds render in heatmap mode. Contours require a regular scalar grid.");
    }
  }

  return nextState;
}

function handleStateChange(partialState) {
  const nextDatasetId = partialState.datasetId ?? state.datasetId;
  const datasetChanged = nextDatasetId !== state.datasetId;
  const dataset = resolveDataset(nextDatasetId);
  let nextState = {
    ...state,
    ...partialState,
  };

  if (datasetChanged) {
    nextState.contourInterval = dataset.recommendedContourInterval;
  }

  nextState = sanitizeStateForDataset(nextState, dataset, {
    notify: datasetChanged || Object.prototype.hasOwnProperty.call(partialState, "renderMode"),
  });

  state = nextState;
  controls.sync(state);
  requestRender();
  queueHistorySave();
}

async function handleFileUpload(file) {
  try {
    const uploadedDataset = await FileParser.parseFile(file);
    uploadedDatasets.push(uploadedDataset);
    datasetMap.set(uploadedDataset.id, uploadedDataset);

    controls.populateDatasets(getAvailableDatasets());
    controls.setUploadStatus(`Loaded: ${uploadedDataset.name}`);

    state = createDefaultState(uploadedDataset.id);
    controls.sync(state);
    requestRender();
    queueHistorySave();
    showToast(`Loaded ${uploadedDataset.name} with ${uploadedDataset.stats.totalPoints.toLocaleString()} points.`);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "The uploaded file could not be parsed.");
  }
}

function requestRender() {
  if (renderQueued) {
    return;
  }

  renderQueued = true;
  window.requestAnimationFrame(() => {
    renderQueued = false;
    renderScene();
  });
}

function renderScene() {
  const dataset = resolveDataset(state.datasetId);
  const rotationMatrix = Transform3D.createRotationMatrix({
    x: state.rotationX,
    y: state.rotationY,
    z: state.rotationZ,
  });

  const points = dataset.points
    .map((point) => {
      const transformed = Transform3D.transformPoint(point, rotationMatrix);
      return {
        original: point,
        transformed,
        projected: Projection.projectPoint(transformed),
      };
    })
    .sort((a, b) => a.transformed.z - b.transformed.z);

  const contours = getProjectedContours(dataset, state.contourInterval, rotationMatrix);
  const axes = buildAxisGuide(rotationMatrix);

  renderer.render({
    points,
    contours,
    axes,
    state,
    elevationRange: {
      min: dataset.stats.minElevation,
      max: dataset.stats.maxElevation,
    },
  });

  updateStats(dataset);
  updateLegend(dataset.stats.minElevation, dataset.stats.maxElevation);
  updateRecommendations(dataset);
}

function getProjectedContours(dataset, interval, rotationMatrix) {
  if (!datasetSupportsContours(dataset)) {
    return [];
  }

  const cacheKey = `${dataset.id}:${interval}`;

  if (!contourCache.has(cacheKey)) {
    contourCache.set(cacheKey, ContourGenerator.generate(dataset.grid, interval));
  }

  const contourLines = contourCache.get(cacheKey);

  return contourLines.map((line) => ({
    level: line.level,
    major: line.major,
    segments: line.segments.map((segment) => ({
      start: Projection.projectPoint(Transform3D.transformPoint(segment.start, rotationMatrix)),
      end: Projection.projectPoint(Transform3D.transformPoint(segment.end, rotationMatrix)),
    })),
  }));
}

function buildAxisGuide(rotationMatrix) {
  const axisLength = 1.15;

  return [
    {
      label: "X",
      color: "rgba(236, 115, 92, 0.95)",
      vector: Projection.projectPoint(rotationMatrix.multiplyVector(new Vector3(axisLength, 0, 0))).normalize(),
    },
    {
      label: "Y",
      color: "rgba(122, 201, 165, 0.95)",
      vector: Projection.projectPoint(rotationMatrix.multiplyVector(new Vector3(0, axisLength, 0))).normalize(),
    },
    {
      label: "Z",
      color: "rgba(113, 171, 235, 0.95)",
      vector: Projection.projectPoint(rotationMatrix.multiplyVector(new Vector3(0, 0, axisLength))).normalize(),
    },
  ];
}

function updateStats(dataset) {
  statsPanel.update({
    dataset,
    state,
    stats: dataset.stats,
  });
}

function updateLegend(min, max) {
  const midpoint = (min + max) * 0.5;
  legendMin.textContent = min.toFixed(1);
  legendMid.textContent = midpoint.toFixed(1);
  legendMax.textContent = max.toFixed(1);
}

function updateRecommendations(dataset) {
  const recommendation = recommendationEngine.getRecommendation({ state, dataset });
  learningTitle.textContent = recommendation.title;
  learningBody.textContent = recommendation.body;
  learningHints.innerHTML = "";

  recommendation.hints.forEach((hint) => {
    const item = document.createElement("li");
    item.textContent = hint;
    learningHints.append(item);
  });
}

function queueHistorySave() {
  if (historyTimer) {
    window.clearTimeout(historyTimer);
  }

  historyTimer = window.setTimeout(() => {
    const dataset = resolveDataset(state.datasetId);
    historyManager.push(state, dataset.name);
    renderHistory();
  }, 450);
}

function renderHistory() {
  const history = historyManager.getAll();
  historyList.innerHTML = "";

  if (history.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "history-meta";
    emptyState.textContent = "No snapshots stored yet.";
    historyList.append(emptyState);
    return;
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  });

  history.forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `
      <span class="history-item-title">${entry.title}</span>
      <span class="history-meta">${formatter.format(new Date(entry.createdAt))}</span>
    `;

    button.addEventListener("click", () => {
      if (!datasetMap.has(entry.state.datasetId)) {
        showToast("That saved view references an upload that is no longer loaded. Please upload the file again.");
        return;
      }

      const dataset = resolveDataset(entry.state.datasetId);
      state = sanitizeStateForDataset({ ...entry.state }, dataset);
      controls.sync(state);
      requestRender();
      showToast("View state restored.");
    });

    historyList.append(button);
  });
}

function resetView() {
  const dataset = resolveDataset(state.datasetId);
  state = sanitizeStateForDataset(createDefaultState(state.datasetId), dataset);
  controls.sync(state);
  requestRender();
  queueHistorySave();
  showToast("View reset to the calibrated default.");
}

function clearHistory() {
  historyManager.clear();
  renderHistory();
  showToast("Stored history cleared.");
}

function exportCanvas() {
  const link = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  link.href = renderer.canvas.toDataURL("image/png");
  link.download = `topography-${state.datasetId}-${stamp}.png`;
  link.click();
  showToast("PNG export created.");
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  toastContainer.append(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 2200);
}

window.addEventListener("resize", requestRender);

renderHistory();
requestRender();
queueHistorySave();
