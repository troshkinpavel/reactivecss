# Bundle sizes and startup (0.8.1)

2026-10-21T15:48:41.811Z · Chromium (Playwright) · startup: 1000 components, median of 7 loads

## Sizes

| Bundle | Features | Minified | gzip | brotli |
|---|---|---:|---:|---:|
| core | core | 41873 B (40.9 KB) | 15530 B | 14102 B |
| basic | core, events | 53208 B (52.0 KB) | 18844 B | 17049 B |
| forms | core, events, forms, text, attributes | 72134 B (70.4 KB) | 24758 B | 22127 B |
| stateful-ui | core, events, conditions, history, attributes, focus | 76037 B (74.3 KB) | 26317 B | 23450 B |
| dynamic | core, values, dynamic, geometry | 54540 B (53.3 KB) | 19833 B | 17962 B |
| full | core, events, conditions, nth-var, history, forms, text, attributes, focus, values, dynamic, geometry | 100112 B (97.8 KB) | 34023 B | 30110 B |
| dist full | (prebuilt) | 117830 B (115.1 KB) | 39715 B | 34983 B |
| dist compact | (prebuilt) | 101644 B (99.3 KB) | 34357 B | 30418 B |

## What each feature adds over its requirements

| Feature | Over | Minified | gzip | brotli |
|---|---|---:|---:|---:|
| events | core | +11335 B | +3314 B | +2947 B |
| conditions | core | +7342 B | +2614 B | +2315 B |
| nth-var | core | +4107 B | +1486 B | +1306 B |
| history | core | +5175 B | +1796 B | +1620 B |
| forms | core | +8219 B | +2704 B | +2412 B |
| text | core | +3078 B | +1097 B | +922 B |
| attributes | core | +9427 B | +3132 B | +2745 B |
| focus | core, events | +3504 B | +1177 B | +1054 B |
| values | core | +5490 B | +2001 B | +1784 B |
| dynamic | core | +5022 B | +1637 B | +1492 B |
| geometry | core | +2188 B | +863 B | +758 B |

## Startup

| Bundle | Script (ms) | Task (ms) | Heap after GC (MB) | Bindings | Diagnostics |
|---|---:|---:|---:|---:|---:|
| core | 4.5 | 19.5 | 1.68 | 0 | 2 |
| basic | 5.1 | 20.3 | 1.81 | 0 | 1 |
| forms | 5.9 | 20.8 | 2.07 | 1000 | 0 |
| stateful-ui | 5.7 | 20.6 | 1.84 | 0 | 1 |
| dynamic | 4.8 | 19.9 | 1.7 | 0 | 2 |
| full | 5.9 | 20.6 | 2.11 | 1000 | 0 |
| dist full | 6 | 20.7 | 2.14 | 1000 | 0 |
| dist compact | 5.8 | 20.4 | 2.11 | 1000 | 0 |
