# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server with HMR
npm run build        # Production build to dist/
npm run typecheck    # Run TypeScript type checking (tsc --noEmit)
npm run test         # Run all tests with Vitest
npx vitest run tests/path/to/file.test.ts  # Run a single test file
```

## Architecture

This is a Pixi.js 8 game rendered on a Vite-served canvas. The architecture uses a runtime/layer/system pattern:

### Runtime (`src/runtime/gameRuntime.ts`)
The `GameRuntime` is the central coordinator. It manages:
- **Layers**: Pixi Containers with `init/layout/update/destroy` lifecycle hooks, registered via `registerLayer()`
- **Systems**: Frame-by-frame logic with priority ordering, registered via `registerSystem()`
- **Services**: Cross-cutting helpers (audio, viewport, pen bounds, spatial queries) injected through `RuntimeServices`

Systems are updated each frame in priority order (lower = earlier). The runtime wires up the environment scene, chicken entity, animators, behavior system, action system, and dev tooling.

### Action System Pattern
Chicken actions (balloon lift, disco party, jetpack, race car, etc.) follow a definition pattern:
- `createXAction()` returns a `ChickenActionDefinition` with `id`, `create()`, and optional `isAvailable()`
- `create()` receives an `ActionContext` and returns an instance with `durationMS`, `onEnter()`, `onUpdate()`, `onExit()`

**Critical**: Actions must use `behaviorControls.takeover()` to pause the chicken's behavior system, locking state/speed/animators. Always call `handle.release()` in `onExit()` to restore player control.

### Services
Services in `src/runtime/services/` provide shared state:
- `layerService`: Manages Pixi stage layers by name (environment, overlay, dev)
- `viewportService`: Tracks viewport size/metrics, emits resize events
- `penBoundsService`: Calculates the chicken's movement area from the environment scene
- `spatialQueryService`: Geometry helpers for positions/bounds queries
- `audioService`: Sound effect playback

### Entities vs Scenes
- **Entities** (`src/entities/`): Composable renderable objects exposing `{ view, draw|update }`. Example: `createChicken()`, `createGround()`
- **Scenes** (`src/scenes/`): Arrange entities into Pixi Containers with `layout/update` hooks. The `environmentScene` orchestrates the farm background.

## Testing

Tests use Vitest and mirror the `src/` structure under `tests/`. When testing Pixi-dependent code, mock `pixi.js` with lightweight stubs (see `tests/systems/chickenActions/raceCarAction.test.ts` for the pattern).

## Key Conventions

- Share constants via `src/config/` to avoid magic numbers
- New gameplay pieces: entities → scene wiring → system updates (in that order)
- Keep systems testable by consuming scenes/entities via interfaces
- Actions go through `behaviorControls.takeover()` when pausing the chicken; never modify `behaviorSystem` or `chickFollower` directly from actions
