# Bundle matrix (minified IIFE, auto-start)

Before = pre-hardening 0.9.0 (rc1); after = hardened. gzip level 9, brotli quality 11.

| Bundle | Features (added automatically) | Min before | Min after | Δ min | gzip before | gzip after | Δ gzip | brotli after | 0.8.1 min / gzip |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| minimal state | core | 53449 | 45330 | -8119 (-15.2%) | 19277 | 16890 | -2387 (-12.4%) | 15403 | 41873 / 15530 |
| counter | core, events, text | 89067 | 78484 | -10583 (-11.9%) | 30528 | 26834 | -3694 (-12.1%) | 24191 | — |
| forms | core, events, forms | 93125 | 82752 | -10373 (-11.1%) | 31798 | 28060 | -3738 (-11.8%) | 25438 | — |
| focus | core, events, focus (events) | 93276 | 78907 | -14369 (-15.4%) | 31916 | 27145 | -4771 (-14.9%) | 24454 | — |
| persistence | core, persist | 57280 | 48975 | -8305 (-14.5%) | 20696 | 18184 | -2512 (-12.1%) | 16503 | — |
| drag | core, events, gestures (events) | 88135 | 78093 | -10042 (-11.4%) | 30232 | 26847 | -3385 (-11.2%) | 24216 | — |
| sensors | core, dynamic, geometry | 60639 | 52103 | -8536 (-14.1%) | 21682 | 19060 | -2622 (-12.1%) | 17258 | — |
| interactive profile | core, events, gestures, persist, conditions, text, attributes | 109904 | 99131 | -10773 (-9.8%) | 37129 | 33418 | -3711 (-10.0%) | 29826 | — |
| full (custom, compact registry) | core, events, gestures, persist, conditions, nth-var, history, forms, text, attributes, focus, blur, values, dynamic, geometry | 140148 | 126967 | -13181 (-9.4%) | 46856 | 42129 | -4727 (-10.1%) | 37225 | — |
| dist/reactive-css.min.js (full registry) | all | 162675 | 149039 | -13636 (-8.4%) | 54074 | 49233 | -4841 (-9.0%) | 43272 | 117830 / 39715 |
| dist/reactive-css.compact.min.js | all | 141672 | 128495 | -13177 (-9.3%) | 47274 | 42488 | -4786 (-10.1%) | 37584 | 101644 / 34357 |
