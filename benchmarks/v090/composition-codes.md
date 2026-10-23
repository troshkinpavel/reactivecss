# Full production bundle composition (codes)

Total: 152236 B minified, 49909 B gzip, 43786 B brotli. Long string literals (≈ diagnostic text): 26972 B.

## By area (minified bytes in the bundle: additive)

| Area | Modules | Minified | Share | Long strings |
|---|---:|---:|---:|---:|
| parser / compiler | 2 | 22855 | 15.0% | 3372 |
| API registry (describe()) | 1 | 29583 | 19.4% | 18676 |
| engine, elements, scheduler, registry, log | 8 | 14457 | 9.5% | 332 |
| state engine and values | 5 | 12338 | 8.1% | 1211 |
| events: legacy on: and dispatcher | 1 | 7097 | 4.7% | 333 |
| events: :on() runtime | 1 | 8362 | 5.5% | 310 |
| events: event-time evaluator | 1 | 11121 | 7.3% | 324 |
| gestures | 1 | 1983 | 1.3% | 0 |
| persistence | 1 | 3037 | 2.0% | 0 |
| forms binding | 2 | 5715 | 3.8% | 205 |
| attributes | 3 | 10079 | 6.6% | 1516 |
| text | 1 | 1962 | 1.3% | 0 |
| focus and blur | 2 | 4187 | 2.8% | 70 |
| conditions, history, nth-var | 4 | 8127 | 5.3% | 273 |
| values, sources, live, geometry | 5 | 10715 | 7.0% | 350 |
| entry points | 3 | 349 | 0.2% | 0 |

## By module

gzip / brotli of the module minified alone: for comparing modules, not additive.

| Module | Minified in bundle | gzip alone | brotli alone | Long strings |
|---|---:|---:|---:|---:|
| src/core/features.ts | 29583 | 8955 | 7673 | 18676 |
| src/core/parser.ts | 21152 | 8045 | 7293 | 3372 |
| src/state/actexpr.ts | 11121 | 4227 | 3867 | 324 |
| src/state/on.ts | 8362 | 3639 | 3347 | 310 |
| src/core/engine.ts | 7106 | 3217 | 2894 | 127 |
| src/state/actions.ts | 7097 | 3110 | 2779 | 333 |
| src/state/attrdecl.ts | 5465 | 2492 | 2220 | 1292 |
| src/state/values.ts | 4741 | 2044 | 1895 | 1188 |
| src/state/bind.ts | 4373 | 1966 | 1781 | 156 |
| src/state/state.ts | 4034 | 1997 | 1791 | 0 |
| src/functions/sources.ts | 3410 | 1554 | 1411 | 67 |
| src/state/focusdecl.ts | 3405 | 1824 | 1601 | 70 |
| src/state/bindattr-runtime.ts | 3088 | 1252 | 1097 | 0 |
| src/state/persist.ts | 3037 | 1525 | 1364 | 0 |
| src/functions/values.ts | 2971 | 1450 | 1329 | 112 |
| src/core/elements.ts | 2886 | 1359 | 1233 | 0 |
| src/core/scheduler.ts | 2707 | 1450 | 1313 | 0 |
| src/state/expr.ts | 2652 | 1259 | 1126 | 23 |
| src/state/changed.ts | 2595 | 1485 | 1340 | 0 |
| src/selectors/nth-var.ts | 2580 | 1397 | 1271 | 0 |
| src/state/conditions.ts | 2297 | 1301 | 1217 | 249 |
| src/state/gesture.ts | 1983 | 1153 | 1050 | 0 |
| src/state/text.ts | 1962 | 1081 | 948 | 0 |
| src/functions/geometry.ts | 1838 | 1028 | 922 | 25 |
| src/state/typed.ts | 1772 | 1008 | 904 | 146 |
| src/core/tokenizer.ts | 1703 | 858 | 784 | 0 |
| src/state/bindattr.ts | 1526 | 711 | 620 | 224 |
| src/selectors/just-checked.ts | 1342 | 725 | 620 | 49 |
| src/core/registry.ts | 1191 | 763 | 639 | 0 |
| src/selectors/blur.ts | 782 | 491 | 415 | 0 |
| src/functions/live.ts | 724 | 539 | 476 | 0 |
| src/state/keys.ts | 671 | 424 | 378 | 0 |
| src/state/history.ts | 655 | 459 | 392 | 24 |
| src/core/log.ts | 452 | 358 | 309 | 205 |
| src/state/textof.ts | 240 | 204 | 175 | 0 |
| src/index.ts | 235 | 147 | 118 | 0 |
| <define:__RCSS_BUNDLE__> | 151 | 0 | 0 | 0 |
| src/auto.ts | 114 | 143 | 91 | 0 |
| src/core/config.ts | 59 | 93 | 79 | 0 |
| src/core/format.ts | 41 | 79 | 65 | 0 |
| src/core/version.ts | 15 | 58 | 42 | 0 |
| src/api.ts | 0 | 286 | 249 | 0 |
