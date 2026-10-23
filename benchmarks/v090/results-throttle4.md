# v0.8.1 vs v0.9.0 (rc1 and hardened) at 4× CPU throttling

Chromium 156.0.8078.4 · Apple M4 Max (14 cores) · runs per cell interleaved (ABAB…) · median (min–max)

## click

Measured 2026-10-21 23:15 UTC, 3 runs per cell.

### 1000 components, 150 clicks

| Implementation | scriptMsPerClick | taskMsPerClick | latencyMedian | latencyP95 |
|---|---|---|---|---|
| v0.8.1 (0.8 syntax) | 0.128 (0.0995–0.138) | 2.8 (2.64–2.83) | 0.1 (0.1–0.1) | 0.7 (0.6–0.7) |
| v0.9.0-rc1 (0.9 syntax) | 0.157 (0.111–0.204) | 2.89 (2.58–3.09) | 0.1 (0–0.1) | 0.7 (0.7–0.8) |
| v0.9.0 (0.8 syntax) | 0.143 (0.1–0.219) | 2.86 (2.4–3.28) | 0.1 (0.1–0.1) | 0.7 (0.5–0.8) |
| v0.9.0 (0.9 syntax) | 0.189 (0.128–0.194) | 2.9 (2.57–3.27) | 0.1 (0.1–0.1) | 0.8 (0.6–0.9) |
| plain JavaScript | 0.0466 (0.0395–0.0697) | 2.8 (2.53–3.8) | 0 (0–0) | 0.4 (0.3–0.4) |

### 1000 components, rules per element (v0.9.0)

| Implementation | scriptMsPerClick | taskMsPerClick | latencyMedian |
|---|---|---|---|
| one rule (no style read) | 0.111 (0.091–0.127) | 1.02 (0.881–1.02) | 5.6 (5.2–6.4) |
| five competing rules (one style read) | 0.103 (0.0996–0.111) | 0.977 (0.952–1) | 5.6 (4.7–5.8) |

### 1000 components, four mutations per click (v0.9.0)

| Implementation | scriptMsPerClick | taskMsPerClick | latencyMedian |
|---|---|---|---|
| four mutations per click | 0.132 (0.115–0.154) | 0.918 (0.914–1) | 5.7 (5.2–6.4) |

## drag

Measured 2026-10-21 23:15 UTC, 3 runs per cell.

### one active drag among 1 candidates

| Implementation | scriptMsPerS | scriptMsPerMove | layoutCount | longTasks |
|---|---|---|---|---|
| v0.9.0-rc1 :on(drag) | 10.5 (10.4–11.4) | 0.177 (0.175–0.191) | 0 (0–0) | 0 (0–0) |
| v0.9.0 :on(drag) | 11.7 (8.63–12.4) | 0.196 (0.145–0.208) | 0 (0–0) | 0 (0–0) |
| v0.9.0 custom (events, gestures) | 8.72 (5.04–12.1) | 0.146 (0.0844–0.203) | 0 (0–0) | 0 (0–0) |
| plain JavaScript | 1.86 (0.557–2.34) | 0.0311 (0.00932–0.0393) | 1 (1–1) | 0 (0–0) |

### one active drag among 1000 candidates

| Implementation | scriptMsPerS | scriptMsPerMove | layoutCount | longTasks |
|---|---|---|---|---|
| v0.9.0-rc1 :on(drag) | 9.64 (8.78–10.1) | 0.162 (0.147–0.169) | 0 (0–0) | 0 (0–0) |
| v0.9.0 :on(drag) | 9.37 (8.94–10.8) | 0.157 (0.15–0.181) | 0 (0–0) | 0 (0–0) |
| v0.9.0 custom (events, gestures) | 6.57 (6.38–13.1) | 0.11 (0.107–0.22) | 0 (0–0) | 0 (0–0) |
| plain JavaScript | 2.77 (1.94–2.9) | 0.0466 (0.0326–0.0486) | 1 (1–1) | 0 (0–0) |

### persisted position, 300 moves

| Implementation | storageWrites | scriptMsPerMove |
|---|---|---|
| persisted --x | 21 (21–21) | 0.165 (0.163–0.218) |

## live

Measured 2026-10-21 23:15 UTC, 3 runs per cell.

### live(random(), 200ms) on 10,000 elements, 3 s

| Implementation | frameMedian | frameP95 | heapMB |
|---|---|---|---|
| v0.8.1 | 16.7 (16.7–16.7) | 33.4 (33.3–50) | 8.26 (6.46–9.39) |
| v0.9.0-rc1 | 16.7 (16.7–16.7) | 33.4 (33.3–49.9) | 6.45 (6.34–7.58) |
| v0.9.0 | 16.7 (16.7–16.7) | 33.3 (33.3–33.4) | 6.41 (6.37–7.46) |

## input

Measured 2026-10-21 23:15 UTC, 3 runs per cell.

### 100 characters typed into a bound field with a live preview

| Implementation | scriptMsPerInput | taskMsPerInput |
|---|---|---|
| v0.8.1 (bind:, text:) | 0.0265 (0.017–0.0385) | 0.228 (0.222–0.266) |
| v0.9.0 (bind:, text:) | 0.0475 (0.0318–0.0528) | 0.264 (0.256–0.319) |
| v0.9.0-rc1 (:on(input), event(value), bind(value)) | 0.0874 (0.0703–0.101) | 0.373 (0.294–0.524) |
| v0.9.0 (:on(input), event(value), bind(value)) | 0.0915 (0.0799–0.119) | 0.456 (0.388–0.468) |
| plain JavaScript | 0.0139 (0.0133–0.0193) | 0.276 (0.218–0.346) |

### mousemove snapshot, one element

| Implementation | scriptMsPerS | taskMsPerS | longTasks |
|---|---|---|---|
| v0.9.0-rc1 :on(mousemove) | 8.5 (6.18–8.54) | 50.1 (39.6–54) | 0 (0–0) |
| v0.9.0 :on(mousemove) | 9.1 (8.87–9.39) | 57.4 (57.4–61.6) | 0 (0–0) |
| plain JavaScript | 2 (1.8–2.11) | 29.4 (27–30.4) | 0 (0–0) |

### scroll snapshot (200 wheel steps)

| Implementation | scriptMsPerS | taskMsPerS |
|---|---|---|
| v0.9.0-rc1 :on(scroll) | 11.1 (9.17–13.4) | 55 (41.4–57.7) |
| v0.9.0 :on(scroll) | 8.56 (6.38–12.4) | 41 (28.2–56.8) |
| plain JavaScript | 1.65 (1.48–1.89) | 21.8 (21.4–23.8) |

## render

Measured 2026-10-21 23:15 UTC, 3 runs per cell.

### click → first observation (ms, median of 40 clicks)

| Implementation | styleMs | textMs | attrMs | focusMs | focusCount |
|---|---|---|---|---|---|
| v0.8.1 (0.8 syntax) | 15.6 (15.4–15.7) | 0.8 (0.7–0.9) | 0.8 (0.7–0.9) | 1 (0.9–1.1) | 20 (20–20) |
| v0.9.0-rc1 (0.9 syntax) | 16 (15.8–16) | 0.8 (0.7–0.9) | 0.8 (0.7–0.9) | 0.8 (0.8–1) | 20 (20–20) |
| v0.9.0 (0.8 syntax) | 15.7 (15.2–15.8) | 0.9 (0.7–1) | 0.9 (0.7–1) | 1 (1–1.3) | 20 (20–20) |
| v0.9.0 (0.9 syntax) | 15.4 (15.4–15.9) | 0.7 (0.6–1) | 0.7 (0.6–1) | 0.8 (0.6–1) | 20 (20–20) |
