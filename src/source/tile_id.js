import assert from 'assert';
import Coordinate from '../geo/coordinate.js';

export class CanonicalTileID {
  constructor(z, x, y) {
    assert(z >= 0 && z <= 25);
    assert(x >= 0 && x < 2 ** z);
    assert(y >= 0 && y < 2 ** z);
    this.z = z;
    this.x = x;
    this.y = y;
    this.key = calculateKey(0, z, x, y);
  }

  equals(id) {
    return this.z === id.z && this.x === id.x && this.y === id.y;
  }

  get cacheKey() {
    return this.key;
  }
}

export class UnwrappedTileID {
  constructor(wrap, canonical) {
    this.wrap = wrap;
    this.canonical = canonical;
    this.key = calculateKey(wrap, canonical.z, canonical.x, canonical.y);
  }
}

export class OverscaledTileID {
  constructor(overscaledZ, wrap, z, x, y) {
    assert(overscaledZ >= z);
    this.overscaledZ = overscaledZ;
    this.wrap = wrap;
    this.canonical = new CanonicalTileID(z, +x, +y);
    this.key = calculateKey(wrap, overscaledZ, x, y);
  }

  equals(id) {
    return this.overscaledZ === id.overscaledZ && this.wrap === id.wrap && this.canonical.equals(id.canonical);
  }

  scaledTo(targetZ) {
    assert(targetZ <= this.overscaledZ);
    const zDifference = this.canonical.z - targetZ;
    if (targetZ > this.canonical.z) {
      return new OverscaledTileID(targetZ, this.wrap, this.canonical.z, this.canonical.x, this.canonical.y);
    }
    return new OverscaledTileID(
      targetZ,
      this.wrap,
      targetZ,
      this.canonical.x >> zDifference,
      this.canonical.y >> zDifference
    );
  }

  isChildOf(parent) {
    const zDifference = this.canonical.z - parent.canonical.z;
    // We're first testing for z == 0, to avoid a 32 bit shift, which is undefined.
    return (
      parent.overscaledZ === 0 ||
      (parent.overscaledZ < this.overscaledZ &&
        parent.canonical.x === this.canonical.x >> zDifference &&
        parent.canonical.y === this.canonical.y >> zDifference)
    );
  }

  children(sourceMaxZoom) {
    if (this.overscaledZ >= sourceMaxZoom) {
      // return a single tile coord representing a an overscaled tile
      return [
        new OverscaledTileID(this.overscaledZ + 1, this.wrap, this.canonical.z, this.canonical.x, this.canonical.y)
      ];
    }

    const z = this.canonical.z + 1;
    const x = this.canonical.x * 2;
    const y = this.canonical.y * 2;
    return [
      new OverscaledTileID(z, this.wrap, z, x, y),
      new OverscaledTileID(z, this.wrap, z, x + 1, y),
      new OverscaledTileID(z, this.wrap, z, x, y + 1),
      new OverscaledTileID(z, this.wrap, z, x + 1, y + 1)
    ];
  }

  isLessThan(rhs) {
    if (this.wrap < rhs.wrap) return true;
    if (this.wrap > rhs.wrap) return false;

    if (this.overscaledZ < rhs.overscaledZ) return true;
    if (this.overscaledZ > rhs.overscaledZ) return false;

    if (this.canonical.x < rhs.canonical.x) return true;
    if (this.canonical.x > rhs.canonical.x) return false;

    if (this.canonical.y < rhs.canonical.y) return true;
    return false;
  }

  get cacheKey() {
    return calculateKey(this.wrap, this.overscaledZ, this.canonical.x, this.canonical.y);
  }

  wrapped() {
    return new OverscaledTileID(this.overscaledZ, 0, this.canonical.z, this.canonical.x, this.canonical.y);
  }

  unwrapTo(wrap) {
    return new OverscaledTileID(this.overscaledZ, wrap, this.canonical.z, this.canonical.x, this.canonical.y);
  }

  overscaleFactor() {
    return 2 ** (this.overscaledZ - this.canonical.z);
  }

  toUnwrapped() {
    return new UnwrappedTileID(this.wrap, this.canonical);
  }

  toString() {
    return `${this.overscaledZ}/${this.canonical.x}/${this.canonical.y}`;
  }

  toCoordinate() {
    return new Coordinate(this.canonical.x + 2 ** this.wrap, this.canonical.y, this.canonical.z);
  }
}

export function calculateKey(wrap, z, x, y) {
  wrap *= 2;
  if (wrap < 0) wrap = wrap * -1 - 1;
  const dim = 1 << z;
  return (dim * dim * wrap + dim * y + x) * 32 + z;
}
