import { Vector3 } from "./Vector3.js";

export class Matrix3 {
  constructor(values = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ]) {
    this.values = values.map((row) => [...row]);
  }

  /**
   * Matrix multiplication uses the convention:
   * (this matrix) x (other matrix)
   * which means the right-most matrix is applied first to a column vector.
   */
  multiplyMatrix(other) {
    const result = Array.from({ length: 3 }, () => [0, 0, 0]);

    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        let sum = 0;

        for (let index = 0; index < 3; index += 1) {
          sum += this.values[row][index] * other.values[index][column];
        }

        result[row][column] = sum;
      }
    }

    return new Matrix3(result);
  }

  /**
   * The vector is treated as a 3x1 column vector:
   * [x, y, z]^T
   */
  multiplyVector(vector) {
    const [r0, r1, r2] = this.values;

    return new Vector3(
      r0[0] * vector.x + r0[1] * vector.y + r0[2] * vector.z,
      r1[0] * vector.x + r1[1] * vector.y + r1[2] * vector.z,
      r2[0] * vector.x + r2[1] * vector.y + r2[2] * vector.z,
    );
  }

  transpose() {
    const transposed = Array.from({ length: 3 }, (_, row) =>
      Array.from({ length: 3 }, (_, column) => this.values[column][row]),
    );

    return new Matrix3(transposed);
  }

  clone() {
    return new Matrix3(this.values);
  }

  static compose(...matrices) {
    return matrices.reduce((accumulator, matrix) => accumulator.multiplyMatrix(matrix), Matrix3.identity());
  }

  static identity() {
    return new Matrix3([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
  }

  static rotationX(angleRadians) {
    const cosine = Math.cos(angleRadians);
    const sine = Math.sin(angleRadians);

    return new Matrix3([
      [1, 0, 0],
      [0, cosine, -sine],
      [0, sine, cosine],
    ]);
  }

  static rotationY(angleRadians) {
    const cosine = Math.cos(angleRadians);
    const sine = Math.sin(angleRadians);

    return new Matrix3([
      [cosine, 0, sine],
      [0, 1, 0],
      [-sine, 0, cosine],
    ]);
  }

  static rotationZ(angleRadians) {
    const cosine = Math.cos(angleRadians);
    const sine = Math.sin(angleRadians);

    return new Matrix3([
      [cosine, -sine, 0],
      [sine, cosine, 0],
      [0, 0, 1],
    ]);
  }

  /**
   * Orthographic projection keeps x and y while flattening depth.
   * The final conversion to Vector2 happens in Projection.js.
   */
  static orthographic() {
    return new Matrix3([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 0],
    ]);
  }
}

export default Matrix3;
