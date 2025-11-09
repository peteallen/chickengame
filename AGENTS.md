# AGENTS

## Project Layout (updated November 8, 2025)
```
chickengame/
├── src/
│   ├── app/              # Pixi app creation + DOM bootstrap that hands control to the runtime
│   ├── assets/           # Importable sprite/audio/json manifests (static via Vite)
│   ├── config/           # Theme/environment knobs shared across features
│   ├── entities/         # Reusable renderable objects & constructors
│   ├── devtools/         # Developer-mode animation catalogs + entity adapters
│   ├── lib/              # Pure helpers (math, easing, random, etc.)
│   ├── scenes/           # Scene compositions that arrange entities into containers
│   ├── styles/           # Global CSS + layered partials bundled via index.css
│   ├── systems/          # Frame-by-frame gameplay systems (physics, scoring, AI)
│   ├── ui/               # HUD overlays, menus, modal controls separate from Pixi scenes
│   ├── runtime/          # GameRuntime abstraction (layer/system registration + lifecycle)
│   └── main.ts           # Entry that imports styles and boots the app
├── tests/                # Vitest/Playwright suites mirroring src structure
├── dist/                 # Build output from `vite build`
├── index.html            # Vite HTML entry (rarely touched)
├── package.json          # Scripts + dependencies
├── tsconfig.json         # TS compiler config
└── vite.config.ts        # Vite bundler config
```

## Folder Guidance
- `src/app/`
  - `pixiApp.ts` centralizes creation/init of the Pixi `Application` so global renderer flags stay consistent.
  - `bootstrap.ts` now only mounts the Pixi canvas, instantiates the runtime, and forwards ticker/resizer hooks; always return/await its destroy handler during tests.
- `src/runtime/`
  - `gameRuntime.ts` exposes `createGameRuntime` plus typed `registerLayer`/`registerSystem` APIs. Add new systems or overlays by registering them here so bootstrap stays untouched. Keep wiring side-effect free by passing configs/services in through the runtime context.
- `src/config/`
  - Co-locate constants (colors, ratios, difficulty knobs) so gameplay systems and UI share the same source of truth. Re-export from `index.ts` for ergonomic imports.
- `src/entities/`
  - Keep entities small and composable (e.g., `createGround`, `createHorizonLine`) that expose `{ view, draw|update }`. Assets that belong exclusively to an entity should sit beside it.
- `src/scenes/`
  - Scenes orchestrate entities into Pixi `Container`s (`createEnvironmentScene`). They expose `layout/update` hooks so systems can drive them without knowing internals.
- `src/systems/`
  - Reserve for logic that needs per-frame ticking (physics, collisions, scoring). Systems should consume scenes/entities via lightweight interfaces to stay testable.
- `src/ui/`
  - For DOM-based overlays or Pixi UI widgets. Keep styling with CSS Modules or colocated `.ts` when interacting with gameplay state.
- `src/ui/devWorkbench/`
  - Dev-only overlay that wires the animation catalog into a control panel; keep DOM/CSS for the workbench here so it stays sandboxed from production UI.
- `src/devtools/`
  - Houses the reusable animation clip/sequences catalog plus entity adapters so dev tooling (or tests) can instantiate entities and play clips without touching runtime systems.
- `src/styles/`
  - `index.css` aggregates modular partials (`base.css`, `layout.css`, etc.). Add new layers here instead of piling everything into one file.
- `src/assets/`
  - Place spritesheets, audio, JSON atlases, and manifest helpers. When adding new assets, export loader helpers so scenes can await them deterministically.
- `tests/`
  - Mirror the `src/` tree. Scene/system tests belong next to their feature folder with identical relative paths for easy discovery.

## Workflow Notes
1. Add new gameplay pieces by defining entities → scene wiring → system updates in that order.
2. Share constants via `src/config` to avoid magic numbers inside systems.
3. Action systems must go through `behaviorControls.takeover()` when pausing the chicken (locks, speed multipliers, follower toggles) and release their handle as soon as player control can resume; never poke `behaviorSystem`/`chickFollower` directly inside actions.
4. When adding folders not covered above, append a short description here so future agents stay aligned.
