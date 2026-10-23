# API examples — small interactions (0.8.0)

Sixteen small pages, one Reactive CSS capability each, with the real runtime and no application JavaScript. They are the vocabulary of the library; the application-sized demos (configurator, wizard, quiz…) stay in `examples/<name>/` and the [demo lab](../lab/).

| # | Example | Primary API |
|---|---|---|
| 01 | [Counter](counter/) | `state()` `increment()` `decrement()` |
| 02 | [State history](state-history/) | `previous()` `direction()` |
| 03 | [Random colors](random-colors/) | `random()` `on()` |
| 04 | [Pick a value](pick-value/) | `pick()` `set()` |
| 05 | [Live values](live-values/) | `live()` `random()` |
| 06 | [Mouse tracker](mouse-tracker/) | `mouse()` |
| 07 | [Element size](element-size/) | `element()` `bind:` |
| 08 | [Input binding](input-binding/) | `bind:` `text:` |
| 09 | [Conditional styles](conditional-styles/) | `when()` `:when()` |
| 10 | [Dynamic attributes](dynamic-attributes/) | `attr:` |
| 11 | [Keyboard controls](keyboard-controls/) | `key()` `prevent()` |
| 12 | [Focus management](focus-management/) | `focus:` |
| 13 | [State selection](state-selection/) | `:nth-var()` |
| 14 | [Change animation](change-animation/) | `:changed()` |
| 15 | [Viewport tracking](viewport/) | `viewport()` |
| 16 | [Visibility detection](visibility/) | `visible()` |

- **Run:** `npm run serve`, then open `http://localhost:8080/examples/api/`.
- **Each folder:**
  - `index.html`;
  - `style.css`: layout first, then the Reactive CSS after a `/* ---- Reactive CSS ---- */` divider;
  - `README.md`: what it shows, how to try it, the expected result, the native alternative and the limits.
- **Shared look:** `api.css`, plain CSS with no Reactive CSS.
- **Tests:** `tests/browser/api-examples.spec.ts`. Every example runs under a strict CSP, with the full runtime and with the smallest custom bundle the analyzer picks for it.
- **Report:** [docs/api-examples-0.8.md](../../docs/api-examples-0.8.md).

These folders sit one level down (`examples/api/`), so the documentation site's demo sync, which copies `examples/<name>/`, does not pick them up. The site is unchanged.
