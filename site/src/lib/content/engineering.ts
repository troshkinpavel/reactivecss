// Engineering numbers, copied from the library's release reports. Every figure names its source;
// none is measured by the site, except the current bundle sizes (from the synced build). Update together with the library (see docs/vision-integration.md).
import bundleData from '~/generated/bundles.json';

export const SOURCE = { file: 'docs/release-0.9.0-hardening.md', version: '0.9.0', where: 'Headless Playwright 1.64.1 engines, Chromium 156 and WebKit 27.2, on one development machine (Apple M4 Max, macOS 27.0, as recorded in the library’s benchmarks/AUDIT-0.4.md). Each figure names the report and section it comes from' };

export interface Metric { value: string; label: string; source: string }

/** Browser test results in the 0.9.0 hardening report (§J, after the API cleanup), Chromium and WebKit combined. */
export const BROWSER_RESULTS = '848';

/**
 * The latest release report, for the homepage status line. tests/unit/version.test.ts fails when
 * the installed library is newer, so this is updated with every release.
 */
export const LATEST = { version: '0.9.1', browserResults: '944', file: 'CHANGELOG.md (0.9.1, Notes)' };

export const METRICS: Metric[] = [
  { value: '14.0 ms', label: 'median input-to-correct-frame latency, idle, 100 widgets; plain JavaScript 13.6 ms. Last measured for 0.7.0', source: '0.7.0 report §10 · headless Chromium 156' },
  { value: '4.5–5.9 ms', label: 'script time to start 1,000 components, from the core-only bundle to the full custom bundle (median of 7 loads)', source: '0.8.1 preparation report §4 · headless Chromium 156' },
  { value: '150,000', label: 'component lifecycles in the memory test: 1,000 components mounted and unmounted 150 times', source: '0.7.1 report §4 · headless Chromium 156' },
  { value: '0', label: 'detached elements and leftover bindings after those cycles; the five custom-bundle profiles also left no detached elements', source: '0.7.1 report §4 · 0.8.0 report §4 · headless Chromium 156' },
  { value: BROWSER_RESULTS, label: 'browser test results passed, Chromium and WebKit combined: the same suite runs in each engine, and 6 Chromium-only DevTools tests are skipped in WebKit', source: '0.9.0 hardening report §J · Playwright engine builds' },
];

/** Input to correct frame, ms (runtime.mjs latency, derived disabled, 100 widgets, 40 real clicks). 0.7.0 report §10; not re-measured for 0.7.1 or 0.8.0. */
export const LATENCY = [
  { scenario: 'Idle', rcss: { p50: 14.0, p95: 15.7 }, js: { p50: 13.6, p95: 16.0 } },
  { scenario: 'Under load', rcss: { p50: 12.2, p95: 20.9 }, js: { p50: 12.7, p95: 23.0 } },
];
export const FRAME_MS = 16.7;

export const TESTS: [string, string][] = [
  ['Typecheck', 'pass'],
  ['Unit (Node, engine-independent)', '196 passed, including the 0.9 grammar tables, the event-time evaluator, persistence decoding, the diagnostic codes and an isolated build of each of the 15 features'],
  ['Browser, Chromium + WebKit', '848 passed, 6 skipped (tests that need the Chromium DevTools protocol); includes the 0.9 integration components, drag, persistence, the CodePen-style and strict-CSP pages, and the unchanged 0.8.1 suites'],
  ['Browser, Chromium with the CPU throttled 4×', '427 passed'],
  ['Custom bundles', 'a build matrix (minimal state, counter, forms, focus, persistence, drag, sensors, the interactive profile, full): exact feature sets, left-out features physically absent, each bundle run under a strict Content-Security-Policy'],
  ['Every example on the bundle the analyzer picks for it', '134 / 134: the application demos and the 16 API examples, Chromium and WebKit'],
  ['Firefox, automated', 'not run: Playwright’s Firefox does not start on the test machine'],
];

// The current columns are measured from ../dist when the site syncs (scripts/sync-runtime.mjs), so they always match the built files.
const measured = (name: string) => { const m = bundleData.sizes.measured.find((x) => x.name === name)!; return [m.minified, m.gzip, m.brotli]; };
export const BUNDLES = [
  { file: 'reactive-css.min.js', note: 'default, with describe() descriptions', prev: [117_830, 39_715, 34_983], now: measured('dist full') },
  { file: 'reactive-css.compact.min.js', note: 'same runtime, shorter registry', prev: [101_644, 34_357, 30_418], now: measured('dist compact') },
];
/** BUNDLES columns: 0.8.1 preparation report §4, and the synced library build. */
export const BUNDLES_SOURCE = { prev: '0.8.1', now: bundleData.sizes.version };

export const DISPATCH = 'About 4.5–5.5 µs per dispatched event for key() and 4.5–6 µs for click handlers, without prevent() (0.7.1 report §5); prevent() adds nothing measurable, and conditional on: rules cost about 5 µs more because the cascade is read to pick the rule (0.7.0 report §10). In 0.9.0 a click costs 0.0393 ms of script with :on() rules and 0.0378 ms with on:, against 0.0349 ms for 0.8.1 in the same run; the ranges overlap, and the DOM text is written in the same task as the click (0.9.0 hardening report §D).';

export const STARTUP = 'Starting 1,000 components (state, on: and text:) took 4.7 ms of script time with the core-only bundle and 6.2 ms with the full custom bundle, until the second frame, median of 7 loads; heap after GC was 1.68 to 2.14 MB. Bundle size hardly matters for startup at this scale (0.8.0 report §4). For 0.9.0, starting 10,000 components took 169.3 ms of task time with 0.9 syntax against 169.7 ms for 0.8.1, and no idle work was recorded (0.9.0 hardening report §D).';

export const MEMORY_NOTE = 'Memory test, 1,000 components × 150 cycles: 0 detached elements, 0 bindings left, heap growth −10 KB per cycle, end heap 3.55 MB (0.7.1 report §4). On custom bundles, 100 components × 50 cycles for each of the five profiles left no detached elements and no listener changes, and 300 cycles of basic and full kept the heap flat (1.76 → 1.82 MB and 2.32 → 2.51 MB, 0.8.0 report §4). In 0.7.0 one run reported +121 KB per cycle that two repeats did not reproduce; the report states it rather than explaining it away (0.7.0 report §10).';

export const CAVEATS = [
  'All numbers come from headless engines on one development machine.',
  'Firefox is not covered by the automated tests, because Playwright’s Firefox does not start there. A manual pass of the 20 examples in Chrome, Safari and Firefox was user-reported for 0.7.1, without logs or browser versions.',
  'Screen readers and real devices have not been verified.',
  'Input-to-frame latency was last measured for 0.7.0; the 0.9.0 hardening report re-measures script per event, event-to-DOM time, startup, memory and idle work against 0.8.1.',
  'Reactive CSS is not claimed to be faster than equivalent JavaScript.',
  'Similar input-to-frame latency is not similar CPU cost: both finish inside one frame. Script cost per event is measured separately (about 4.5–6 µs per dispatched event).',
  'Latency includes the browser’s style recalculation for custom-property writes, which plain JavaScript writing the same properties pays too.',
];

export const WAVE = {
  cost: '171–181 ms of main-thread style work per second for 1,000 animated elements',
  source: 'CHANGELOG · 0.5.0',
};

export const bytes = (n: number) => n.toLocaleString('en-US');
/** Milliseconds as the report prints them: 14.0, not 14. */
export const ms = (n: number) => n.toFixed(1);
