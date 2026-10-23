# v0.8.1 vs v0.9.0 (rc1 and hardened) at 4× CPU throttling

Chromium 156.0.8078.4 · Apple M4 Max (14 cores) · runs per cell interleaved (ABAB…) · median (min–max)

## click

Measured 2026-10-21 23:23 UTC, 7 runs per cell.

### 1000 components, 150 clicks

| Implementation | scriptMsPerClick | taskMsPerClick | latencyMedian | latencyP95 |
|---|---|---|---|---|
| v0.8.1 (0.8 syntax) | 0.208 (0.0905–0.267) | 3.56 (2.6–3.96) | 0.2 (0–0.4) | 0.8 (0.5–1) |
| v0.9.0-rc1 (0.9 syntax) | 0.147 (0.106–0.303) | 2.93 (2.64–3.89) | 0.1 (0–0.4) | 0.8 (0.5–0.9) |
| v0.9.0 (0.8 syntax) | 0.152 (0.0837–0.281) | 2.98 (2.61–3.77) | 0.1 (0–0.3) | 0.7 (0.6–1) |
| v0.9.0 (0.9 syntax) | 0.16 (0.116–0.277) | 3.13 (2.55–3.99) | 0.1 (0.1–0.4) | 0.7 (0.6–1) |
| plain JavaScript | 0.0547 (0.0202–0.0747) | 3.31 (2.54–3.75) | 0 (0–0) | 0.3 (0.1–0.5) |

### 1000 components, rules per element (v0.9.0)

| Implementation | scriptMsPerClick | taskMsPerClick | latencyMedian |
|---|---|---|---|
| one rule (no style read) | 0.0908 (0.0783–0.118) | 0.905 (0.865–1.02) | 6.6 (5.4–7.4) |
| five competing rules (one style read) | 0.0945 (0.0749–0.118) | 0.905 (0.803–0.991) | 6.6 (5.5–7.3) |

### 1000 components, four mutations per click (v0.9.0)

| Implementation | scriptMsPerClick | taskMsPerClick | latencyMedian |
|---|---|---|---|
| four mutations per click | 0.122 (0.0984–0.151) | 0.914 (0.799–1.04) | 6.3 (5.4–7.3) |

## input

Measured 2026-10-21 23:23 UTC, 7 runs per cell.

### 100 characters typed into a bound field with a live preview

| Implementation | scriptMsPerInput | taskMsPerInput |
|---|---|---|
| v0.8.1 (bind:, text:) | 0.0332 (0.0309–0.0441) | 0.302 (0.256–0.339) |
| v0.9.0 (bind:, text:) | 0.0373 (0.0319–0.0569) | 0.258 (0.235–0.311) |
| v0.9.0-rc1 (:on(input), event(value), bind(value)) | 0.0871 (0.0607–0.0937) | 0.414 (0.356–0.446) |
| v0.9.0 (:on(input), event(value), bind(value)) | 0.0947 (0.0616–0.0985) | 0.386 (0.362–0.471) |
| plain JavaScript | 0.0216 (0.00571–0.0283) | 0.29 (0.257–0.318) |

### mousemove snapshot, one element

| Implementation | scriptMsPerS | taskMsPerS | longTasks |
|---|---|---|---|
| v0.9.0-rc1 :on(mousemove) | 8.19 (4.63–9.72) | 52 (27–64.4) | 0 (0–0) |
| v0.9.0 :on(mousemove) | 8.18 (5.4–9.37) | 56.5 (37.9–61.4) | 0 (0–0) |
| plain JavaScript | 1.94 (1.34–2.2) | 26.2 (23.7–29.5) | 0 (0–0) |

### scroll snapshot (200 wheel steps)

| Implementation | scriptMsPerS | taskMsPerS |
|---|---|---|
| v0.9.0-rc1 :on(scroll) | 6.98 (2.64–10.6) | 35.3 (13.4–50) |
| v0.9.0 :on(scroll) | 8.69 (2.72–11.8) | 37.7 (12.8–52.6) |
| plain JavaScript | 1.33 (0.738–1.6) | 15.3 (10.1–22) |
