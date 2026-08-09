# Copilot instructions — budgProjection

Purpose
- Small collection of static web apps (BudgProjection, ShelfStack, Trends). Each app is a plain HTML + vanilla JavaScript application using minimal build tooling (none).

Build, test, and lint commands
- No build, test, or lint tooling present in the repository.
- Run locally with a static file server. Examples:
  - Python: `python3 -m http.server 8000` (from repo root). Open `http://localhost:8000/BudgProjection/index.html` (or `/ShelfStack`, `/Trends`).
  - Node: `npx http-server -p 8000` (if you prefer Node-based server).
- There are no automated tests. No single-test command exists.

High-level architecture (big picture)
- Top-level layout: three small apps in parallel directories:
  - BudgProjection/
  - ShelfStack/
  - Trends/
- Each app is an SPA-like structure implemented with plain DOM manipulation and modules organized under `js/`.
- Common file responsibilities:
  - index.html — entry HTML with script tags that load the page’s JS in a specific order.
  - js/supabase-client.js — encapsulates Supabase client initialization and helpers (used for auth/DB calls).
  - js/auth.js — auth flows and hooks into supabase-client.
  - js/app-state.js — central in-memory state for the app; components and services read/write this.
  - js/services/* — domain logic (transaction-service.js, media-service.js, etc.). Keep business logic here.
  - js/components/* (ShelfStack) — reusable DOM components and UI managers (modal-manager, autocomplete, media-renderer).
  - toast.js, toolbar.js — small UI utilities used across pages.
- CSS is shared at repository root under `css/` and referenced by each app.

Key conventions and patterns (repository-specific)
- Directory conventions: put domain logic in `js/services/`; UI helpers in `js/components/` or root-level `js/*.js` if app-specific.
- Script ordering matters: supabase-client and app-state must be loaded before services and main app logic. When adding scripts to index.html, preserve intended load order.
- App state: `js/app-state.js` is the single source of runtime state for each app. Prefer updating state via the existing setters/publishers rather than directly mutating deep internal structures.
- Supabase usage: there are multiple copies of `supabase-client.js` (one per app). Any change to the supabase API surface should be applied consistently across apps.
- DOM-centric code: these apps do manual DOM queries and event wiring (no framework). Keep changes localized; when refactoring, update all usages.
- Naming: `main.js` or `app.js` is the app bootstrap; `services/*` implement data access and business rules.
- Minimal dependencies: the repo expects no package manager. If adding dependencies, document and include a package manager manifest (`package.json`) and update README.

Files checked for existing AI-agent configs
- Searched for CLAUDE.md, .cursorrules, AGENTS.md, .windsurfrules, CONVENTIONS.md — none found to incorporate.

Guidance for Copilot sessions
- Focus on small, surgical changes; preserve script load order and the supabase-client contract.
- When proposing refactors that affect multiple apps, include a cross-app migration plan (update each supabase-client copy, update index.html script order, run manual smoke tests in browser).
- For UI changes, open the relevant index.html in a browser while iterating; live reload is not provided here but a static server makes iterations fast.
- Never perform git commits or push changes to the remote repository without explicit, documented approval from the repository owner. For any change that modifies tracked files, present a clear diff and await approval before staging/committing/pushing.

Where to start when exploring
- Open `BudgProjection/index.html` and its `js/` folder for the budgeting app flow.
- Open `ShelfStack/js/components/` to inspect patterns for reusable UI components.

If you plan to add tests or a build system
- Add a README section describing the chosen toolchain and include a minimal `package.json`. Running `npx http-server` or `python -m http.server` should remain supported for manual testing.

Notes
- This file is intended to help future Copilot sessions make repository-specific suggestions and edits. Keep it updated if structure changes.
