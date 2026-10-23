# Full production bundle composition (hardened)

Total: 151427 B minified, 49907 B gzip, 43812 B brotli. Long string literals (≈ diagnostic text): 26412 B.

## By area (minified bytes in the bundle: additive)

| Area | Modules | Minified | Share | Long strings |
|---|---:|---:|---:|---:|
| parser / compiler | 2 | 22168 | 14.6% | 3617 |
| API registry (describe()) | 1 | 29583 | 19.5% | 18676 |
| engine, elements, scheduler, registry, log | 8 | 14482 | 9.6% | 332 |
| state engine and values | 5 | 12338 | 8.1% | 1211 |
| events: legacy on: and dispatcher | 1 | 7092 | 4.7% | 333 |
| events: :on() runtime | 1 | 8361 | 5.5% | 310 |
| events: event-time evaluator | 1 | 11145 | 7.4% | 324 |
| gestures | 1 | 2137 | 1.4% | 75 |
| persistence | 1 | 3034 | 2.0% | 0 |
| forms binding | 2 | 5713 | 3.8% | 205 |
| attributes | 3 | 9481 | 6.3% | 646 |
| text | 1 | 1962 | 1.3% | 0 |
| focus and blur | 2 | 4289 | 2.8% | 70 |
| conditions, history, nth-var | 4 | 8127 | 5.4% | 273 |
| values, sources, live, geometry | 5 | 10897 | 7.2% | 340 |
| entry points | 3 | 349 | 0.2% | 0 |

## By module

gzip / brotli of the module minified alone: for comparing modules, not additive.

| Module | Minified in bundle | gzip alone | brotli alone | Long strings |
|---|---:|---:|---:|---:|
| src/core/features.ts | 29583 | 8955 | 7673 | 18676 |
| src/core/parser.ts | 20465 | 8114 | 7384 | 3617 |
| src/state/actexpr.ts | 11145 | 4229 | 3871 | 324 |
| src/state/on.ts | 8361 | 3639 | 3347 | 310 |
| src/core/engine.ts | 7105 | 3217 | 2894 | 127 |
| src/state/actions.ts | 7092 | 3110 | 2779 | 333 |
| src/state/attrdecl.ts | 4867 | 2218 | 1997 | 422 |
| src/state/values.ts | 4741 | 2044 | 1895 | 1188 |
| src/state/bind.ts | 4371 | 1966 | 1781 | 156 |
| src/state/state.ts | 4034 | 1997 | 1791 | 0 |
| src/functions/sources.ts | 3410 | 1554 | 1411 | 67 |
| src/state/focusdecl.ts | 3402 | 1824 | 1601 | 70 |
| src/functions/values.ts | 3153 | 1560 | 1417 | 102 |
| src/state/bindattr-runtime.ts | 3088 | 1252 | 1097 | 0 |
| src/state/persist.ts | 3034 | 1525 | 1364 | 0 |
| src/core/elements.ts | 2914 | 1373 | 1252 | 0 |
| src/core/scheduler.ts | 2706 | 1450 | 1313 | 0 |
| src/state/expr.ts | 2652 | 1259 | 1126 | 23 |
| src/state/changed.ts | 2595 | 1485 | 1340 | 0 |
| src/selectors/nth-var.ts | 2580 | 1397 | 1271 | 0 |
| src/state/conditions.ts | 2297 | 1301 | 1217 | 249 |
| src/state/gesture.ts | 2137 | 1234 | 1116 | 75 |
| src/state/text.ts | 1962 | 1081 | 948 | 0 |
| src/functions/geometry.ts | 1838 | 1028 | 922 | 25 |
| src/state/typed.ts | 1772 | 1008 | 904 | 146 |
| src/core/tokenizer.ts | 1703 | 858 | 784 | 0 |
| src/state/bindattr.ts | 1526 | 711 | 620 | 224 |
| src/selectors/just-checked.ts | 1342 | 725 | 620 | 49 |
| src/core/registry.ts | 1191 | 763 | 639 | 0 |
| src/selectors/blur.ts | 887 | 526 | 448 | 0 |
| src/functions/live.ts | 724 | 539 | 476 | 0 |
| src/state/keys.ts | 671 | 424 | 378 | 0 |
| src/state/history.ts | 655 | 459 | 392 | 24 |
| src/core/log.ts | 451 | 358 | 309 | 205 |
| src/state/textof.ts | 240 | 204 | 175 | 0 |
| src/index.ts | 235 | 147 | 118 | 0 |
| <define:__RCSS_BUNDLE__> | 151 | 0 | 0 | 0 |
| src/auto.ts | 114 | 143 | 91 | 0 |
| src/core/config.ts | 59 | 93 | 79 | 0 |
| src/core/format.ts | 41 | 79 | 65 | 0 |
| src/core/version.ts | 15 | 58 | 42 | 0 |
| src/api.ts | 0 | 286 | 249 | 0 |
