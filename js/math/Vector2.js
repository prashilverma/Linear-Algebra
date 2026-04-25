export class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  add(vector) {
    return new Vector2(this.x + vector.x, this.y + vector.y);
  }

  subtract(vector) {
    return new Vector2(this.x - vector.x, this.y - vector.y);
  }

  scale(scalar) {
    return new Vector2(this.x * scalar, this.y * scalar);
  }

  dot(vector) {
    return this.x * vector.x + this.y * vector.y;
  }

  magnitude() {
    return Math.hypot(this.x, this.y);
  }

  normalize() {
    const length = this.magnitude();
    return length === 0 ? new Vector2(0, 0) : this.scale(1 / length);
  }

  clone() {
    return new Vector2(this.x, this.y);
  }

  static lerp(start, end, t) {
    return start.add(end.subtract(start).scale(t));
  }
}

export default Vector2;
