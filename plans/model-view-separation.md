# Simulation Model & View Separation Plan

## Goal
Decouple gameplay state from Pixi containers by introducing lightweight simulation models that systems mutate, while entities consume models to render poses.

## Background
Current systems directly mutate Pixi `Container` positions (`src/systems/chickenBehaviorSystem.ts`, `src/systems/chickFollowerSystem.ts`). This tight coupling makes logic hard to unit test and complicates future gameplay (multi-actors, networking). A model layer enables deterministic simulations, headless testing, and potential ECS patterns.

## Deliverables
1. `src/models/` directory with TypeScript interfaces/classes for core actors (chicken, chicks, environment pen, actions).
2. Adapters linking models to renderable entities (e.g., `createChickenRenderer(model)`).
3. Refactored systems to operate on models (positions, velocities, state machines) rather than Pixi containers.
4. Migration plan for existing entity APIs to accept models (pose setters, facing) without breaking animations.

## Implementation Steps
1. **Define models**
   - ChickenModel: `{ position, velocity, pose, facing, targetState }`.
   - ChickModel, FollowerModel, PenModel, ActionState, etc.
   - Provide utility math functions (vectors, clamping) in `src/lib/math` to avoid ad hoc helpers everywhere.
2. **Renderer layer**
   - Create renderer factories that subscribe to model changes (could be simple `applyModelToView(model, view)` for now).
   - Ensure renderers remain responsible for Pixi-specific code (textures, graphics, layers).
3. **System refactor**
   - Behavior system updates ChickenModel only; a separate `ChickenRenderer` syncs view each frame (phase `animation`).
   - Follower system uses models for interpolation and passes results to `ChickRenderer`.
4. **API adjustments**
   - Entities like `createChicken` should expose `model` reference or accept a model in constructor.
   - Provide migration shims so existing code compiles (e.g., `chicken.view` still available but fed via renderer).
5. **Testing**
   - Add unit tests for model logic (movement, clamping) without Pixi.
   - Validate renderer sync by checking Pixi containers after applying known model states (can use JSDOM).

## Validation
- Smoke test in browser to ensure visuals match previous behavior.
- `npm run test` with new model tests.

## Notes
- Keep models serializable to enable future persistence/debug tooling.
- Consider hooking models into dev workbench so inspectors can tweak positions/facing live.
