# Reactive CSS 0.3.1 — Stability & Compatibility

*Release candidate, verified locally. Not published.*

A maintenance release focused on browser compatibility, secure stylesheet handling, correct CSS cascade behavior, reliable state-change animations, and production verification. **No new public API features**, and no syntax changes.

## Highlights

- **Works under strict Content-Security-Policy.** Reactive CSS now rewrites your stylesheets in place through the CSSOM instead of injecting a `<style>` copy. With `style-src 'self'`, 0.3.0 silently lost whole stylesheets; 0.3.1 needs no `'unsafe-inline'`, no hash and no nonce. Tested with five real policies, with zero violations caused by the library.
- **Better cascade fidelity.** The processed stylesheet *is* your stylesheet: `media`, `disabled` (also toggled at runtime), alternate sets, `@import`, layer order, URL base and `document.styleSheets` behave natively.
- **Safer bindings.** `bind:` never exposes password, one-time-code or payment fields to CSS. Pages that render user-provided `<style>` can set `ReactiveCSSConfig.trustInlineStyles = false`. See [security.md](security.md) for the audit.
- **Clearer diagnostics.** Every compile warning names its stylesheet, the construct and a fix.
- **Verified distribution.** The minified bundle is tested alone on a plain HTML page. The ESM build is tested from Node, and the type declarations from a TypeScript consumer.
- **More accessible demos.** A native switch, a radio-group "tabs" variant, named buttons, and honest notes on what CSS cannot announce.

## Compatibility

Chromium 156 and WebKit 27.2 (Playwright engines on macOS 27, arm64): all tests pass. **Firefox: unverified**, because Playwright's Firefox does not start on the test machine. Details: [compatibility.md](compatibility.md).

## Performance

The core workloads at 10, 100, 1,000 and 10,000 elements are unchanged from 0.3.0 within run-to-run variance. Every run cleans up to zero bindings, states and subscriptions. Numbers: README → Performance, [benchmarks/results.md](../benchmarks/results.md), and the 0.3.0 results in `benchmarks/baseline/results-v0.3.0.json`.

## Upgrading from 0.3.0

Nothing to change. One observable difference: the page no longer has an extra `<style data-rcss>` per processed stylesheet. Code that read the generated element should read the original sheet's CSSOM instead.
