export class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  add(vector) {
    return new Vector3(this.x + vector.x, this.y + vector.y, this.z + vector.z);
  }

  subtract(vector) {
    return new Vector3(this.x - vector.x, this.y - vector.y, this.z - vector.z);
  }

  scale(scalar) {
    return new Vector3(this.x * scalar, this.y * scalar, this.z * scalar);
  }

  dot(vector) {
    return this.x * vector.x + this.y * vector.y + this.z * vector.z;
  }

  cross(vector) {
    return new Vector3(
      this.y * vector.z - this.z * vector.y,
      this.z * vector.x - this.x * vector.z,
      this.x * vector.y - this.y * vector.x,
    );
  }

  magnitude() {
    return Math.hypot(this.x, this.y, this.z);
  }

  normalize() {
    const length = this.magnitude();
    return length === 0 ? new Vector3(0, 0, 0) : this.scale(1 / length);
  }

  clone() {
    return new Vector3(this.x, this.y, this.z);
  }

  static lerp(start, end, t) {
    return start.add(end.subtract(start).scale(t));
  }
}

export default Vector3;
