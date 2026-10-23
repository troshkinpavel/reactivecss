# v0.8.1 vs v0.9.0

Chromium 156.0.8078.4 · Apple M4 Max (14 cores) · runs per cell interleaved (ABAB…) · median (min–max)

## startup

Measured 2026-10-21 21:36 UTC, 5 runs per cell.

### 100 components (300 elements)

| Implementation | taskMs | scriptMs | styleMs | compileMs | heapMB |
|---|---|---|---|---|---|
| v0.8.1 (0.8 syntax) | 17.1 (16.7–17.3) | 5.01 (4.73–5.16) | 0.555 (0.513–0.575) | 1.2 (1.1–1.3) | 2.25 (2.25–2.28) |
| v0.9.0 (0.8 syntax) | 17.4 (17.3–22.3) | 5.47 (5.29–8.19) | 0.542 (0.3–0.593) | 1.4 (1.4–2.1) | 2.35 (2.34–2.35) |
| v0.9.0 (0.9 syntax) | 17.7 (17.4–18.5) | 5.82 (5.36–5.93) | 0.573 (0.571–0.615) | 1.7 (1.7–1.8) | 2.38 (2.37–2.38) |
| v0.9.0 custom (events, conditions, attributes, text) | 17.6 (17–19.5) | 5.44 (5.22–5.86) | 0.568 (0.551–0.684) | 1.6 (1.4–1.7) | 2.28 (2.27–2.28) |
| no library | 7.97 (7.36–8.69) | 0.101 (0.089–0.134) | 0.269 (0.244–0.283) | 0 (0–0) | 0.949 (0.949–0.949) |

### 1000 components (3000 elements)

| Implementation | taskMs | scriptMs | styleMs | compileMs | heapMB |
|---|---|---|---|---|---|
| v0.8.1 (0.8 syntax) | 34.8 (33.8–34.9) | 12.1 (11.5–12.7) | 3.72 (3.54–3.75) | 1.1 (1.1–1.4) | 3.87 (3.84–3.88) |
| v0.9.0 (0.8 syntax) | 34.6 (34.2–35.8) | 12.5 (11.9–12.6) | 3.62 (3.52–3.78) | 1.4 (1.3–1.5) | 3.96 (3.95–3.99) |
| v0.9.0 (0.9 syntax) | 35.2 (34.9–36.7) | 12.9 (12.2–14) | 3.61 (3.48–3.64) | 1.9 (1.7–1.9) | 4.01 (3.99–4.08) |
| v0.9.0 custom (events, conditions, attributes, text) | 34.9 (34.2–35.9) | 12.7 (12.4–13.4) | 3.52 (3.43–3.66) | 1.9 (1.7–2) | 3.91 (3.88–3.92) |
| no library | 15.5 (15.3–16) | 0.078 (0.072–0.112) | 1.7 (1.62–1.84) | 0 (0–0) | 0.949 (0.949–0.949) |

### 5000 components (15000 elements)

| Implementation | taskMs | scriptMs | styleMs | compileMs | heapMB |
|---|---|---|---|---|---|
| v0.8.1 (0.8 syntax) | 95.7 (93.8–98.7) | 30.8 (30.3–32.1) | 16.1 (15.9–16.4) | 1.2 (1.2–1.3) | 12.5 (12.4–12.6) |
| v0.9.0 (0.8 syntax) | 97.2 (92.7–98.6) | 31.2 (29.5–31.8) | 16 (15.8–16.5) | 1.4 (1.2–1.5) | 12.9 (12.8–13) |
| v0.9.0 (0.9 syntax) | 95.1 (94.5–97.1) | 31.2 (30.3–31.6) | 16.4 (16.1–16.4) | 1.9 (1.7–1.9) | 13 (12.9–13) |
| v0.9.0 custom (events, conditions, attributes, text) | 95.2 (93.3–100.6) | 30.8 (30.1–32.3) | 16.2 (16.1–17.4) | 1.8 (1.8–1.9) | 12.8 (12.7–12.8) |
| no library | 47.3 (45.3–49.4) | 0.079 (0.068–0.086) | 7.35 (7.28–7.5) | 0 (0–0) | 0.949 (0.949–0.949) |

### 10000 components (30000 elements)

| Implementation | taskMs | scriptMs | styleMs | compileMs | heapMB |
|---|---|---|---|---|---|
| v0.8.1 (0.8 syntax) | 172.6 (170.2–176.6) | 54.4 (54–55.8) | 31.6 (31.2–32.1) | 1.2 (1.1–1.2) | 20.1 (20–20.1) |
| v0.9.0 (0.8 syntax) | 172.9 (171.3–174.7) | 54.2 (53.6–55.2) | 31.3 (31.1–32.3) | 1.4 (1.3–1.5) | 20.5 (20.5–20.6) |
| v0.9.0 (0.9 syntax) | 176.5 (172.2–179.2) | 56.3 (54.8–57.5) | 32.5 (32.2–32.9) | 1.8 (1.6–1.9) | 20.6 (20.5–20.6) |
| v0.9.0 custom (events, conditions, attributes, text) | 176.7 (175.5–177.4) | 56.2 (55.5–56.8) | 32.5 (32.3–32.9) | 1.8 (1.6–1.9) | 20.4 (20.4–20.5) |
| no library | 88.2 (87.9–90.9) | 0.106 (0.094–0.114) | 14.9 (14.7–16.3) | 0 (0–0) | 0.949 (0.949–0.949) |

### 1000 components, one-feature bundles (v0.9.0)

| Implementation | taskMs | scriptMs |
|---|---|---|
| core + events | 26.7 (25.9–26.9) | 6.13 (5.78–6.15) |
| core + forms | 26.8 (26.5–26.9) | 5.71 (5.32–5.99) |
| core + focus | 26.4 (25.8–27.1) | 6.11 (5.89–6.55) |
| core + persist | 27.8 (27.5–30.4) | 7.18 (7.04–8.51) |
| core + events + gestures | 26.9 (25.9–27) | 5.81 (5.65–6.33) |

## click

Measured 2026-10-21 21:46 UTC, 5 runs per cell.

### 1000 components, 150 clicks

| Implementation | scriptMsPerClick | taskMsPerClick | latencyMedian | latencyP95 |
|---|---|---|---|---|
| v0.8.1 (0.8 syntax) | 0.032 (0.0287–0.0351) | 0.821 (0.815–0.862) | 0 (0–0) | 0.1 (0.1–0.2) |
| v0.9.0 (0.8 syntax) | 0.0362 (0.031–0.038) | 0.851 (0.799–0.892) | 0 (0–0) | 0.1 (0.1–0.2) |
| v0.9.0 (0.9 syntax) | 0.0364 (0.0347–0.0397) | 0.842 (0.836–0.862) | 0 (0–0) | 0.1 (0.1–0.2) |
| plain JavaScript | 0.0104 (0.00937–0.0111) | 0.811 (0.806–0.863) | 0 (0–0) | 0.1 (0.1–0.1) |

### 1000 components, rules per element (v0.9.0)

| Implementation | scriptMsPerClick | taskMsPerClick | latencyMedian |
|---|---|---|---|
| one rule (no style read) | 0.0273 (0.0237–0.0304) | 0.354 (0.327–0.396) | 13.2 (13.1–13.6) |
| five competing rules (one style read) | 0.0323 (0.0262–0.0369) | 0.374 (0.331–0.404) | 13 (12.5–13.6) |

### 1000 components, four mutations per click (v0.9.0)

| Implementation | scriptMsPerClick | taskMsPerClick | latencyMedian |
|---|---|---|---|
| four mutations per click | 0.0388 (0.035–0.0429) | 0.386 (0.36–0.422) | 13 (12.7–13.5) |

## pointer

Measured 2026-10-21 21:46 UTC, 5 runs per cell.

### mouse(x) live on 1,000 elements (same CSS)

| Implementation | scriptMsPerS | taskMsPerS | longTasks | eventsPerS |
|---|---|---|---|---|
| v0.8.1 | 3.65 (3.42–4.07) | 231.4 (188.3–265.1) | 0 (0–0) | 59.9 (59.9–59.9) |
| v0.9.0 | 3.64 (3.09–4.01) | 231.9 (165.3–266.5) | 0 (0–0) | 59.9 (59.9–59.9) |

### pointermove snapshot, one element

| Implementation | scriptMsPerS | taskMsPerS | longTasks | eventsPerS |
|---|---|---|---|---|
| v0.9.0 :on(pointermove) | 6.81 (5.62–7.63) | 37.9 (31.1–42.5) | 0 (0–0) | 59.9 (59.9–59.9) |
| plain JavaScript | 1.81 (1.6–1.91) | 29.9 (25.4–30.7) | 0 (0–0) | 59.9 (59.9–59.9) |

## drag

Measured 2026-10-21 21:46 UTC, 5 runs per cell.

### one active drag among 1 candidates

| Implementation | scriptMsPerS | scriptMsPerMove | layoutCount | longTasks |
|---|---|---|---|---|
| v0.9.0 :on(drag) | 6.15 (5.86–8.07) | 0.103 (0.0981–0.135) | 0 (0–0) | 0 (0–0) |
| v0.9.0 custom (events, gestures) | 6.54 (6.41–8.01) | 0.11 (0.107–0.134) | 0 (0–0) | 0 (0–0) |
| plain JavaScript | 1.57 (1.51–1.74) | 0.0263 (0.0254–0.0291) | 1 (1–1) | 0 (0–0) |

### one active drag among 1000 candidates

| Implementation | scriptMsPerS | scriptMsPerMove | layoutCount | longTasks |
|---|---|---|---|---|
| v0.9.0 :on(drag) | 6.98 (5.69–7.45) | 0.117 (0.0953–0.125) | 0 (0–0) | 0 (0–0) |
| v0.9.0 custom (events, gestures) | 6.63 (5.03–7.12) | 0.111 (0.0842–0.119) | 0 (0–0) | 0 (0–0) |
| plain JavaScript | 1.54 (1.28–1.88) | 0.0258 (0.0215–0.0315) | 1 (1–1) | 0 (0–0) |

### persisted position, 300 moves

| Implementation | storageWrites | scriptMsPerMove |
|---|---|---|
| persisted --x | 21 (21–21) | 0.107 (0.0949–0.127) |

## idle

Measured 2026-10-21 21:36 UTC, 5 runs per cell.

### 10 s idle after start, 1000 components

| Implementation | scriptMs | taskMs | flushes | ticks |
|---|---|---|---|---|
| v0.8.1 (0.8 syntax) | 0 (0–0) | 0.358 (0.296–0.653) | 0 (0–0) | 0 (0–0) |
| v0.9.0 (0.9 syntax, every new feature) | 0 (0–0) | 0.365 (0.306–0.406) | 0 (0–0) | 0 (0–0) |

## memory

Measured 2026-10-21 21:36 UTC, 5 runs per cell.

### 10,000 components mounted, then 10 × 1,000 mount/unmount

| Implementation | mountedMB | retainedMB | bindings | states |
|---|---|---|---|---|
| v0.8.1 (0.8 syntax) | 16.8 (16.7–16.8) | 1.22 (1.22–1.22) | 0 (0–0) | 0 (0–0) |
| v0.9.0 (0.8 syntax) | 16.9 (16.9–16.9) | 1.23 (1.22–1.23) | 0 (0–0) | 0 (0–0) |
| v0.9.0 (0.9 syntax) | 16.9 (16.9–16.9) | 1.23 (1.23–1.23) | 0 (0–0) | 0 (0–0) |

## live

Measured 2026-10-21 21:36 UTC, 5 runs per cell.

### live(random(), 200ms) on 10,000 elements, 3 s

| Implementation | frameMedian | frameP95 | heapMB |
|---|---|---|---|
| v0.8.1 | 16.7 (16.7–16.7) | 16.8 (16.7–16.8) | 8.26 (6.56–8.41) |
| v0.9.0 | 16.7 (16.7–16.7) | 16.8 (16.7–16.8) | 6.6 (6.49–8.37) |

## compile

Measured 2026-10-21 21:36 UTC, 5 runs per cell.

### 500 event rules

| Implementation | compileMs | taskMs | replaceMs |
|---|---|---|---|
| v0.8.1 (on:) | 4.8 (4.7–5.8) | 19.9 (19.7–20.9) | 10.2 (8.8–10.6) |
| v0.9.0 (on:) | 5.1 (4.8–5.8) | 20.7 (19.9–21.8) | 10.7 (8.4–11.9) |
| v0.9.0 (:on()) | 6.5 (6.3–6.5) | 21.6 (21.5–22.4) | 12.4 (8.1–13.1) |

### 2000 :when() selectors

| Implementation | compileMs | taskMs | replaceMs |
|---|---|---|---|
| v0.8.1 | 11.2 (10.9–11.5) | 46 (44.5–46.8) | 38 (31.6–41.9) |
| v0.9.0 | 11.6 (11.1–12.3) | 46.6 (44.6–47.5) | 39.5 (32.4–42.3) |

### 5000 native rules + one reactive rule

| Implementation | compileMs | taskMs | replaceMs |
|---|---|---|---|
| v0.8.1 | 26.7 (26.1–27.7) | 59.9 (58.8–60.9) | 43.6 (42.5–43.9) |
| v0.9.0 | 28.5 (28.5–29.4) | 64 (61.4–64.9) | 43.8 (41.7–44.6) |
