# Reactive CSS 0.9.0 vs vanilla JavaScript

A quick, reproducible comparison of five small scenarios: counter, toggle, form mirror, drag, and 1,000 counters. It is isolated from the other benchmarks and overwrites nothing else.

**Run:**

```bash
npm run build
```

```bash
node benchmarks/vs-vanilla/run.mjs --runs=5
```

**Files:**
- `scenarios/<name>/`: `markup.html` and `shared.css` (identical for both), plus `reactive.css` or `vanilla.js`.
- `results/results.json`: raw medians and min–max per metric.
- `results/REPORT.md`: tables and conclusions.
