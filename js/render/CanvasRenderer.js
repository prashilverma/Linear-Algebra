import { ColorMapper } from "../core/ColorMapper.js";

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.viewport = { width: 0, height: 0 };
    this.devicePixelRatio = window.devicePixelRatio || 1;
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    const dpr = window.devicePixelRatio || 1;

    if (this.canvas.width !== width * dpr || this.canvas.height !== height * dpr) {
      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
    }

    this.devicePixelRatio = dpr;
    this.viewport = { width, height };
  }

  render(scene) {
    this.resize();

    const { context } = this;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    context.setTransform(this.devicePixelRatio, 0, 0, this.devicePixelRatio, 0, 0);

    this.drawBackdrop();

    const bounds = this.computeProjectedBounds(scene);
    const toScreen = this.createScreenMapper(bounds, scene.state.zoom);

    if (scene.state.renderMode !== "contours") {
      this.drawPoints(scene, toScreen);
    }

    if (scene.state.renderMode !== "heatmap") {
      this.drawContours(scene, toScreen);
    }

    this.drawAxisGuide(scene.axes);
  }

  drawBackdrop() {
    const { context } = this;
    const { width, height } = this.viewport;

    const wash = context.createLinearGradient(0, 0, width, height);
    wash.addColorStop(0, "rgba(6, 12, 20, 0.24)");
    wash.addColorStop(0.5, "rgba(7, 15, 24, 0.06)");
    wash.addColorStop(1, "rgba(4, 8, 14, 0.28)");
    context.fillStyle = wash;
    context.fillRect(0, 0, width, height);

    context.save();
    context.lineWidth = 1;
    context.strokeStyle = "rgba(255, 255, 255, 0.04)";

    for (let x = 0; x <= width; x += 74) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }

    for (let y = 0; y <= height; y += 74) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    context.restore();

    const glow = context.createRadialGradient(width * 0.5, height * 0.45, 20, width * 0.5, height * 0.45, width * 0.36);
    glow.addColorStop(0, "rgba(236, 220, 184, 0.08)");
    glow.addColorStop(1, "rgba(236, 220, 184, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
  }

  computeProjectedBounds(scene) {
    const coordinates = [];

    scene.points.forEach((point) => {
      coordinates.push(point.projected);
    });

    scene.contours.forEach((line) => {
      line.segments.forEach((segment) => {
        coordinates.push(segment.start);
        coordinates.push(segment.end);
      });
    });

    if (coordinates.length === 0) {
      return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
    }

    return coordinates.reduce(
      (accumulator, point) => ({
        minX: Math.min(accumulator.minX, point.x),
        maxX: Math.max(accumulator.maxX, point.x),
        minY: Math.min(accumulator.minY, point.y),
        maxY: Math.max(accumulator.maxY, point.y),
      }),
      {
        minX: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
      },
    );
  }

  /**
   * After projection we still operate in mathematical coordinates.
   * This mapper performs the final affine step into canvas pixels:
   * 1. center the projected bounding box,
   * 2. fit it to the viewport,
   * 3. invert the y-axis because canvas grows downward.
   */
  createScreenMapper(bounds, zoom) {
    const projectedWidth = Math.max(1, bounds.maxX - bounds.minX);
    const projectedHeight = Math.max(1, bounds.maxY - bounds.minY);
    const paddingX = Math.min(160, this.viewport.width * 0.15);
    const paddingY = Math.min(132, this.viewport.height * 0.16);
    const fitScale = Math.max(
      0.1,
      Math.min(
        (this.viewport.width - paddingX * 2) / projectedWidth,
        (this.viewport.height - paddingY * 2) / projectedHeight,
      ),
    );
    const appliedScale = fitScale * zoom;
    const centerX = (bounds.minX + bounds.maxX) * 0.5;
    const centerY = (bounds.minY + bounds.maxY) * 0.5;
    const screenCenterX = this.viewport.width * 0.5;
    const screenCenterY = this.viewport.height * 0.5;

    return (point) => ({
      x: screenCenterX + (point.x - centerX) * appliedScale,
      y: screenCenterY - (point.y - centerY) * appliedScale,
    });
  }

  drawPoints(scene, toScreen) {
    const { context } = this;
    const densityStride = Math.max(1, Math.round(scene.state.pointDensity));
    const radius = scene.state.pointSize;

    context.save();
    context.globalAlpha = scene.state.renderMode === "combined" ? 0.9 : 0.98;

    for (let index = 0; index < scene.points.length; index += densityStride) {
      const point = scene.points[index];
      const screen = toScreen(point.projected);

      context.beginPath();
      context.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
      context.fillStyle = ColorMapper.colorForElevation(
        point.original.z,
        scene.elevationRange.min,
        scene.elevationRange.max,
      );
      context.fill();
    }

    context.restore();
  }

  drawContours(scene, toScreen) {
    const { context } = this;

    context.save();
    context.lineJoin = "round";
    context.lineCap = "round";

    scene.contours.forEach((line) => {
      context.beginPath();
      context.strokeStyle = line.major ? "rgba(249, 243, 230, 0.88)" : "rgba(219, 229, 235, 0.52)";
      context.lineWidth = line.major ? 1.55 : 0.95;

      line.segments.forEach((segment) => {
        const start = toScreen(segment.start);
        const end = toScreen(segment.end);
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
      });

      context.stroke();
    });

    context.restore();
  }

  drawAxisGuide(axes) {
    const { context } = this;
    const origin = {
      x: this.viewport.width * 0.5,
      y: this.viewport.height - 82,
    };
    const radius = 42;

    context.save();
    context.fillStyle = "rgba(7, 12, 19, 0.34)";
    context.strokeStyle = "rgba(255, 255, 255, 0.12)";
    context.lineWidth = 1;
    context.beginPath();
    context.arc(origin.x, origin.y, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    axes.forEach((axis) => {
      const endX = origin.x + axis.vector.x * 30;
      const endY = origin.y - axis.vector.y * 30;

      context.beginPath();
      context.moveTo(origin.x, origin.y);
      context.lineTo(endX, endY);
      context.strokeStyle = axis.color;
      context.lineWidth = 2;
      context.stroke();

      context.fillStyle = axis.color;
      context.font = "12px Aptos, Segoe UI, sans-serif";
      context.fillText(axis.label, endX + 5, endY - 5);
    });

    context.restore();
  }
}

export default CanvasRenderer;
