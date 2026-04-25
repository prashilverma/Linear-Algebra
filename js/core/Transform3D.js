import { Matrix3 } from "../math/Matrix3.js";

export class Transform3D {
  static degreesToRadians(degrees) {
    return (degrees * Math.PI) / 180;
  }

  /**
   * We compose rotations as R = Rz * Ry * Rx.
   * Because vectors are column vectors, Rx is applied first,
   * then Ry, then Rz. This makes the rotation order explicit and teachable.
   */
  static createRotationMatrix({ x = 0, y = 0, z = 0 }) {
    const rotationX = Matrix3.rotationX(Transform3D.degreesToRadians(x));
    const rotationY = Matrix3.rotationY(Transform3D.degreesToRadians(y));
    const rotationZ = Matrix3.rotationZ(Transform3D.degreesToRadians(z));

    return Matrix3.compose(rotationZ, rotationY, rotationX);
  }

  static transformPoint(point, matrix) {
    return matrix.multiplyVector(point);
  }

  static transformPoints(points, matrix) {
    return points.map((point) => Transform3D.transformPoint(point, matrix));
  }
}

export default Transform3D;
