# Action Pipeline Refactor Plan

## Goal
Create a reusable action pipeline/timeline framework so chicken actions (balloon lift, disco party, lay egg, jetpack, fireworks) share infrastructure for sequencing, easing, resource lifetimes, and behavior overrides.

## Background
Each file in `src/systems/chickenActions/` duplicates logic for:
- acquiring behavior control handles
- adjusting depth, overlays, and pen constraints
- managing tweens/easing, delays, and cleanup
- spawning/destroying temporary entities
This duplication raises bug risk and slows development of new actions.

## Deliverables
1. `src/systems/actions/actionPipeline.ts`: core timeline builder supporting keyframes, easing functions, parallel/serial blocks, and automatic cleanup hooks.
2. Utility modules for common concerns: `ActionResources` (depth registrations, overlay layers), `ActionTimeline` (tween DSL), `ActionGuards` (ensure follower/behavior state restored).
3. Refactored existing actions to use the pipeline, drastically reducing imperative code per action.

## Implementation Steps
1. **Pipeline primitives**
   - Define `ActionStep` types (tween, wait, call, loop) and `Timeline` executor that runs via `update(deltaMS)`.
   - Provide easing helpers and auto-normalized progress values.
2. **Resource manager**
   - Encapsulate repeated setup (e.g., spawn balloon bundle, attach to pen layer) inside resource objects with `dispose()` called automatically when action exits or timeline aborts.
   - Optionally integrate with the runtime’s dependency injection for overlays/audio.
3. **Behavior control guard**
   - Wrap `behaviorControls.takeover()` so actions declare desired state (e.g., lock to `idle`, disable follower) and the guard ensures release even on early exit.
4. **Refactor actions**
   - Start with one (e.g., `discoPartyAction`) to validate API; once stable, port the rest.
   - Express animations as combinations of timeline steps rather than manual `if/else` by elapsed time.
5. **Extensibility**
   - Document how to add new steps (particle spawners, audio cues).
   - Provide TypeScript generics so actions can type their context needs.

## Testing / Validation
- Unit tests for `ActionTimeline` covering sequencing, easing, interruption, and cleanup invocation order.
- Snapshot or integration tests verifying an action resets state when canceled mid-run (can mock chicken pose setters).
- Manual QA: ensure all actions still play correctly.

## Notes
- Keep actions data-driven where possible; consider JSON-friendly descriptors for future content tooling.
- Ensure timeline update cost stays low (bounded allocations) to avoid GC spikes.
