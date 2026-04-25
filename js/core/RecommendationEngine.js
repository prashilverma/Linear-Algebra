export class RecommendationEngine {
  getRecommendation({ state, dataset }) {
    if (dataset.sourceType === "upload") {
      return {
        title: "Uploaded Geometry Normalized",
        body: "Your file was centered at the origin and uniformly scaled from its bounding box so it behaves like the native demo datasets before manual zoom is applied.",
        hints: [
          "Uploaded OBJ and CSV files are converted directly into custom Vector3 instances before entering the rotation and orthographic projection pipeline.",
          "This upload path renders as a point-based heatmap. Contour isolines still require a regular scalar grid rather than an arbitrary point cloud.",
        ],
      };
    }

    const hints = [
      "Matrix order stays fixed as R = Rz * Ry * Rx, so the X rotation happens first even though it is written last in the product.",
      "Orthographic projection removes depth scaling, which makes contour spacing mathematically readable instead of perspective-distorted.",
    ];

    if (dataset.id === "terrain" && Math.abs(state.rotationY) < 12) {
      return {
        title: "Expose Ridge Compression",
        body: "Try rotating around the Y-axis to see how lateral folds compress and expand while elevation coloring remains tied to the original z-values.",
        hints,
      };
    }

    if (dataset.id === "cylinder" && state.rotationX < 35) {
      return {
        title: "Reveal The Vessel Rim",
        body: "Increase the X rotation to open the mug-like cavity and make the concentric contour rings read more like a technical section study.",
        hints,
      };
    }

    if (state.renderMode === "heatmap") {
      return {
        title: "Pair Scalar Color With Geometry",
        body: "Switch to Combined mode to compare dense elevation coloring against explicit isolines generated from the same scalar field.",
        hints,
      };
    }

    if (state.contourInterval > 18) {
      return {
        title: "Increase Contour Fidelity",
        body: "A smaller contour interval creates more isolines, which is helpful when you want subtle changes in terrain slope to become visually legible.",
        hints,
      };
    }

    return {
      title: "Compare Rotation Orders Mentally",
      body: "With the current angles, notice how one composed matrix controls the whole scene. Changing any single angle updates the full basis before projection.",
      hints,
    };
  }
}

export default RecommendationEngine;
