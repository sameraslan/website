# ui-check

A small Playwright harness for screenshotting pages served by the local dev
server, and for evaluating JavaScript against a rendered page. Used by later
tasks in the website improvement pass to check UI changes without a human
opening a browser each time.

Not a test file: it is plain ESM (`.mjs`), has no assertions, and is never
picked up by `npm test` (Vitest only matches `*.test.*` / `*.spec.*`).

## Prerequisites

- Node 20 (the repo's default Node may be older; if so run scripts with
  `export PATH=$HOME/.nvm/versions/node/v20.20.2/bin:$PATH && ...`).
- The dev server running on `http://localhost:3111` (`npx next dev -p 3111`).
- Playwright's bundled Chromium installed (`npx playwright install chromium`).

## Usage

Screenshot mode:

```
node scripts/ui-check/shot.mjs <path> <name> [--mobile] [--wait ms]
```

- `<path>` is the route to load, appended to `http://localhost:3111`
  (e.g. `/`, `/work/projects/recmyrecord`).
- `<name>` is the base filename for the screenshot.
- `--mobile` uses a 375x812 viewport with `isMobile: true, hasTouch: true`
  (otherwise 1440x900 desktop).
- `--wait ms` overrides the default 2500ms settle time after navigation
  (useful for animations or async content).

Writes a full-page PNG to `scripts/ui-check/out/<name>-desktop.png` or
`scripts/ui-check/out/<name>-mobile.png`, and prints only that path to
stdout.

Eval mode:

```
node scripts/ui-check/shot.mjs <path> <name> --eval "<js>" [--mobile] [--wait ms]
```

Navigates the same way, then runs `<js>` via `page.evaluate` and prints
`JSON.stringify(result)` as a single line on stdout (no screenshot is
written). Use this to assert computed styles, layout metrics, or DOM state.
`<name>` is still required for a consistent argument order but is unused in
this mode.

## Examples

```
export PATH=$HOME/.nvm/versions/node/v20.20.2/bin:$PATH

# Desktop screenshot of the homepage
node scripts/ui-check/shot.mjs / baseline-home
# -> scripts/ui-check/out/baseline-home-desktop.png

# Mobile screenshot of the homepage
node scripts/ui-check/shot.mjs / baseline-home --mobile
# -> scripts/ui-check/out/baseline-home-mobile.png

# Custom settle time for an animated page
node scripts/ui-check/shot.mjs /work/music-map map-view --wait 5000

# Read a computed style
node scripts/ui-check/shot.mjs / check \
  --eval "document.querySelector('h1').style.fontSize"
# -> "\"32px\"" (JSON-encoded string)

# Read multiple values as an object
node scripts/ui-check/shot.mjs / check \
  --eval "({ bg: getComputedStyle(document.body).backgroundColor })"
# -> {"bg":"rgb(253, 250, 244)"}
```

## Room checks (/notes)

The /notes room is one WebGL canvas under the DOM letter board. Every room
script takes the page's origin explicitly: `--port <n>` (for
`http://localhost:<n>`) or `--base <url>` (any origin, production included;
`room-gl-compare.mjs` takes `--gl-base` and `--dom-base` instead). Scripts
wait for `.rs-root[data-room="ready"]` (the canvas's first complete frame)
where they need the room drawn. GPU runs use Playwright's full Chromium
(`channel: 'chromium'`, ANGLE Metal); the default headless shell draws WebGL
in software. Each script's header comment lists every flag.

```
# GPU sweep: static states against a software oracle, then real-mouse cases
node scripts/ui-check/room-gpu-sweep.mjs --port 3611 [--viewports 1440x900] [--dpr 2] \
  [--live] [--hover-board] [--fast] [--tour] [--frames] [--loadin] [--no-static] [--tag name]
# -> one line per state; failing shots in out/gpu-sweep/<tag>/

# Tile memory per layer group from a cc trace
node scripts/ui-check/room-mem-trace.mjs --port 3611 [--vp 1920x1080] [--budget 4096] [--motion]

# Canvas room against the CSS 3D room it replaced, same poses
node scripts/ui-check/room-gl-compare.mjs --gl-base http://localhost:3611 [--dom-base <url>] [--poses A,B,C]

# One shot with optional interaction, console problems and failed requests
node scripts/ui-check/room-shot.mjs --port 3611 [--viewport 1440x900] [--touch] [--steps '<json>']
```

## Output

`scripts/ui-check/out/` is gitignored; screenshots are throwaway artifacts,
not committed to the repo.
