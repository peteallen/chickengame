import { describe, expect, it } from 'vitest';
import { Container } from 'pixi.js';
import {
  clampPointToPen,
  createPenBounds,
  type PenBounds,
} from '../../src/lib/geometry/penBounds';
import {
  createPenConstraintSystem,
  type Constrainable,
} from '../../src/systems/penConstraintSystem';

const createBounds = (): PenBounds =>
  createPenBounds({
    frontLeft: { x: 0, y: 10 },
    frontRight: { x: 10, y: 10 },
    backRight: { x: 8, y: 0 },
    backLeft: { x: 2, y: 0 },
  });

const createSystem = (bounds: PenBounds = createBounds()) =>
  createPenConstraintSystem({
    getPenBounds: () => bounds,
    defaultBehavior: 'clamp',
    bounceDamping: 0.6,
    clampVelocityMultiplier: 0,
  });

const createEntry = (): Constrainable => ({
  target: new Container(),
});

describe('penConstraintSystem', () => {
  it('clamps constrained objects that leave the pen', () => {
    const bounds = createBounds();
    const system = createSystem(bounds);
    const entry = createEntry();
    entry.target.position.set(40, 40);
    const before = { x: entry.target.position.x, y: entry.target.position.y };

    system.register(entry);
    system.update(16);

    const expected = clampPointToPen(before, bounds);
    expect(entry.target.position.x).toBeCloseTo(expected.x, 4);
    expect(entry.target.position.y).toBeCloseTo(expected.y, 4);
  });

  it('reflects velocity when bouncing', () => {
    const bounds = createBounds();
    const system = createSystem(bounds);
    const entry = createEntry();
    const velocity = { x: 5, y: 0 };
    entry.target.position.set(12, 8);
    system.register({ ...entry, behavior: 'bounce', velocity });

    system.update(16);

    expect(velocity.x).toBeLessThan(0);
  });

  it('leaves objects with mode "none" untouched', () => {
    const bounds = createBounds();
    const system = createSystem(bounds);
    const entry = createEntry();
    entry.target.position.set(30, -30);

    system.register({ ...entry, mode: 'none' });
    system.update(16);

    expect(entry.target.position.x).toBe(30);
    expect(entry.target.position.y).toBe(-30);
  });
});
