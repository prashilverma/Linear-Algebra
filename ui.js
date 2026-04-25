import { Camera, HeatmapShader, Renderer, Scene } from "./engine.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function formatNumber(value, digits = 3) {
  return Number.isFinite(value) ? value.toFixed(digits) : "0.000";
}

function radiansToDegrees(radians) {
  return (radians * 180) / Math.PI;
}

class ExportManager {
  constructor(renderer, scene, camera, uiController) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.uiController = uiController;
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  drawOverlay(canvas) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const scale = width / Math.max(1, this.renderer.displayWidth);
    const dark = this.scene.settings.theme === "dark";
    const panelFill = dark ? "rgba(26,30,37,0.84)" : "rgba(255,255,255,0.84)";
    const panelStroke = dark ? "rgba(255,255,255,0.12)" : "rgba(17,18,22,0.08)";
    const primaryText = dark ? "#f6f7fb" : "#121318";
    const secondaryText = dark ? "rgba(246,247,251,0.68)" : "rgba(18,19,24,0.6)";
    const legendGradient = ctx.createLinearGradient(0, height * 0.15, 0, height * 0.85);
    legendGradient.addColorStop(0, "#ffffff");
    legendGradient.addColorStop(0.34, "#ffe66d");
    legendGradient.addColorStop(0.67, "#ff6158");
    legendGradient.addColorStop(1, "#2657d8");

    ctx.save();
    ctx.fillStyle = panelFill;
    ctx.strokeStyle = panelStroke;
    ctx.lineWidth = Math.max(1, scale);

    const pad = 26 * scale;
    const cardWidth = 330 * scale;
    const cardHeight = 148 * scale;
    this.roundRect(ctx, pad, pad, cardWidth, cardHeight, 26 * scale);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = primaryText;
    ctx.font = `700 ${26 * scale}px Inter, sans-serif`;
    ctx.fillText("TopoTransform", pad + 26 * scale, pad + 42 * scale);
    ctx.font = `500 ${13 * scale}px Inter, sans-serif`;
    ctx.fillStyle = secondaryText;
    ctx.fillText("Pure orthographic topography export", pad + 26 * scale, pad + 68 * scale);

    const infoLines = [
      `Model: ${this.scene.modelName}`,
      `Mode: ${this.renderer.getCurrentRuntimeModeLabel()}`,
      `Vertices: ${this.scene.vertexCount.toLocaleString()}  Faces: ${this.scene.faceCount.toLocaleString()}  Triangles: ${this.scene.triangleCount.toLocaleString()}`,
      `Bounds: ${formatNumber(this.scene.rawBounds.size.x, 2)} × ${formatNumber(this.scene.rawBounds.size.y, 2)} × ${formatNumber(this.scene.rawBounds.size.z, 2)}`,
    ];

    ctx.font = `500 ${12 * scale}px Inter, sans-serif`;
    infoLines.forEach((line, index) => {
      ctx.fillText(line, pad + 26 * scale, pad + (94 + index * 18) * scale);
    });

    const legendWidth = 112 * scale;
    const legendHeight = 320 * scale;
    const legendX = width - pad - legendWidth;
    const legendY = pad;
    this.roundRect(ctx, legendX, legendY, legendWidth, legendHeight, 22 * scale);
    ctx.fillStyle = panelFill;
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = primaryText;
    ctx.font = `700 ${16 * scale}px Inter, sans-serif`;
    ctx.fillText("Elevation", legendX + 18 * scale, legendY + 28 * scale);
    ctx.fillStyle = secondaryText;
    ctx.font = `500 ${11 * scale}px Inter, sans-serif`;
    ctx.fillText("(Original Z)", legendX + 18 * scale, legendY + 48 * scale);

    ctx.fillStyle = legendGradient;
    const barX = legendX + 22 * scale;
    const barY = legendY + 70 * scale;
    const barWidth = 22 * scale;
    const barHeight = 220 * scale;
    this.roundRect(ctx, barX, barY, barWidth, barHeight, 999 * scale);
    ctx.fill();

    ctx.fillStyle = primaryText;
    ctx.font = `600 ${12 * scale}px Inter, sans-serif`;
    ctx.fillText(formatNumber(this.scene.rawBounds.max.z, 3), barX + 36 * scale, barY + 8 * scale);
    ctx.fillText(formatNumber((this.scene.rawBounds.max.z + this.scene.rawBounds.min.z) * 0.5, 3), barX + 36 * scale, barY + barHeight * 0.5);
    ctx.fillText(formatNumber(this.scene.rawBounds.min.z, 3), barX + 36 * scale, barY + barHeight);

    ctx.restore();
  }

  exportPNG() {
    const { canvas } = this.renderer.renderToOffscreen(4);

    if (this.scene.settings.includeUIInExport) {
      this.drawOverlay(canvas);
    }

    const link = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.href = canvas.toDataURL("image/png");
    link.download = `topotransform-${timestamp}.png`;
    link.click();
    this.uiController.showToast("High-resolution PNG export created.", "info");
  }
}

class InteractionController {
  constructor(canvas, scene, camera) {
    this.canvas = canvas;
    this.scene = scene;
    this.camera = camera;
    this.isDragging = false;
    this.isPanning = false;
    this.pointer = {
      inside: false,
      clientX: 0,
      clientY: 0,
    };
    this.altDown = false;
    this.keys = new Set();
    this.targetRotationX = scene.transform.rotationX;
    this.targetRotationY = scene.transform.rotationY;
    this.targetRotationZ = scene.transform.rotationZ;
    this.targetZoom = camera.zoom;
    this.targetPanX = camera.panX;
    this.targetPanY = camera.panY;
    this.inertiaX = 0;
    this.inertiaY = 0;
    this.lastClientX = 0;
    this.lastClientY = 0;
    this.settleTimer = null;
    this.callbacks = {
      onReset: null,
      onFit: null,
      onPreset: null,
      onSave: null,
    };
  }

  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  syncTargetsFromState() {
    this.targetRotationX = this.scene.transform.rotationX;
    this.targetRotationY = this.scene.transform.rotationY;
    this.targetRotationZ = this.scene.transform.rotationZ;
    this.targetZoom = this.camera.zoom;
    this.targetPanX = this.camera.panX;
    this.targetPanY = this.camera.panY;
  }

  attach() {
    this.canvas.addEventListener("pointerdown", (event) => this.handlePointerDown(event));
    this.canvas.addEventListener("pointermove", (event) => this.handlePointerMove(event));
    this.canvas.addEventListener("pointerup", (event) => this.handlePointerUp(event));
    this.canvas.addEventListener("pointerleave", () => this.handlePointerLeave());
    this.canvas.addEventListener("wheel", (event) => this.handleWheel(event), { passive: false });
    this.canvas.addEventListener("dblclick", () => {
      if (this.callbacks.onReset) {
        this.callbacks.onReset();
      }
    });

    window.addEventListener("keydown", (event) => this.handleKeyDown(event));
    window.addEventListener("keyup", (event) => this.handleKeyUp(event));
  }

  handlePointerDown(event) {
    this.canvas.setPointerCapture?.(event.pointerId);
    this.pointer.inside = true;
    this.pointer.clientX = event.clientX;
    this.pointer.clientY = event.clientY;
    this.isDragging = true;
    this.isPanning = event.shiftKey;
    this.lastClientX = event.clientX;
    this.lastClientY = event.clientY;
    this.inertiaX = 0;
    this.inertiaY = 0;
    this.scene.beginInteraction();
    if (this.settleTimer) {
      window.clearTimeout(this.settleTimer);
    }
  }

  handlePointerMove(event) {
    this.pointer.inside = true;
    this.pointer.clientX = event.clientX;
    this.pointer.clientY = event.clientY;

    if (!this.isDragging) {
      return;
    }

    const dx = event.clientX - this.lastClientX;
    const dy = event.clientY - this.lastClientY;
    const precision = event.altKey || this.altDown ? 0.26 : 1;

    if (this.isPanning || event.shiftKey) {
      this.targetPanX += dx * 0.0028 * precision;
      this.targetPanY -= dy * 0.0028 * precision;
    } else {
      this.targetRotationY += dx * 0.007 * precision;
      this.targetRotationX += dy * 0.007 * precision;
      this.inertiaY = dx * 0.14 * precision;
      this.inertiaX = dy * 0.14 * precision;
    }

    this.lastClientX = event.clientX;
    this.lastClientY = event.clientY;
    this.scene.markDirty("pointer-move");
  }

  handlePointerUp(event) {
    this.canvas.releasePointerCapture?.(event.pointerId);
    this.isDragging = false;
    this.isPanning = false;
    this.scheduleInteractionEnd();
  }

  handlePointerLeave() {
    this.pointer.inside = false;
    this.isDragging = false;
    this.isPanning = false;
    this.scheduleInteractionEnd();
  }

  handleWheel(event) {
    event.preventDefault();
    this.scene.beginInteraction();
    const precision = event.altKey || this.altDown ? 0.3 : 1;
    const factor = event.deltaY > 0 ? 0.92 : 1.08;
    this.targetZoom = clamp(this.targetZoom * (1 + (factor - 1) * precision), 0.35, 3);
    this.scene.markDirty("wheel");
    this.scheduleInteractionEnd();
  }

  handleKeyDown(event) {
    this.keys.add(event.key);
    this.altDown = event.altKey || event.key === "Alt";

    if (event.key === "1" && this.callbacks.onPreset) {
      this.callbacks.onPreset("iso");
    } else if (event.key === "2" && this.callbacks.onPreset) {
      this.callbacks.onPreset("top");
    } else if (event.key === "3" && this.callbacks.onPreset) {
      this.callbacks.onPreset("front");
    } else if (event.key === "4" && this.callbacks.onPreset) {
      this.callbacks.onPreset("side");
    } else if ((event.key === "f" || event.key === "F") && this.callbacks.onFit) {
      this.callbacks.onFit();
    } else if ((event.key === "s" || event.key === "S") && this.callbacks.onSave) {
      this.callbacks.onSave();
    } else if ((event.key === "r" || event.key === "R") && this.callbacks.onReset) {
      this.callbacks.onReset();
    }
  }

  handleKeyUp(event) {
    this.keys.delete(event.key);
    if (event.key === "Alt") {
      this.altDown = false;
    }
  }

  scheduleInteractionEnd() {
    if (this.settleTimer) {
      window.clearTimeout(this.settleTimer);
    }

    this.settleTimer = window.setTimeout(() => {
      if (!this.isDragging) {
        this.scene.endInteraction();
      }
    }, 140);
  }

  update(dt) {
    const precision = this.altDown ? 0.35 : 1;
    const rotationStep = 1.4 * dt * precision;
    const panStep = 0.6 * dt * precision;
    let changed = false;

    if (this.keys.has("ArrowLeft")) {
      if (this.keys.has("Shift")) {
        this.targetPanX -= panStep;
      } else {
        this.targetRotationY -= rotationStep;
      }
    }

    if (this.keys.has("ArrowRight")) {
      if (this.keys.has("Shift")) {
        this.targetPanX += panStep;
      } else {
        this.targetRotationY += rotationStep;
      }
    }

    if (this.keys.has("ArrowUp")) {
      if (this.keys.has("Shift")) {
        this.targetPanY += panStep;
      } else {
        this.targetRotationX -= rotationStep;
      }
    }

    if (this.keys.has("ArrowDown")) {
      if (this.keys.has("Shift")) {
        this.targetPanY -= panStep;
      } else {
        this.targetRotationX += rotationStep;
      }
    }

    if (this.keys.has("+") || this.keys.has("=")) {
      this.targetZoom = clamp(this.targetZoom * (1 + 0.8 * dt), 0.35, 3);
    }

    if (this.keys.has("-") || this.keys.has("_")) {
      this.targetZoom = clamp(this.targetZoom * (1 - 0.8 * dt), 0.35, 3);
    }

    if (!this.isDragging) {
      this.targetRotationX += this.inertiaX * dt;
      this.targetRotationY += this.inertiaY * dt;
      this.inertiaX *= Math.pow(0.001, dt);
      this.inertiaY *= Math.pow(0.001, dt);
    }

    const easing = clamp(dt * 12, 0, 1);
    const zoomEasing = clamp(dt * 10, 0, 1);
    const nextRotationX = lerp(this.scene.transform.rotationX, this.targetRotationX, easing);
    const nextRotationY = lerp(this.scene.transform.rotationY, this.targetRotationY, easing);
    const nextRotationZ = lerp(this.scene.transform.rotationZ, this.targetRotationZ, easing);
    const nextZoom = lerp(this.camera.zoom, this.targetZoom, zoomEasing);
    const nextPanX = lerp(this.camera.panX, this.targetPanX, zoomEasing);
    const nextPanY = lerp(this.camera.panY, this.targetPanY, zoomEasing);

    if (Math.abs(nextRotationX - this.scene.transform.rotationX) > 1e-5) {
      this.scene.transform.rotationX = nextRotationX;
      changed = true;
    }

    if (Math.abs(nextRotationY - this.scene.transform.rotationY) > 1e-5) {
      this.scene.transform.rotationY = nextRotationY;
      changed = true;
    }

    if (Math.abs(nextRotationZ - this.scene.transform.rotationZ) > 1e-5) {
      this.scene.transform.rotationZ = nextRotationZ;
      changed = true;
    }

    if (Math.abs(nextZoom - this.camera.zoom) > 1e-5) {
      this.camera.zoom = nextZoom;
      changed = true;
    }

    if (Math.abs(nextPanX - this.camera.panX) > 1e-5) {
      this.camera.panX = nextPanX;
      changed = true;
    }

    if (Math.abs(nextPanY - this.camera.panY) > 1e-5) {
      this.camera.panY = nextPanY;
      changed = true;
    }

    if (changed) {
      this.scene.markDirty("interaction-update");
    }

    return changed;
  }
}

class UIController {
  constructor() {
    this.scene = new Scene();
    this.camera = new Camera();
    this.heatmapShader = new HeatmapShader();
    this.canvas = document.getElementById("viewport");
    this.renderer = new Renderer(this.canvas, this.scene, this.camera, this.heatmapShader);
    this.interaction = new InteractionController(this.canvas, this.scene, this.camera);
    this.exportManager = new ExportManager(this.renderer, this.scene, this.camera, this);
    this.snapshotStorageKey = "topotransform-snapshots";
    this.lastFrameTime = 0;
    this.smoothedFPS = 0;
    this.cacheElements();
    this.restoreSnapshots();
    this.applyTheme(window.localStorage.getItem("topotransform-theme") || "light", false);
    this.bindUI();
    this.interaction.attach();
    this.interaction.setCallbacks({
      onReset: () => this.resetView(),
      onFit: () => this.fitToView(),
      onPreset: (preset) => this.applyCameraPreset(preset),
      onSave: () => this.saveCurrentView(),
    });
    this.syncControlsFromState();
    this.updateMetadata();
    this.updateWarnings();
    this.updateLegend();
    this.updateSnapshotList();
    this.setStatus("Awaiting OBJ input", "info");
    this.start();
  }

  cacheElements() {
    this.elements = {
      fileInput: document.getElementById("file-input"),
      dropZone: document.getElementById("drop-zone"),
      dropZoneStatus: document.getElementById("drop-zone-status"),
      browseButton: document.getElementById("browse-button"),
      clearSceneButton: document.getElementById("clear-scene-button"),
      themeToggle: document.getElementById("theme-toggle"),
      fitViewButton: document.getElementById("fit-view-button"),
      exportButton: document.getElementById("export-button"),
      renderMode: document.getElementById("render-mode"),
      pointSizeSlider: document.getElementById("point-size-slider"),
      pointSizeValue: document.getElementById("point-size-value"),
      opacitySlider: document.getElementById("opacity-slider"),
      opacityValue: document.getElementById("opacity-value"),
      contourDensitySlider: document.getElementById("contour-density-slider"),
      contourDensityValue: document.getElementById("contour-density-value"),
      cameraPreset: document.getElementById("camera-preset"),
      saveViewButton: document.getElementById("save-view-button"),
      resetViewButton: document.getElementById("reset-view-button"),
      rotateX: document.getElementById("rotate-x"),
      rotateY: document.getElementById("rotate-y"),
      rotateZ: document.getElementById("rotate-z"),
      zoomSlider: document.getElementById("zoom-slider"),
      panXSlider: document.getElementById("pan-x-slider"),
      panYSlider: document.getElementById("pan-y-slider"),
      zScaleSlider: document.getElementById("z-scale-slider"),
      rotateXValue: document.getElementById("rotate-x-value"),
      rotateYValue: document.getElementById("rotate-y-value"),
      rotateZValue: document.getElementById("rotate-z-value"),
      zoomValue: document.getElementById("zoom-value"),
      panXValue: document.getElementById("pan-x-value"),
      panYValue: document.getElementById("pan-y-value"),
      zScaleValue: document.getElementById("z-scale-value"),
      gridToggle: document.getElementById("grid-toggle"),
      axesToggle: document.getElementById("axes-toggle"),
      bboxToggle: document.getElementById("bbox-toggle"),
      normalsToggle: document.getElementById("normals-toggle"),
      cullingToggle: document.getElementById("culling-toggle"),
      adaptiveToggle: document.getElementById("adaptive-toggle"),
      heatmapInterpolationToggle: document.getElementById("heatmap-interpolation-toggle"),
      exportUIToggle: document.getElementById("export-ui-toggle"),
      metaVertices: document.getElementById("meta-vertices"),
      metaFaces: document.getElementById("meta-faces"),
      metaTriangles: document.getElementById("meta-triangles"),
      metaBounds: document.getElementById("meta-bounds"),
      warningList: document.getElementById("warning-list"),
      snapshotList: document.getElementById("snapshot-list"),
      legendMin: document.getElementById("legend-min"),
      legendMid: document.getElementById("legend-mid"),
      legendMax: document.getElementById("legend-max"),
      statusPill: document.getElementById("status-pill"),
      fpsValue: document.getElementById("fps-value"),
      qualityStatus: document.getElementById("quality-status"),
      modeStatus: document.getElementById("mode-status"),
      hoverZValue: document.getElementById("hover-z-value"),
      canvasSizeValue: document.getElementById("canvas-size-value"),
      probeTooltip: document.getElementById("probe-tooltip"),
      probeTooltipValue: document.getElementById("probe-tooltip-value"),
      toastRegion: document.getElementById("toast-region"),
    };
  }

  bindUI() {
    this.elements.browseButton.addEventListener("click", () => this.elements.fileInput.click());
    this.elements.fileInput.addEventListener("change", () => {
      const [file] = this.elements.fileInput.files;
      if (file) {
        this.loadFile(file);
      }
      this.elements.fileInput.value = "";
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      this.elements.dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        this.elements.dropZone.classList.add("is-active");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      this.elements.dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        if (eventName === "drop") {
          const [file] = event.dataTransfer.files;
          if (file) {
            this.loadFile(file);
          }
        }
        this.elements.dropZone.classList.remove("is-active");
      });
    });

    this.elements.clearSceneButton.addEventListener("click", () => this.clearScene());
    this.elements.themeToggle.addEventListener("click", () => {
      const nextTheme = this.scene.settings.theme === "light" ? "dark" : "light";
      this.applyTheme(nextTheme, true);
    });
    this.elements.fitViewButton.addEventListener("click", () => this.fitToView());
    this.elements.exportButton.addEventListener("click", () => this.exportManager.exportPNG());
    this.elements.saveViewButton.addEventListener("click", () => this.saveCurrentView());
    this.elements.resetViewButton.addEventListener("click", () => this.resetView());
    this.elements.cameraPreset.addEventListener("change", () => this.applyCameraPreset(this.elements.cameraPreset.value));
    this.elements.renderMode.addEventListener("change", () => {
      this.scene.setRenderMode(this.elements.renderMode.value);
      this.updateModeStatus();
      this.syncControlsFromState();
    });

    this.bindSlider(this.elements.rotateX, (value) => {
      this.scene.transform.rotationX = (value * Math.PI) / 180;
      this.interaction.targetRotationX = this.scene.transform.rotationX;
    });
    this.bindSlider(this.elements.rotateY, (value) => {
      this.scene.transform.rotationY = (value * Math.PI) / 180;
      this.interaction.targetRotationY = this.scene.transform.rotationY;
    });
    this.bindSlider(this.elements.rotateZ, (value) => {
      this.scene.transform.rotationZ = (value * Math.PI) / 180;
      this.interaction.targetRotationZ = this.scene.transform.rotationZ;
    });
    this.bindSlider(this.elements.zoomSlider, (value) => {
      this.camera.zoom = value;
      this.interaction.targetZoom = value;
    });
    this.bindSlider(this.elements.panXSlider, (value) => {
      this.camera.panX = value;
      this.interaction.targetPanX = value;
    });
    this.bindSlider(this.elements.panYSlider, (value) => {
      this.camera.panY = value;
      this.interaction.targetPanY = value;
    });
    this.bindSlider(this.elements.zScaleSlider, (value) => {
      this.scene.transform.zScale = value;
    });
    this.bindSlider(this.elements.pointSizeSlider, (value) => {
      this.scene.settings.pointSize = value;
    });
    this.bindSlider(this.elements.opacitySlider, (value) => {
      this.scene.settings.opacity = value;
    });
    this.bindSlider(this.elements.contourDensitySlider, (value) => {
      this.scene.settings.contourDensity = Math.round(value);
    });

    [
      [this.elements.gridToggle, "showGrid"],
      [this.elements.axesToggle, "showAxes"],
      [this.elements.bboxToggle, "showBoundingBox"],
      [this.elements.normalsToggle, "showNormals"],
      [this.elements.cullingToggle, "backfaceCulling"],
      [this.elements.adaptiveToggle, "adaptive"],
      [this.elements.heatmapInterpolationToggle, "heatmapInterpolation"],
      [this.elements.exportUIToggle, "includeUIInExport"],
    ].forEach(([element, key]) => {
      element.addEventListener("change", () => {
        this.scene.settings[key] = element.checked;
        if (key === "adaptive" && !element.checked) {
          this.scene.settings.runtimeRenderMode = this.scene.settings.renderMode;
        }
        this.scene.markDirty(`toggle-${key}`);
      });
    });

    this.elements.snapshotList.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-snapshot-id]");
      if (!chip) {
        return;
      }
      this.restoreSnapshot(chip.dataset.snapshotId);
    });
  }

  bindSlider(element, apply) {
    element.addEventListener("input", () => {
      apply(Number(element.value));
      this.scene.markDirty(`slider-${element.id}`);
      this.syncControlsFromState();
    });
  }

  loadFile(file) {
    if (!file.name.toLowerCase().endsWith(".obj")) {
      this.showToast("Only local OBJ files are supported in this build.", "warning");
      return;
    }

    const reader = new FileReader();
    this.setStatus("Parsing OBJ and rebuilding mesh topology…", "info");

    reader.onload = () => {
      try {
        this.scene.loadOBJText(String(reader.result), file.name);
        this.elements.dropZoneStatus.textContent = file.name;
        this.camera.setPreset("iso");
        this.camera.fitToBounds(this.scene.normalizedBounds);
        this.resetView(false);
        this.updateMetadata();
        this.updateWarnings();
        this.updateLegend();
        this.syncControlsFromState();
        this.setStatus("Model ingested and normalized successfully.", "info");
        this.showToast(`Loaded ${file.name} with ${this.scene.vertexCount.toLocaleString()} vertices.`, "info");
        if (this.scene.meshWarnings.length) {
          this.showToast("The parser repaired minor issues. See the validation panel for details.", "warning");
        }
      } catch (error) {
        this.showToast(error instanceof Error ? error.message : "Failed to load OBJ file.", "error");
        this.setStatus("OBJ parsing failed.", "error");
      }
    };

    reader.onerror = () => {
      this.showToast("FileReader could not read the selected file.", "error");
      this.setStatus("OBJ file could not be read.", "error");
    };

    reader.readAsText(file);
  }

  clearScene() {
    this.scene.clear();
    this.camera = new Camera();
    this.renderer.camera = this.camera;
    this.interaction.camera = this.camera;
    this.interaction.syncTargetsFromState();
    this.elements.dropZoneStatus.textContent = "No model loaded";
    this.updateMetadata();
    this.updateWarnings();
    this.updateLegend();
    this.syncControlsFromState();
    this.setStatus("Scene cleared.", "info");
    this.showToast("Viewport cleared and camera reset.", "info");
  }

  applyTheme(theme, announce = true) {
    document.documentElement.dataset.theme = theme;
    this.scene.settings.theme = theme;
    window.localStorage.setItem("topotransform-theme", theme);
    this.elements.themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
    this.elements.themeToggle.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
    this.scene.markDirty("theme");
    if (announce) {
      this.showToast(`${theme === "dark" ? "Dark" : "Light"} mode enabled.`, "info");
    }
  }

  applyCameraPreset(preset) {
    this.camera.setPreset(preset);
    if (this.scene.vertexCount > 0) {
      this.camera.fitToBounds(this.scene.normalizedBounds);
    }
    this.interaction.syncTargetsFromState();
    this.scene.markDirty("camera-preset");
    this.syncControlsFromState();
    this.setStatus(`Camera preset: ${preset}.`, "info");
  }

  fitToView() {
    if (this.scene.vertexCount > 0) {
      this.camera.fitToBounds(this.scene.normalizedBounds);
    }
    this.interaction.syncTargetsFromState();
    this.scene.markDirty("fit-view");
    this.syncControlsFromState();
    this.setStatus("Camera fitted to the active mesh bounds.", "info");
  }

  resetView(announce = true) {
    this.scene.transform.rotationX = (-23 * Math.PI) / 180;
    this.scene.transform.rotationY = (-35 * Math.PI) / 180;
    this.scene.transform.rotationZ = (12 * Math.PI) / 180;
    this.scene.transform.scale = 1;
    this.scene.transform.zScale = 1;
    if (this.scene.vertexCount > 0) {
      this.camera.fitToBounds(this.scene.normalizedBounds);
    } else {
      this.camera = new Camera();
      this.renderer.camera = this.camera;
      this.interaction.camera = this.camera;
    }
    this.interaction.syncTargetsFromState();
    this.scene.endInteraction();
    this.scene.markDirty("reset-view");
    this.syncControlsFromState();
    if (announce) {
      this.setStatus("View reset to the calibrated default.", "info");
    }
  }

  saveCurrentView() {
    const snapshot = this.scene.captureSnapshot(this.camera, `View ${this.scene.snapshots.length + 1}`);
    this.persistSnapshots();
    this.updateSnapshotList();
    this.showToast(`Saved ${snapshot.label}.`, "info");
  }

  restoreSnapshot(snapshotId) {
    const snapshot = this.scene.snapshots.find((item) => item.id === snapshotId);
    if (!snapshot) {
      return;
    }
    this.scene.applySnapshot(snapshot, this.camera);
    this.interaction.syncTargetsFromState();
    this.syncControlsFromState();
    this.setStatus(`Restored ${snapshot.label}.`, "info");
    this.showToast(`Restored ${snapshot.label}.`, "info");
  }

  persistSnapshots() {
    try {
      window.localStorage.setItem(this.snapshotStorageKey, JSON.stringify(this.scene.snapshots));
    } catch {
      // Ignore storage failures.
    }
  }

  restoreSnapshots() {
    try {
      const raw = window.localStorage.getItem(this.snapshotStorageKey);
      this.scene.snapshots = raw ? JSON.parse(raw) : [];
    } catch {
      this.scene.snapshots = [];
    }
  }

  updateMetadata() {
    this.elements.metaVertices.textContent = this.scene.vertexCount.toLocaleString();
    this.elements.metaFaces.textContent = this.scene.faceCount.toLocaleString();
    this.elements.metaTriangles.textContent = this.scene.triangleCount.toLocaleString();
    this.elements.metaBounds.textContent = `Min (${formatNumber(this.scene.rawBounds.min.x, 2)}, ${formatNumber(this.scene.rawBounds.min.y, 2)}, ${formatNumber(this.scene.rawBounds.min.z, 2)}) · Max (${formatNumber(this.scene.rawBounds.max.x, 2)}, ${formatNumber(this.scene.rawBounds.max.y, 2)}, ${formatNumber(this.scene.rawBounds.max.z, 2)})`;
  }

  updateWarnings() {
    this.elements.warningList.innerHTML = "";
    const warnings = this.scene.meshWarnings.length ? this.scene.meshWarnings : ["No validation warnings."];
    warnings.forEach((warning) => {
      const item = document.createElement("li");
      item.textContent = warning;
      this.elements.warningList.append(item);
    });
  }

  updateLegend() {
    const min = this.scene.rawBounds.min.z;
    const max = this.scene.rawBounds.max.z;
    const mid = (min + max) * 0.5;
    this.elements.legendMin.textContent = formatNumber(min, 3);
    this.elements.legendMid.textContent = formatNumber(mid, 3);
    this.elements.legendMax.textContent = formatNumber(max, 3);
  }

  updateSnapshotList() {
    this.elements.snapshotList.innerHTML = "";

    if (!this.scene.snapshots.length) {
      const empty = document.createElement("p");
      empty.className = "snapshot-list__empty";
      empty.textContent = "No saved views yet.";
      this.elements.snapshotList.append(empty);
      return;
    }

    const formatter = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    });

    this.scene.snapshots.forEach((snapshot) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "snapshot-chip";
      button.dataset.snapshotId = snapshot.id;
      button.innerHTML = `<strong>${snapshot.label}</strong><span>${formatter.format(new Date(snapshot.createdAt))}</span>`;
      this.elements.snapshotList.append(button);
    });
  }

  syncControlsFromState() {
    this.elements.renderMode.value = this.scene.settings.renderMode;
    this.elements.pointSizeSlider.value = String(this.scene.settings.pointSize);
    this.elements.opacitySlider.value = String(this.scene.settings.opacity);
    this.elements.contourDensitySlider.value = String(this.scene.settings.contourDensity);
    this.elements.rotateX.value = String(Math.round(radiansToDegrees(this.scene.transform.rotationX)));
    this.elements.rotateY.value = String(Math.round(radiansToDegrees(this.scene.transform.rotationY)));
    this.elements.rotateZ.value = String(Math.round(radiansToDegrees(this.scene.transform.rotationZ)));
    this.elements.zoomSlider.value = String(this.camera.zoom);
    this.elements.panXSlider.value = String(this.camera.panX);
    this.elements.panYSlider.value = String(this.camera.panY);
    this.elements.zScaleSlider.value = String(this.scene.transform.zScale);
    this.elements.gridToggle.checked = this.scene.settings.showGrid;
    this.elements.axesToggle.checked = this.scene.settings.showAxes;
    this.elements.bboxToggle.checked = this.scene.settings.showBoundingBox;
    this.elements.normalsToggle.checked = this.scene.settings.showNormals;
    this.elements.cullingToggle.checked = this.scene.settings.backfaceCulling;
    this.elements.adaptiveToggle.checked = this.scene.settings.adaptive;
    this.elements.heatmapInterpolationToggle.checked = this.scene.settings.heatmapInterpolation;
    this.elements.exportUIToggle.checked = this.scene.settings.includeUIInExport;
    this.elements.pointSizeValue.textContent = `${this.scene.settings.pointSize.toFixed(1)} px`;
    this.elements.opacityValue.textContent = this.scene.settings.opacity.toFixed(2);
    this.elements.contourDensityValue.textContent = `${Math.round(this.scene.settings.contourDensity)}`;
    this.elements.rotateXValue.textContent = `${Math.round(radiansToDegrees(this.scene.transform.rotationX))}°`;
    this.elements.rotateYValue.textContent = `${Math.round(radiansToDegrees(this.scene.transform.rotationY))}°`;
    this.elements.rotateZValue.textContent = `${Math.round(radiansToDegrees(this.scene.transform.rotationZ))}°`;
    this.elements.zoomValue.textContent = `${this.camera.zoom.toFixed(2)}x`;
    this.elements.panXValue.textContent = this.camera.panX.toFixed(2);
    this.elements.panYValue.textContent = this.camera.panY.toFixed(2);
    this.elements.zScaleValue.textContent = `${this.scene.transform.zScale.toFixed(2)}x`;
    this.updateModeStatus();
  }

  updateModeStatus() {
    this.elements.modeStatus.textContent = this.renderer.getCurrentRuntimeModeLabel();
    this.elements.qualityStatus.textContent =
      this.scene.settings.runtimeRenderMode !== this.scene.settings.renderMode
        ? "Adaptive Preview"
        : "High (AA Enabled)";
  }

  updateProbe(pickInfo) {
    if (!pickInfo) {
      this.elements.probeTooltip.classList.add("hidden");
      this.elements.hoverZValue.textContent = "—";
      return;
    }

    this.elements.hoverZValue.textContent = formatNumber(pickInfo.rawZ, 3);
    this.elements.probeTooltipValue.textContent = formatNumber(pickInfo.rawZ, 3);
    this.elements.probeTooltip.style.left = `${pickInfo.x + 16}px`;
    this.elements.probeTooltip.style.top = `${pickInfo.y + 16}px`;
    this.elements.probeTooltip.classList.remove("hidden");
  }

  setStatus(message, tone = "info") {
    this.elements.statusPill.textContent = message;
    this.elements.statusPill.classList.toggle("is-warning", tone === "warning");
    this.elements.statusPill.classList.toggle("is-error", tone === "error");
  }

  showToast(message, tone = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${tone === "warning" ? "is-warning" : ""} ${tone === "error" ? "is-error" : ""}`.trim();
    toast.textContent = message;
    this.elements.toastRegion.append(toast);
    window.setTimeout(() => toast.remove(), 2800);
  }

  start() {
    const loop = (timestamp) => {
      if (!this.lastFrameTime) {
        this.lastFrameTime = timestamp;
      }

      const dt = Math.max(1 / 240, Math.min(1 / 20, (timestamp - this.lastFrameTime) / 1000));
      this.lastFrameTime = timestamp;
      const interactionChanged = this.interaction.update(dt);

      if (interactionChanged || this.scene.dirty) {
        const info = this.renderer.render();
        this.scene.dirty = false;
        const currentFPS = 1 / dt;
        this.smoothedFPS = this.smoothedFPS === 0 ? currentFPS : lerp(this.smoothedFPS, currentFPS, 0.12);
        this.elements.fpsValue.textContent = `${Math.round(this.smoothedFPS)}`;
        this.elements.canvasSizeValue.textContent = this.renderer.getCanvasSizeLabel();
        this.updateModeStatus();
        this.updateMetadata();

        if (this.interaction.pointer.inside && !this.interaction.isDragging) {
          this.updateProbe(this.renderer.pick(this.interaction.pointer.clientX, this.interaction.pointer.clientY));
        } else {
          this.updateProbe(null);
        }

        if (info.visibleFaceCount === 0 && this.scene.vertexCount > 0) {
          this.setStatus("Model loaded. Current orientation culled all visible faces; try rotating the mesh.", "warning");
        }
      } else if (this.interaction.pointer.inside && !this.interaction.isDragging) {
        this.updateProbe(this.renderer.pick(this.interaction.pointer.clientX, this.interaction.pointer.clientY));
      } else {
        this.updateProbe(null);
      }

      window.requestAnimationFrame(loop);
    };

    window.requestAnimationFrame(loop);
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    new UIController();
  });
}
