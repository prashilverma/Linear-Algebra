import { Matrix3 } from "../math/Matrix3.js";
import { Vector2 } from "../math/Vector2.js";

export class Projection {
  static orthographicMatrix = Matrix3.orthographic();

  static projectPoint(point) {
    const flattened = Projection.orthographicMatrix.multiplyVector(point);
    return new Vector2(flattened.x, flattened.y);
  }

  static projectPoints(points) {
    return points.map((point) => Projection.projectPoint(point));
  }
}

export default Projection;
