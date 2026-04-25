export class Controls {
  constructor(root) {
    this.root = root;
    this.dragDepth = 0;
    this.inputs = {
      datasetId: document.getElementById("dataset-select"),
      renderMode: document.getElementById("render-mode-select"),
      rotationX: document.getElementById("rotation-x"),
      rotationY: document.getElementById("rotation-y"),
      rotationZ: document.getElementById("rotation-z"),
      zoom: document.getElementById("zoom"),
      contourInterval: document.getElementById("contour-interval"),
      pointSize: document.getElementById("point-size"),
      pointDensity: document.getElementById("point-density"),
    };

    this.readouts = {
      rotationX: document.getElementById("rotation-x-value"),
      rotationY: document.getElementById("rotation-y-value"),
      rotationZ: document.getElementById("rotation-z-value"),
      zoom: document.getElementById("zoom-value"),
      contourInterval: document.getElementById("contour-interval-value"),
      pointSize: document.getElementById("point-size-value"),
      pointDensity: document.getElementById("point-density-value"),
    };

    this.resetButton = document.getElementById("reset-view");
    this.exportButton = document.getElementById("export-png");
    this.clearHistoryButton = document.getElementById("clear-history");
    this.uploadZone = document.getElementById("upload-zone");
    this.uploadInput = document.getElementById("upload-input");
    this.uploadStatus = document.getElementById("upload-status");
  }

  populateDatasets(datasets) {
    this.inputs.datasetId.innerHTML = "";

    datasets.forEach((dataset) => {
      const option = document.createElement("option");
      option.value = dataset.id;
      option.textContent = dataset.name;
      this.inputs.datasetId.append(option);
    });
  }

  attach({ onChange, onReset, onExport, onClearHistory, onUpload }) {
    this.inputs.datasetId.addEventListener("change", () => {
      onChange({ datasetId: this.inputs.datasetId.value });
    });

    this.inputs.renderMode.addEventListener("change", () => {
      onChange({ renderMode: this.inputs.renderMode.value });
    });

    this.attachRange("rotationX", onChange);
    this.attachRange("rotationY", onChange);
    this.attachRange("rotationZ", onChange);
    this.attachRange("zoom", onChange);
    this.attachRange("contourInterval", onChange);
    this.attachRange("pointSize", onChange);
    this.attachRange("pointDensity", onChange);

    this.resetButton.addEventListener("click", onReset);
    this.exportButton.addEventListener("click", onExport);
    this.clearHistoryButton.addEventListener("click", onClearHistory);

    this.uploadInput.addEventListener("change", () => {
      const [file] = this.uploadInput.files;
      if (file) {
        onUpload(file);
      }
      this.uploadInput.value = "";
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      this.uploadZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        if (eventName === "dragenter") {
          this.dragDepth += 1;
        }
        this.uploadZone.classList.add("is-dragging");
      });
    });

    this.uploadZone.addEventListener("dragleave", (event) => {
      event.preventDefault();
      this.dragDepth = Math.max(0, this.dragDepth - 1);
      if (this.dragDepth === 0) {
        this.uploadZone.classList.remove("is-dragging");
      }
    });

    this.uploadZone.addEventListener("drop", (event) => {
      event.preventDefault();
      this.dragDepth = 0;
      this.uploadZone.classList.remove("is-dragging");
      const [file] = event.dataTransfer.files;
      if (file) {
        onUpload(file);
      }
    });
  }

  attachRange(key, onChange) {
    this.inputs[key].addEventListener("input", () => {
      onChange({ [key]: Number(this.inputs[key].value) });
    });
  }

  sync(state) {
    Object.entries(this.inputs).forEach(([key, input]) => {
      input.value = state[key];
    });

    this.readouts.rotationX.textContent = `${state.rotationX}\u00B0`;
    this.readouts.rotationY.textContent = `${state.rotationY}\u00B0`;
    this.readouts.rotationZ.textContent = `${state.rotationZ}\u00B0`;
    this.readouts.zoom.textContent = `${state.zoom.toFixed(2)}x`;
    this.readouts.contourInterval.textContent = `${state.contourInterval}`;
    this.readouts.pointSize.textContent = `${state.pointSize.toFixed(1)} px`;
    this.readouts.pointDensity.textContent = `${state.pointDensity}x`;
  }

  setUploadStatus(message) {
    this.uploadStatus.textContent = message;
  }
}

export default Controls;
