# Testing & Deterministic Randomness Plan

## Goal
Expand automated coverage and ensure deterministic simulations by introducing a seeded random service plus new tests for systems, actions, and runtime infrastructure.

## Background
Currently only `penConstraintSystem` has tests (`tests/systems/penConstraintSystem.test.ts`). Most logic relies on `Math.random()` and Pixi containers, making behavior hard to verify. A structured testing strategy will boost confidence and prevent regressions as the architecture evolves.

## Deliverables
1. `src/lib/random/randomSource.ts` exposing interfaces for seeded RNGs (`RandomSource`, `createSeededRandom(seed)`), plus adapters for Math.random fallback.
2. Refactored systems/actions to accept a `RandomSource` from context rather than calling `Math.random()` directly.
3. New test suites:
   - `tests/runtime/systemScheduler.test.ts` (ties into scheduler plan).
   - `tests/systems/chickenBehaviorSystem.test.ts` (state transitions with seeded RNG).
   - `tests/systems/chickenActions/*.test.ts` using timeline mocks to ensure entry/update/exit behavior.
   - Snapshot/unit tests for model math once model/view separation lands.
4. Test utilities for mocking Pixi containers or renderers where necessary.

## Implementation Steps
1. **Random service**
   - Implement XORShift or mulberry32 RNG; expose deterministic sequences.
   - Thread `RandomSource` through runtime context, behavior system, follower manager, actions, etc.
2. **Testing harness**
   - Configure Vitest to run DOM-related tests with `happy-dom` if needed.
   - Create helpers for advancing fake tick deltas, asserting pose changes.
3. **Add coverage**
   - Behavior system: verify state durations, walk target selection, speed multipliers when locked.
   - Action timeline: ensure cleanup runs even if action aborted early.
   - Dev workbench: minimal tests around entity selection logic (optional).
4. **CI considerations**
   - Update `package.json` scripts if additional setup required (e.g., `vitest --runInBand`).
   - Document how to run targeted suites in `AGENTS.md`.

## Validation
- `npm run test` should include new suites with deterministic outputs.
- Manual spot-check to ensure runtime randomness still “feels” organic when seeded (can randomize seed per session but still reproducible when forced).

## Notes
- Provide a way to set seed via query param/env for debugging reproductions.
- Tests should avoid reliance on Pixi internals when possible by mocking container APIs (position, scale).
