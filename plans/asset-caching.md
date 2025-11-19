# Asset & Geometry Caching Plan

## Goal
Reduce runtime allocations and draw cost by introducing reusable asset caches, geometry factories, and render-texture pools shared across entities and actions.

## Background
Entities like `grassField`, `balloonBundle`, and action effects rebuild complex `Graphics` paths and noise textures every time they spawn. Actions frequently create/destroy Pixi containers (hearts, sparks) without pooling, causing GC spikes. A caching layer will stabilize performance and make future content cheaper to author.

## Deliverables
1. `src/runtime/assets/assetCache.ts` providing lookup/retain/release semantics for reusable `Graphics`, `Texture`, and `Container` templates.
2. Render-texture pool for patterned fills (e.g., grass texture) to avoid recreating `Texture` objects per layout.
3. Particle/prop pools for common action effects (balloon sprites, hearts, spark particles).
4. Updated entities/actions to request assets via the cache/pool.

## Implementation Steps
1. **Asset cache API**
   - Keyed by descriptor (e.g., `{ type: 'texture', id: 'grass-noise', seed }`).
   - Supports reference counting or explicit release to prevent leaks.
2. **Render texture pool**
   - Build `createNoiseTexture(theme)` once per session; share across grass instances.
   - Provide `getTexture(id, factory)` helper.
3. **Reusable graphics templates**
   - Prebuild shapes (balloon body, fence post, disco beam) and clone via `clone()`/`copyFrom` when needed.
   - Document how to update colors if theme changes.
4. **Particle system refactor**
   - Implement a simple pool for Graphics-based particles (hearts, sparks). Acquire from pool, reset properties, return on fade-out.
5. **Integration**
   - Audit `src/entities` and `src/systems/chickenActions` to replace ad hoc creations with cached versions.
   - Ensure caches cleared on runtime destroy to prevent memory leaks.

## Testing / Validation
- Profiling: compare allocations before/after when triggering actions repeatedly.
- Add unit tests verifying cache returns same instance until released.
- Manual QA to ensure visuals unchanged.

## Notes
- Keep API theme-aware; caches should rebuild if theme colors change (future customization).
- Consider exposing metrics (hit/miss counts) in dev workbench for tuning.
