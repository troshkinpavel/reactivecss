# v0.8.1 vs v0.9.0 (rc1 and hardened)

Chromium 156.0.8078.4 · Apple M4 Max (14 cores) · runs per cell interleaved (ABAB…) · median (min–max)

## startup

Measured 2026-10-21 22:53 UTC, 5 runs per cell.

### 100 components (300 elements)

| Implementation | taskMs | scriptMs | styleMs | compileMs | heapMB |
|---|---|---|---|---|---|
| v0.8.1 (0.8 syntax) | 16.5 (16–16.9) | 4.82 (4.69–4.96) | 0.524 (0.505–0.546) | 1.1 (1–1.2) | 2.25 (2.25–2.26) |
| v0.9.0-rc1 (0.9 syntax) | 17.4 (17–17.7) | 5.6 (5.34–5.68) | 0.576 (0.564–0.636) | 1.8 (1.7–1.8) | 2.38 (2.37–2.38) |
| v0.9.0 (0.8 syntax) | 16.6 (16.5–16.8) | 5.1 (4.96–5.15) | 0.541 (0.52–0.563) | 1.3 (1.2–1.5) | 2.33 (2.32–2.33) |
| v0.9.0 (0.9 syntax) | 17.3 (17.2–17.6) | 5.68 (5.33–5.73) | 0.549 (0.533–0.559) | 1.7 (1.7–1.8) | 2.36 (2.35–2.36) |
| v0.9.0 custom (events, conditions, attributes, text) | 17.2 (16.6–17.4) | 5.5 (5.19–5.59) | 0.546 (0.531–0.558) | 1.7 (1.6–1.9) | 2.26 (2.26–2.26) |
| no library | 7.64 (7.18–7.79) | 0.11 (0.07–0.128) | 0.275 (0.25–0.305) | 0 (0–0) | 0.949 (0.949–0.949) |

### 1000 components (3000 elements)

| Implementation | taskMs | scriptMs | styleMs | compileMs | heapMB |
|---|---|---|---|---|---|
| v0.8.1 (0.8 syntax) | 32.9 (32.5–33.5) | 11.5 (11.3–11.8) | 3.56 (3.48–3.61) | 1.2 (1.2–1.3) | 3.85 (3.84–3.87) |
| v0.9.0-rc1 (0.9 syntax) | 33.1 (32.8–33.4) | 12 (11.8–12.4) | 3.48 (3.42–3.49) | 1.9 (1.8–2.3) | 4 (3.98–4.02) |
| v0.9.0 (0.8 syntax) | 32.8 (32.6–33.2) | 11.7 (11.6–11.8) | 3.49 (3.36–3.58) | 1.4 (1.3–1.5) | 3.95 (3.94–3.97) |
| v0.9.0 (0.9 syntax) | 33.6 (32.9–33.7) | 12.1 (11.8–12.3) | 3.51 (3.48–3.56) | 1.8 (1.8–1.9) | 3.97 (3.97–4) |
| v0.9.0 custom (events, conditions, attributes, text) | 33.2 (32.7–34.2) | 11.9 (11.8–12.3) | 3.46 (3.37–3.61) | 1.9 (1.8–1.9) | 3.89 (3.87–3.89) |
| no library | 14.8 (14.3–15.5) | 0.097 (0.082–0.118) | 1.61 (1.49–1.73) | 0 (0–0) | 0.949 (0.949–0.949) |

### 5000 components (15000 elements)

| Implementation | taskMs | scriptMs | styleMs | compileMs | heapMB |
|---|---|---|---|---|---|
| v0.8.1 (0.8 syntax) | 91.4 (91.2–92.3) | 29.3 (28.8–29.5) | 15.6 (15.5–15.7) | 1.2 (1.1–1.3) | 12.5 (12.5–12.6) |
| v0.9.0-rc1 (0.9 syntax) | 94.2 (92.5–97.5) | 30.8 (30.4–33.6) | 15.9 (15.9–16.2) | 1.9 (1.8–2) | 13 (12.9–13.2) |
| v0.9.0 (0.8 syntax) | 92.3 (91.6–92.9) | 29.8 (28.9–30.1) | 15.7 (15.7–15.9) | 1.4 (1.1–1.5) | 13 (12.9–13.1) |
| v0.9.0 (0.9 syntax) | 92 (90.8–93.3) | 29.6 (28.7–30.4) | 15.9 (15.8–15.9) | 1.9 (1.8–2) | 13 (12.9–13.2) |
| v0.9.0 custom (events, conditions, attributes, text) | 92.6 (91.2–93) | 30.1 (29.3–30.4) | 15.8 (15.8–16) | 1.8 (1.8–1.9) | 12.8 (12.7–12.8) |
| no library | 45.9 (45.7–46.5) | 0.094 (0.084–0.104) | 7.35 (7.29–7.53) | 0 (0–0) | 0.949 (0.949–0.949) |

### 10000 components (30000 elements)

| Implementation | taskMs | scriptMs | styleMs | compileMs | heapMB |
|---|---|---|---|---|---|
| v0.8.1 (0.8 syntax) | 169.7 (167.6–169.9) | 53.5 (52.5–53.7) | 31.1 (31–31.5) | 1.2 (1.2–1.4) | 20.2 (20.1–20.2) |
| v0.9.0-rc1 (0.9 syntax) | 169.8 (169.1–171.4) | 53.9 (53.6–55) | 31.5 (31.4–31.6) | 1.8 (1.7–2.3) | 20.6 (20.5–20.7) |
| v0.9.0 (0.8 syntax) | 169.7 (167.2–172.8) | 53.1 (52.1–54.7) | 31.1 (31–31.9) | 1.4 (1.4–1.5) | 20.5 (20.5–20.5) |
| v0.9.0 (0.9 syntax) | 169.3 (166.5–172.8) | 53.2 (51.9–54.7) | 31.5 (31.4–31.7) | 2 (2–2.4) | 20.5 (20.5–20.6) |
| v0.9.0 custom (events, conditions, attributes, text) | 169.3 (168.2–174.4) | 53.8 (53–55.1) | 31.3 (31.3–32.3) | 1.8 (1.7–1.9) | 20.4 (20.4–20.6) |
| no library | 85.6 (84.8–86.6) | 0.091 (0.071–0.112) | 14.4 (14.3–14.7) | 0 (0–0) | 0.949 (0.949–0.949) |

### 1000 components, one-feature bundles (v0.9.0)

| Implementation | taskMs | scriptMs |
|---|---|---|
| core + events | 26.6 (25.8–26.8) | 5.87 (5.79–6.15) |
| core + forms | 26.4 (26.2–27) | 5.63 (5.41–5.83) |
| core + focus | 26.7 (26.5–27.4) | 6.16 (6.03–6.29) |
| core + persist | 27.4 (26.8–28) | 6.83 (6.77–7.58) |
| core + events + gestures | 26.3 (25.6–26.6) | 5.86 (5.6–6.11) |

## click

Measured 2026-10-21 22:53 UTC, 5 runs per cell.

### 1000 components, 150 clicks

| Implementation | scriptMsPerClick | taskMsPerClick | latencyMedian | latencyP95 |
|---|---|---|---|---|
| v0.8.1 (0.8 syntax) | 0.0349 (0.0317–0.0377) | 0.811 (0.809–0.911) | 0 (0–0) | 0.1 (0.1–0.2) |
| v0.9.0-rc1 (0.9 syntax) | 0.0388 (0.0377–0.0434) | 0.827 (0.813–0.855) | 0 (0–0.1) | 0.2 (0.1–0.2) |
| v0.9.0 (0.8 syntax) | 0.0378 (0.0347–0.0413) | 0.819 (0.816–0.852) | 0 (0–0) | 0.1 (0.1–0.2) |
| v0.9.0 (0.9 syntax) | 0.0393 (0.0366–0.0426) | 0.831 (0.809–0.865) | 0 (0–0) | 0.1 (0.1–0.2) |
| plain JavaScript | 0.0112 (0.0103–0.0133) | 0.836 (0.826–0.897) | 0 (0–0) | 0.1 (0.1–0.1) |

### 1000 components, rules per element (v0.9.0)

| Implementation | scriptMsPerClick | taskMsPerClick | latencyMedian |
|---|---|---|---|
| one rule (no style read) | 0.0282 (0.0274–0.0296) | 0.392 (0.389–0.396) | 13 (12.8–13.5) |
| five competing rules (one style read) | 0.0332 (0.0301–0.0372) | 0.386 (0.376–0.402) | 13 (12.5–13.1) |

### 1000 components, four mutations per click (v0.9.0)

| Implementation | scriptMsPerClick | taskMsPerClick | latencyMedian |
|---|---|---|---|
| four mutations per click | 0.0402 (0.0381–0.0406) | 0.401 (0.388–0.41) | 12.8 (12.7–13.3) |

## pointer

Measured 2026-10-21 22:53 UTC, 5 runs per cell.

### mouse(x) live on 1,000 elements (same CSS)

| Implementation | scriptMsPerS | taskMsPerS | longTasks | eventsPerS |
|---|---|---|---|---|
| v0.8.1 | 5.37 (3.56–5.9) | 249.6 (157.3–257.3) | 0 (0–0) | 59.9 (59.9–59.9) |
| v0.9.0-rc1 | 5.25 (3.83–5.89) | 240.3 (177.8–253.4) | 0 (0–0) | 59.9 (59.9–59.9) |
| v0.9.0 | 5.51 (3.88–6.18) | 245.4 (168.4–261.9) | 0 (0–0) | 59.9 (59.9–59.9) |

### pointermove snapshot, one element

| Implementation | scriptMsPerS | taskMsPerS | longTasks | eventsPerS |
|---|---|---|---|---|
| v0.9.0-rc1 :on(pointermove) | 12 (11.5–13.2) | 65.6 (64–71.8) | 0 (0–0) | 59.9 (59.9–59.9) |
| v0.9.0 :on(pointermove) | 12.2 (9.52–12.7) | 66 (50.3–69.1) | 0 (0–0) | 59.9 (59.8–59.9) |
| plain JavaScript | 3.3 (2.6–3.42) | 50.1 (40.1–54.4) | 0 (0–0) | 59.8 (59.8–59.9) |

## drag

Measured 2026-10-21 22:53 UTC, 5 runs per cell.

### one active drag among 1 candidates

| Implementation | scriptMsPerS | scriptMsPerMove | layoutCount | longTasks |
|---|---|---|---|---|
| v0.9.0-rc1 :on(drag) | 9.84 (8.82–10.6) | 0.165 (0.148–0.178) | 0 (0–0) | 0 (0–0) |
| v0.9.0 :on(drag) | 10.6 (9.96–10.9) | 0.178 (0.167–0.182) | 0 (0–0) | 0 (0–0) |
| v0.9.0 custom (events, gestures) | 10.5 (9.21–10.8) | 0.176 (0.154–0.182) | 0 (0–0) | 0 (0–0) |
| plain JavaScript | 2.28 (2.06–2.54) | 0.0381 (0.0344–0.0425) | 1 (1–1) | 0 (0–0) |

### one active drag among 1000 candidates

| Implementation | scriptMsPerS | scriptMsPerMove | layoutCount | longTasks |
|---|---|---|---|---|
| v0.9.0-rc1 :on(drag) | 10.8 (9.64–11.2) | 0.18 (0.162–0.188) | 0 (0–0) | 0 (0–0) |
| v0.9.0 :on(drag) | 10.2 (10.1–11.3) | 0.171 (0.169–0.189) | 0 (0–0) | 0 (0–0) |
| v0.9.0 custom (events, gestures) | 10.6 (10.2–11.7) | 0.178 (0.171–0.197) | 0 (0–0) | 0 (0–0) |
| plain JavaScript | 2.4 (2.3–2.47) | 0.0401 (0.0385–0.0413) | 1 (1–1) | 0 (0–0) |

### persisted position, 300 moves

| Implementation | storageWrites | scriptMsPerMove |
|---|---|---|
| persisted --x | 21 (21–21) | 0.197 (0.181–0.214) |

## idle

Measured 2026-10-21 22:53 UTC, 5 runs per cell.

### 10 s idle after start, 1000 components

| Implementation | scriptMs | taskMs | flushes | ticks |
|---|---|---|---|---|
| v0.8.1 (0.8 syntax) | 0 (0–0) | 0.622 (0.589–0.972) | 0 (0–0) | 0 (0–0) |
| v0.9.0-rc1 (0.9 syntax, every new feature) | 0 (0–0) | 0.697 (0.604–0.707) | 0 (0–0) | 0 (0–0) |
| v0.9.0 (0.9 syntax, every new feature) | 0 (0–0) | 0.702 (0.471–0.703) | 0 (0–0) | 0 (0–0) |

## memory

Measured 2026-10-21 22:53 UTC, 5 runs per cell.

### 10,000 components mounted, then 10 × 1,000 mount/unmount

| Implementation | mountedMB | retainedMB | bindings | states |
|---|---|---|---|---|
| v0.8.1 (0.8 syntax) | 16.7 (16.7–16.8) | 1.22 (1.22–1.22) | 0 (0–0) | 0 (0–0) |
| v0.9.0-rc1 (0.9 syntax) | 16.9 (16.9–16.9) | 1.23 (1.23–1.23) | 0 (0–0) | 0 (0–0) |
| v0.9.0 (0.8 syntax) | 16.9 (16.9–16.9) | 1.23 (1.22–1.23) | 0 (0–0) | 0 (0–0) |
| v0.9.0 (0.9 syntax) | 16.9 (16.9–16.9) | 1.23 (1.22–1.23) | 0 (0–0) | 0 (0–0) |

## live

Measured 2026-10-21 22:53 UTC, 5 runs per cell.

### live(random(), 200ms) on 10,000 elements, 3 s

| Implementation | frameMedian | frameP95 | heapMB |
|---|---|---|---|
| v0.8.1 | 16.7 (16.7–16.7) | 16.8 (16.7–16.8) | 8.33 (6.38–8.46) |
| v0.9.0-rc1 | 16.7 (16.7–16.7) | 16.7 (16.7–16.8) | 8.39 (6.66–8.59) |
| v0.9.0 | 16.7 (16.7–16.7) | 16.8 (16.7–16.8) | 8.48 (8.34–8.54) |

## compile

Measured 2026-10-21 22:53 UTC, 5 runs per cell.

### 500 event rules

| Implementation | compileMs | taskMs | replaceMs |
|---|---|---|---|
| v0.8.1 (on:) | 4.6 (4.6–5) | 19 (18.8–19.4) | 9.8 (9.7–10.1) |
| v0.9.0 (on:) | 4.8 (4.6–5.3) | 19.1 (18.8–19.6) | 10.1 (9.8–10.3) |
| v0.9.0-rc1 (:on()) | 6.3 (6.2–6.4) | 20.4 (20.3–20.8) | 11.9 (9.5–12.3) |
| v0.9.0 (:on()) | 6.2 (6.1–6.3) | 20.2 (19.8–20.5) | 11.2 (10.2–12.1) |

### 2000 :when() selectors

| Implementation | compileMs | taskMs | replaceMs |
|---|---|---|---|
| v0.8.1 | 10.3 (10.1–10.7) | 42.5 (41.2–43.2) | 40.3 (40.2–46.2) |
| v0.9.0-rc1 | 10.8 (10.2–11.1) | 41.8 (41.6–43.5) | 41.8 (39.6–43.1) |
| v0.9.0 | 10.6 (10.4–11) | 41.9 (41.5–42.5) | 43.1 (42–48.7) |

### 5000 native rules + one reactive rule

| Implementation | compileMs | taskMs | replaceMs |
|---|---|---|---|
| v0.8.1 | 24.5 (24.1–24.6) | 53.8 (53.5–54.3) | 53 (44.5–54) |
| v0.9.0-rc1 | 26.5 (26–26.8) | 56.5 (56–58.1) | 54.5 (54.1–55.5) |
| v0.9.0 | 26.1 (25.9–26.5) | 55.9 (55.4–56.4) | 54.1 (53.6–55) |

### 5000 native rules only (the pre-filter path)

| Implementation | compileMs | taskMs | replaceMs |
|---|---|---|---|
| v0.8.1 | 0 (0–0) | 15.5 (13.6–15.6) | 5.7 (5.4–6.1) |
| v0.9.0-rc1 | 0 (0–0) | 15.6 (15.4–15.9) | 6.1 (5.9–6.2) |
| v0.9.0 | 0 (0–0) | 15.6 (15.4–15.7) | 6.4 (3.6–6.5) |

## input

Measured 2026-10-21 22:53 UTC, 5 runs per cell.

### 100 characters typed into a bound field with a live preview

| Implementation | scriptMsPerInput | taskMsPerInput |
|---|---|---|
| v0.8.1 (bind:, text:) | 0.00783 (0.00768–0.00833) | 0.0803 (0.0799–0.0835) |
| v0.9.0 (bind:, text:) | 0.008 (0.0079–0.00919) | 0.0815 (0.0766–0.0856) |
| v0.9.0-rc1 (:on(input), event(value), bind(value)) | 0.0261 (0.0242–0.027) | 0.129 (0.124–0.133) |
| v0.9.0 (:on(input), event(value), bind(value)) | 0.0259 (0.0226–0.0273) | 0.13 (0.11–0.133) |
| plain JavaScript | 0.00559 (0.00514–0.00579) | 0.0915 (0.0846–0.0951) |

### mousemove snapshot, one element

| Implementation | scriptMsPerS | taskMsPerS | longTasks |
|---|---|---|---|
| v0.9.0-rc1 :on(mousemove) | 10.2 (6.88–10.4) | 58.5 (38.3–58.9) | 0 (0–0) |
| v0.9.0 :on(mousemove) | 8.49 (6–10.9) | 48.8 (33.7–61.9) | 0 (0–0) |
| plain JavaScript | 1.98 (1.81–2.58) | 28.6 (26.7–38.2) | 0 (0–0) |

### scroll snapshot (200 wheel steps)

| Implementation | scriptMsPerS | taskMsPerS |
|---|---|---|
| v0.9.0-rc1 :on(scroll) | 5.3 (4.88–6.92) | 25 (22.7–33.4) |
| v0.9.0 :on(scroll) | 5.93 (5.24–7.04) | 29 (23.7–34) |
| plain JavaScript | 1.12 (1.07–1.29) | 14.6 (13.8–17.5) |

## render

Measured 2026-10-21 22:53 UTC, 5 runs per cell.

### click → first observation (ms, median of 40 clicks)

| Implementation | styleMs | textMs | attrMs | focusMs | focusCount |
|---|---|---|---|---|---|
| v0.8.1 (0.8 syntax) | 15.6 (15.4–15.9) | 0.4 (0.3–0.5) | 0.4 (0.3–0.5) | 0.5 (0.4–0.6) | 20 (20–20) |
| v0.9.0-rc1 (0.9 syntax) | 15.5 (14.7–15.8) | 0.4 (0.3–0.5) | 0.4 (0.3–0.5) | 0.5 (0.4–0.6) | 20 (20–20) |
| v0.9.0 (0.8 syntax) | 15.8 (15.4–16) | 0.3 (0.2–0.4) | 0.3 (0.2–0.4) | 0.4 (0.3–0.5) | 20 (20–20) |
| v0.9.0 (0.9 syntax) | 15.7 (15–15.9) | 0.3 (0.2–0.6) | 0.3 (0.2–0.6) | 0.5 (0.3–0.8) | 20 (20–20) |

## lifecycle

Measured 2026-10-21 22:53 UTC, 5 runs per cell.

### 100 × mount/unmount of 500 components

| Implementation | retainedMB | bindings | states |
|---|---|---|---|
| v0.8.1 (0.8 syntax) | 0.456 (0.441–0.456) | 0 (0–0) | 0 (0–0) |
| v0.9.0-rc1 (0.9 syntax) | 0.445 (0.445–0.445) | 0 (0–0) | 0 (0–0) |
| v0.9.0 (0.9 syntax) | 0.444 (0.444–0.444) | 0 (0–0) | 0 (0–0) |

### 100 drags (50 persisted draggables)

| Implementation | retainedMBAfter100Drags |
|---|---|
| v0.9.0-rc1 | 0.521 (0.521–0.522) |
| v0.9.0 | 0.521 (0.521–0.521) |

### 100 stylesheet replacements (200 components)

| Implementation | retainedMB | sheets | bindings |
|---|---|---|---|
| v0.8.1 (0.8 syntax) | 0.482 (0.482–0.482) | 1 (1–1) | 400 (400–400) |
| v0.9.0-rc1 (0.9 syntax) | 0.607 (0.605–0.607) | 1 (1–1) | 800 (800–800) |
| v0.9.0 (0.9 syntax) | 0.618 (0.618–0.618) | 1 (1–1) | 800 (800–800) |
