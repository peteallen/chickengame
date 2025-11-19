# System Scheduler Plan

## Goal
Introduce a formal scheduler that orders frame updates by phase and priority instead of the hard-coded `handleTick` chain in `src/app/bootstrap.ts:178-190`.

## Background
As features grew, update order became a manual list. New systems must touch `bootstrap` and reason about implicit dependencies. A scheduler allows systems to self-describe their needs (phase, priority, optional fixed timestep) and be registered dynamically.

## Deliverables
1. `src/runtime/systemScheduler.ts` (or similar) exporting `createSystemScheduler`.
2. System interface with `{ id, phase, priority, update(deltaMS), fixedStep? }` plus optional `destroy`.
3. Migration of existing systems (environment scene, pen constraints, animators, behavior, actions, follower, overlays, dev workbench) to register with the scheduler.
4. Tests covering phase ordering and fixed-step accumulation.

## Implementation Steps
1. **Define phases**
   - Suggested enum/order: `setup`, `prePhysics`, `physics`, `postPhysics`, `animation`, `postAnimation`, `render`, `ui`.
   - Allow custom phases for future additions.
2. **Implement scheduler**
   - Track systems per phase sorted by `priority` (higher runs later or earlier—document choice).
   - Support optional fixed timestep (e.g., 16ms) with accumulator to maintain deterministic physics.
   - Provide `register`, `unregister`, `clear`, `update`, `destroy` methods.
3. **Refactor existing systems**
   - Wrap environment scene update in a system (phase `render`, low priority).
   - Pen constraints -> `physics`.
   - Animators -> `animation`.
   - Behavior/action systems -> `postPhysics`/`logic`.
   - Chick follower/disco rig/dev workbench -> `effects`/`ui`.
4. **Integrate with runtime**
   - Replace manual ticker call with `scheduler.update(deltaMS)`.
   - Expose scheduler through runtime context so new systems can self-register.
5. **Testing**
   - Add unit tests in `tests/runtime/systemScheduler.test.ts` ensuring order, fixed-step invocation counts, and unregister behavior.

## Validation
- `npm run test` should pass and include new scheduler tests.
- Manual playtest to ensure systems still behave (chicken walks, actions run, dev workbench updates).

## Notes
- Consider metrics/logging hooks (e.g., `onSystemError`) to guard against runtime exceptions.
- Keep scheduler free of Pixi references so it can run headless.
