Do not assume anything, ask everything.

# UI/UX Rules

- Don't over use subtitles or explanation texts
- Don't over use margins, paddings or whitespaces
- Don't duplicate actions or content (for example, if the left panel has the action and list of items, don't duplicate them in the main content area). Including empty states. Don't duplicate actions there either.
- Don't do ellipsis "…" or "...". Use proper loading indicators or just don't. If you do something like "Loading" you must find another way.
- Don't add decoration or extra text where it is not needed
- Don't use tonal bands (a filled strip behind a header, footer or toolbar to separate it). Separate with elevation
- Build it like an app, not a website
- Tables or containers reach full height, they own the scroll, not the site
- Top appbar must always consider actions and items to be responsive. The same for the rest of the app
- Never use native html dropdowns or pickers, always use our components (shadcn ones, customized to our style)
- We use shadcn's tooltip, not the browser's title attribute
- There cannot be any em dash at all for any reason. If a UI requires one the UI is wrong.
- No border over border. Use surface colors and elevation to separate elements.
- Don't stack toolbars/rows. Find a way of combining/reusing existing elements.
- The top app bar is small: put the fewest buttons and items possible there.
- Never add "Load more" buttons. Never skip pagination. Use virtual + infinite scroll.

# Architecture rules

- We always see the big picture
- We always find the simplest way possible, and it must be simple when finished, not only in a first version
- We use providers and DI, we avoid global instances and singletons
- We use tailwind, not .css files
- If the design smells, even slightly, stop and ask
- Iterative operations driven from the client are forbidden. We use batch operations.
- Polling is the last resort, only for recovery cases
- Realtime uses SSE and request routing between server instances (docs/design.md, Server instances). No PG NOTIFY.
- Zero redundant or unnecessary database roundtrips. Batch whenever possible.
- No decisions that the owner didn't approve first
- Sessions are never linked to a specific organization
- The URL is the source of truth for navigation and the current org and fleet
- No sweeps. Use queues or other strategies, and ask first if those smell.
- Assume anything without a natural limit can grow without bound: cursor pagination everywhere
- `apps/web/src/core` is the app-agnostic UI library copied from Temblo. Nothing in it imports app code (lint rejects it). Start from apps/web/src/core/README.md for anything about core controls, scaffold, shell or resize.
- The product name lives in one place per side: `crates/fleet_brand` and `apps/web/src/brand.ts`. Never hardcode it elsewhere.
- The agent protocol never renames or removes a message, only adds optional fields, and ignores unknown messages (docs/design.md, Agent protocol).

# Work rules

- Only tests that matter. Tests of trivial things are worse than no tests.
- No hacks, hotfixes or workarounds. Fix it the correct way, at the core.
- If you start a process, stop it when you finish.
- Only commit what concerns your change. Never stage everything.
- No worktrees unless authorized.
- No code comments unless the code cannot be understood without them.
- For big features, verify everything needed: tests, end to end runs, experiments.

# Current project state

Development phase: no legacy support or backwards compatibility code. Ask what to do for breaking changes. SQL migrations may be added without asking; they will be consolidated later.
