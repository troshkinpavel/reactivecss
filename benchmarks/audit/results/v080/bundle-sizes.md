# Bundle sizes and startup (0.8.0)

2026-10-20T23:48:47.379Z · Chromium (Playwright) · startup: 1000 components, median of 7 loads

## Sizes

| Bundle | Features | Minified | gzip | brotli |
|---|---|---:|---:|---:|
| core | core | 41878 B (40.9 KB) | 15535 B | 14088 B |
| basic | core, events | 53213 B (52.0 KB) | 18851 B | 17079 B |
| forms | core, events, forms, text, attributes | 72139 B (70.4 KB) | 24748 B | 22140 B |
| stateful-ui | core, events, conditions, history, attributes, focus | 76042 B (74.3 KB) | 26326 B | 23457 B |
| dynamic | core, values, dynamic, geometry | 54545 B (53.3 KB) | 19838 B | 17967 B |
| full | core, events, conditions, nth-var, history, forms, text, attributes, focus, values, dynamic, geometry | 100117 B (97.8 KB) | 34026 B | 30081 B |
| dist full | (prebuilt) | 117835 B (115.1 KB) | 39712 B | 34927 B |
| dist compact | (prebuilt) | 101649 B (99.3 KB) | 34350 B | 30429 B |

## What each feature adds over its requirements

| Feature | Over | Minified | gzip | brotli |
|---|---|---:|---:|---:|
| events | core | +11335 B | +3316 B | +2991 B |
| conditions | core | +7342 B | +2620 B | +2334 B |
| nth-var | core | +4107 B | +1487 B | +1322 B |
| history | core | +5175 B | +1801 B | +1636 B |
| forms | core | +8219 B | +2701 B | +2418 B |
| text | core | +3078 B | +1089 B | +933 B |
| attributes | core | +9427 B | +3129 B | +2765 B |
| focus | core, events | +3504 B | +1175 B | +1032 B |
| values | core | +5490 B | +1995 B | +1813 B |
| dynamic | core | +5022 B | +1628 B | +1499 B |
| geometry | core | +2188 B | +857 B | +757 B |

## Startup

| Bundle | Script (ms) | Task (ms) | Heap after GC (MB) | Bindings | Diagnostics |
|---|---:|---:|---:|---:|---:|
| core | 4.8 | 21.1 | 1.68 | 0 | 2 |
| basic | 5.6 | 22 | 1.81 | 0 | 1 |
| forms | 6.4 | 22.4 | 2.07 | 1000 | 0 |
| stateful-ui | 6.2 | 22.5 | 1.84 | 0 | 1 |
| dynamic | 5.2 | 21.8 | 1.7 | 0 | 2 |
| full | 6.3 | 22.3 | 2.11 | 1000 | 0 |
| dist full | 6.4 | 21.9 | 2.14 | 1000 | 0 |
| dist compact | 6.2 | 22.1 | 2.11 | 1000 | 0 |
