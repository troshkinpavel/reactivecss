# Bundle sizes and startup (0.9.0)

2026-10-21T22:05:23.576Z · Chromium (Playwright) · startup: 1000 components, median of 5 loads

## Sizes

| Bundle | Features | Minified | gzip | brotli |
|---|---|---:|---:|---:|
| core | core | 53449 B (52.2 KB) | 19277 B | 17474 B |
| basic | core, events | 85926 B (83.9 KB) | 29461 B | 26488 B |
| forms | core, events, forms, text, attributes | 105995 B (103.5 KB) | 35666 B | 31712 B |
| stateful-ui | core, events, conditions, history, attributes, focus | 109265 B (106.7 KB) | 36876 B | 32670 B |
| interactive | core, events, gestures, persist, conditions, text, attributes | 109904 B (107.3 KB) | 37129 B | 33000 B |
| dynamic | core, values, dynamic, geometry | 66129 B (64.6 KB) | 23646 B | 21410 B |
| full | core, events, gestures, persist, conditions, nth-var, history, forms, text, attributes, focus, blur, values, dynamic, geometry | 140148 B (136.9 KB) | 46856 B | 41135 B |
| dist full | (prebuilt) | 162675 B (158.9 KB) | 54074 B | 47147 B |
| dist compact | (prebuilt) | 141672 B (138.4 KB) | 47274 B | 41449 B |

## What each feature adds over its requirements

| Feature | Over | Minified | gzip | brotli |
|---|---|---:|---:|---:|
| events | core | +32477 B | +10184 B | +9014 B |
| gestures | core, events | +2209 B | +771 B | +728 B |
| persist | core | +3831 B | +1419 B | +1225 B |
| conditions | core | +6076 B | +2157 B | +1851 B |
| nth-var | core | +4119 B | +1572 B | +1257 B |
| history | core | +5184 B | +1882 B | +1594 B |
| forms | core | +8372 B | +2849 B | +2474 B |
| text | core | +3254 B | +1085 B | +920 B |
| attributes | core | +10237 B | +3419 B | +2867 B |
| focus | core, events | +7350 B | +2455 B | +2008 B |
| blur | core | +927 B | +401 B | +276 B |
| values | core | +5498 B | +2070 B | +1789 B |
| dynamic | core | +5033 B | +1659 B | +1467 B |
| geometry | core | +2196 B | +908 B | +744 B |

## Startup

| Bundle | Script (ms) | Task (ms) | Heap after GC (MB) | Bindings | Diagnostics |
|---|---:|---:|---:|---:|---:|
| core | 5.7 | 23 | 1.74 | 0 | 2 |
| basic | 7.5 | 24.8 | 1.88 | 0 | 1 |
| forms | 7.2 | 24.4 | 2.14 | 1000 | 0 |
| stateful-ui | 8.2 | 25.2 | 1.91 | 0 | 1 |
| interactive | 7.2 | 24.1 | 2.15 | 1000 | 0 |
| dynamic | 6.1 | 23.1 | 1.76 | 0 | 2 |
| full | 7 | 24.1 | 2.18 | 1000 | 0 |
| dist full | 7.3 | 24.4 | 2.22 | 1000 | 0 |
| dist compact | 7.6 | 24.8 | 2.18 | 1000 | 0 |
