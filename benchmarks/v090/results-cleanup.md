# v0.8.1 vs v0.9.0 (rc1 and hardened)

Chromium 156.0.8078.4 · Apple M4 Max (14 cores) · runs per cell interleaved (ABAB…) · median (min–max)

## startup

Measured 2026-10-22 00:17 UTC, 5 runs per cell.

### 100 components (300 elements)

| Implementation | taskMs | scriptMs | styleMs | compileMs | heapMB |
|---|---|---|---|---|---|
| v0.8.1 (0.8 syntax) | 16.8 (16.3–17.6) | 4.91 (4.73–5.13) | 0.545 (0.536–0.579) | 1.1 (1–1.3) | 2.25 (2.24–2.26) |
| v0.9.0-hardened (0.9 syntax) | 17.6 (17.4–18.4) | 5.63 (5.62–6.03) | 0.567 (0.537–0.592) | 1.7 (1.6–1.8) | 2.36 (2.35–2.38) |
| v0.9.0 (0.8 syntax) | 17.4 (16.4–18.8) | 5.2 (5.02–5.5) | 0.551 (0.512–0.596) | 1.3 (1.3–1.5) | 2.32 (2.31–2.33) |
| v0.9.0 (0.9 syntax) | 17.6 (17.1–18) | 5.86 (5.41–5.91) | 0.58 (0.55–0.617) | 1.8 (1.6–1.9) | 2.35 (2.34–2.35) |
| v0.9.0 custom (events, conditions, attributes, text) | 17.6 (17–18.3) | 5.65 (5.37–5.81) | 0.567 (0.544–0.604) | 1.7 (1.5–1.8) | 2.25 (2.24–2.25) |
| no library | 7.87 (7.42–8.31) | 0.107 (0.091–0.138) | 0.26 (0.244–0.29) | 0 (0–0) | 0.949 (0.949–0.949) |

### 1000 components (3000 elements)

| Implementation | taskMs | scriptMs | styleMs | compileMs | heapMB |
|---|---|---|---|---|---|
| v0.8.1 (0.8 syntax) | 33.5 (33.3–33.9) | 11.8 (11.3–12.1) | 3.58 (3.53–3.62) | 1.3 (1.2–1.3) | 3.86 (3.84–3.88) |
| v0.9.0-hardened (0.9 syntax) | 34.4 (34.1–34.9) | 12.6 (12.1–12.8) | 3.65 (3.47–3.75) | 1.8 (1.7–2.1) | 4 (3.99–4.03) |
| v0.9.0 (0.8 syntax) | 34.6 (33.5–35.2) | 12.3 (11.6–12.7) | 3.52 (3.4–3.54) | 1.5 (1.3–1.8) | 3.94 (3.92–3.96) |
| v0.9.0 (0.9 syntax) | 34.7 (34.1–35.5) | 12.4 (11.9–12.7) | 3.54 (3.5–3.65) | 1.7 (1.6–1.9) | 3.98 (3.96–3.99) |
| v0.9.0 custom (events, conditions, attributes, text) | 34.3 (32.9–36.4) | 12.3 (11.9–13) | 3.52 (3.42–3.71) | 1.8 (1.5–1.9) | 3.86 (3.85–3.9) |
| no library | 15.3 (15.2–15.6) | 0.097 (0.079–0.11) | 1.67 (1.6–1.73) | 0 (0–0) | 0.949 (0.949–0.949) |

### 5000 components (15000 elements)

| Implementation | taskMs | scriptMs | styleMs | compileMs | heapMB |
|---|---|---|---|---|---|
| v0.8.1 (0.8 syntax) | 98.2 (95.4–100.3) | 32.3 (30.9–32.5) | 16.2 (15.8–16.7) | 1.2 (1.1–1.3) | 12.5 (12.4–12.6) |
| v0.9.0-hardened (0.9 syntax) | 97.4 (97–98.6) | 32 (30.9–32.8) | 16.6 (16.4–16.6) | 1.9 (1.6–1.9) | 13 (12.8–13.1) |
| v0.9.0 (0.8 syntax) | 97.8 (95.3–100.1) | 31.7 (30.2–32.8) | 16.4 (16.1–16.4) | 1.5 (1.2–1.5) | 12.9 (12.8–13) |
| v0.9.0 (0.9 syntax) | 97.4 (95.2–100) | 31.4 (30.8–32.8) | 16.6 (16.1–16.7) | 1.9 (1.8–2) | 12.9 (12.9–13.2) |
| v0.9.0 custom (events, conditions, attributes, text) | 98 (95.7–100.4) | 32.2 (30.7–32.9) | 16.6 (16.3–16.9) | 1.8 (1.7–1.9) | 12.8 (12.7–12.9) |
| no library | 48.5 (48.4–48.8) | 0.103 (0.094–0.106) | 7.6 (7.53–7.63) | 0 (0–0) | 0.949 (0.949–0.949) |

### 10000 components (30000 elements)

| Implementation | taskMs | scriptMs | styleMs | compileMs | heapMB |
|---|---|---|---|---|---|
| v0.8.1 (0.8 syntax) | 176.6 (174.5–178.3) | 56.3 (55.4–56.4) | 32 (31.6–32.2) | 1.2 (1.2–1.4) | 20.1 (20.1–20.2) |
| v0.9.0-hardened (0.9 syntax) | 179.1 (176.1–180.3) | 56.5 (56.2–58) | 32.4 (32.4–32.6) | 1.8 (1.7–2) | 20.6 (20.5–20.8) |
| v0.9.0 (0.8 syntax) | 177.3 (170–182.8) | 56.1 (53.2–58.7) | 31.9 (31.3–32.4) | 1.3 (1.1–1.5) | 20.5 (20.5–20.6) |
| v0.9.0 (0.9 syntax) | 179.4 (174.4–182.8) | 56.8 (55.9–58.5) | 32.6 (32–33) | 1.8 (1.7–2) | 20.5 (20.5–20.6) |
| v0.9.0 custom (events, conditions, attributes, text) | 178.5 (173.1–178.8) | 56.7 (55.1–57.3) | 32.4 (31.6–33) | 1.7 (1.6–1.9) | 20.4 (20.4–20.4) |
| no library | 88.8 (88.2–90.3) | 0.106 (0.101–0.121) | 14.8 (14.7–15.1) | 0 (0–0) | 0.949 (0.949–0.949) |

### 1000 components, one-feature bundles (v0.9.0)

| Implementation | taskMs | scriptMs |
|---|---|---|
| core + events | 27 (26.8–27.7) | 5.85 (5.62–6.1) |
| core + forms | 27.1 (27–27.9) | 5.61 (5.32–5.83) |
| core + focus (+ conditions for when()) | 27.5 (26.6–30.2) | 6.82 (6.6–8.28) |
| core + persist | 28 (27.5–29.4) | 7.01 (6.76–8.12) |
| core + events + gestures | 27.2 (26.8–28) | 5.97 (5.7–6.37) |

## click

Measured 2026-10-22 00:09 UTC, 5 runs per cell.

### 1000 components, 150 clicks

| Implementation | scriptMsPerClick | taskMsPerClick | latencyMedian | latencyP95 |
|---|---|---|---|---|
| v0.8.1 (0.8 syntax) | 0.0381 (0.0331–0.0402) | 0.85 (0.843–0.866) | 0 (0–0.1) | 0.1 (0.1–0.2) |
| v0.9.0-hardened (0.9 syntax) | 0.0423 (0.0406–0.0558) | 0.859 (0.83–1) | 0 (0–0.1) | 0.2 (0.1–0.2) |
| v0.9.0 (0.8 syntax) | 0.0408 (0.0372–0.0558) | 0.863 (0.823–1.05) | 0 (0–0.1) | 0.2 (0.1–0.2) |
| v0.9.0 (0.9 syntax) | 0.0412 (0.039–0.047) | 0.863 (0.846–0.937) | 0 (0–0) | 0.2 (0.1–0.2) |
| plain JavaScript | 0.0112 (0.0108–0.012) | 0.857 (0.833–0.866) | 0 (0–0) | 0.1 (0.1–0.1) |

### 1000 components, rules per element (v0.9.0)

| Implementation | scriptMsPerClick | taskMsPerClick | latencyMedian |
|---|---|---|---|
| one rule (no style read) | 0.0303 (0.0246–0.0319) | 0.411 (0.34–0.419) | 12.8 (12.3–13.4) |
| five competing rules (one style read) | 0.0324 (0.0278–0.0341) | 0.387 (0.347–0.409) | 12.9 (12.8–13.5) |

### 1000 components, four mutations per click (v0.9.0)

| Implementation | scriptMsPerClick | taskMsPerClick | latencyMedian |
|---|---|---|---|
| four mutations per click | 0.0418 (0.039–0.0453) | 0.404 (0.389–0.433) | 12.7 (12.2–13.4) |

## drag

Measured 2026-10-22 00:09 UTC, 5 runs per cell.

### one active drag among 1 candidates

| Implementation | scriptMsPerS | scriptMsPerMove | layoutCount | longTasks |
|---|---|---|---|---|
| v0.9.0-hardened :on(drag) | 8.24 (5.52–11.5) | 0.138 (0.0923–0.193) | 0 (0–0) | 0 (0–0) |
| v0.9.0 :on(drag) | 8.24 (4.78–11.8) | 0.138 (0.0801–0.199) | 0 (0–0) | 0 (0–0) |
| v0.9.0 custom (events, gestures) | 9.84 (6.43–11.5) | 0.165 (0.107–0.193) | 0 (0–0) | 0 (0–0) |
| plain JavaScript | 2.17 (1.28–2.45) | 0.0363 (0.0214–0.0411) | 1 (1–1) | 0 (0–0) |

### one active drag among 1000 candidates

| Implementation | scriptMsPerS | scriptMsPerMove | layoutCount | longTasks |
|---|---|---|---|---|
| v0.9.0-hardened :on(drag) | 9.79 (4.29–10) | 0.164 (0.0718–0.168) | 0 (0–0) | 0 (0–0) |
| v0.9.0 :on(drag) | 6.18 (5.33–9.46) | 0.103 (0.0892–0.159) | 0 (0–0) | 0 (0–0) |
| v0.9.0 custom (events, gestures) | 6.43 (4.63–8.91) | 0.108 (0.0775–0.149) | 0 (0–0) | 0 (0–0) |
| plain JavaScript | 1.34 (1.3–2.12) | 0.0225 (0.0218–0.0354) | 1 (1–1) | 0 (0–0) |

### persisted position, 300 moves

| Implementation | storageWrites | scriptMsPerMove |
|---|---|---|
| persisted --x | 21 (21–21) | 0.0752 (0.0706–0.0812) |

## idle

Measured 2026-10-22 00:17 UTC, 5 runs per cell.

### 10 s idle after start, 1000 components

| Implementation | scriptMs | taskMs | flushes | ticks |
|---|---|---|---|---|
| v0.8.1 (0.8 syntax) | 0 (0–0) | 0.342 (0.272–0.346) | 0 (0–0) | 0 (0–0) |
| v0.9.0-hardened (0.9 syntax, every new feature) | 0 (0–0) | 0.499 (0.453–0.537) | 0 (0–0) | 0 (0–0) |
| v0.9.0 (0.9 syntax, every new feature) | 0 (0–0) | 0.558 (0.535–0.846) | 0 (0–0) | 0 (0–0) |

## memory

Measured 2026-10-22 00:09 UTC, 5 runs per cell.

### 10,000 components mounted, then 10 × 1,000 mount/unmount

| Implementation | mountedMB | retainedMB | bindings | states |
|---|---|---|---|---|
| v0.8.1 (0.8 syntax) | 16.7 (16.7–16.8) | 1.22 (1.22–1.22) | 0 (0–0) | 0 (0–0) |
| v0.9.0-hardened (0.9 syntax) | 16.9 (16.9–16.9) | 1.23 (1.23–1.23) | 0 (0–0) | 0 (0–0) |
| v0.9.0 (0.8 syntax) | 16.9 (16.9–16.9) | 1.23 (1.22–1.23) | 0 (0–0) | 0 (0–0) |
| v0.9.0 (0.9 syntax) | 16.9 (16.9–16.9) | 1.23 (1.23–1.23) | 0 (0–0) | 0 (0–0) |

## compile

Measured 2026-10-22 00:09 UTC, 5 runs per cell.

### 500 event rules

| Implementation | compileMs | taskMs | replaceMs |
|---|---|---|---|
| v0.8.1 (on:) | 4.9 (4.5–6.6) | 20.1 (19.5–22.1) | 6.3 (5.9–7.5) |
| v0.9.0 (on:) | 5.1 (4.9–6.8) | 20.3 (19.9–22.7) | 6.4 (6–8.3) |
| v0.9.0-hardened (:on()) | 6.4 (6.1–7) | 21.7 (21.3–22.1) | 8.8 (7.6–10.4) |
| v0.9.0 (:on()) | 6.1 (5.9–6.3) | 21.3 (21–21.6) | 8.8 (7.6–9.1) |

### 2000 :when() selectors

| Implementation | compileMs | taskMs | replaceMs |
|---|---|---|---|
| v0.8.1 | 10.7 (10.5–11) | 44.9 (44.5–45.5) | 33.1 (31.3–34.4) |
| v0.9.0-hardened | 11.4 (11.4–12.9) | 46.1 (45–50.5) | 33.1 (32.5–42.4) |
| v0.9.0 | 11.3 (10.7–11.7) | 45.4 (44–46.3) | 33.6 (32.4–34.2) |

### 5000 native rules + one reactive rule

| Implementation | compileMs | taskMs | replaceMs |
|---|---|---|---|
| v0.8.1 | 26.6 (25.9–28.9) | 59 (58.1–62) | 47.3 (43.2–50.4) |
| v0.9.0-hardened | 28.1 (27.4–28.8) | 60.6 (60.2–64.4) | 46.2 (43.4–55.3) |
| v0.9.0 | 27.5 (27.5–28.3) | 61.2 (59.9–63.1) | 50.1 (46.2–54.9) |

### 5000 native rules only (the pre-filter path)

| Implementation | compileMs | taskMs | replaceMs |
|---|---|---|---|
| v0.8.1 | 0 (0–0) | 15.3 (14.5–16) | 4.8 (4.3–5.3) |
| v0.9.0-hardened | 0 (0–0) | 15.8 (15.6–16) | 4.8 (4.1–6.2) |
| v0.9.0 | 0 (0–0) | 15.8 (15.4–16.5) | 5.3 (3.5–6) |

## render

Measured 2026-10-22 00:17 UTC, 5 runs per cell.

### click → first observation (ms, median of 40 clicks)

| Implementation | styleMs | textMs | attrMs | focusMs | focusCount |
|---|---|---|---|---|---|
| v0.8.1 (0.8 syntax) | 14.9 (14.3–16) | 0.4 (0.2–0.6) | 0.4 (0.2–0.6) | 0.7 (0.3–0.7) | 20 (20–20) |
| v0.9.0-hardened (0.9 syntax) | 14.9 (14.5–15.9) | 0.5 (0.2–0.6) | 0.5 (0.2–0.6) | 0.7 (0.3–0.9) | 20 (20–20) |
| v0.9.0 (0.8 syntax) | 15.6 (14.2–15.8) | 0.4 (0.3–0.6) | 0.4 (0.3–0.6) | 0.4 (0.3–0.8) | 20 (20–20) |
| v0.9.0 (0.9 syntax) | 15.5 (15.1–15.7) | 0.4 (0.3–0.7) | 0.4 (0.3–0.7) | 0.5 (0.4–0.9) | 20 (20–20) |
