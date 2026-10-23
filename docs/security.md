# Security audit and CSP report (0.3.1)

Scope: all runtime code in `src/`, the stylesheet pipeline, the action, binding and condition parsers, and style injection. Method: code review, a grep for dangerous sinks, and browser tests with real response headers. Tests: `tests/browser/csp.spec.ts`, `tests/browser/security.spec.ts`, plus unit tests for the parsers.

## Findings

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | **High** | **Strict CSP broke pages.** Processing a stylesheet inserted a generated inline `<style>` copy and disabled the original. Under `style-src 'self'` (no `'unsafe-inline'`), the browser blocked the copy, while the original was already disabled. The page silently lost every rule of that stylesheet, including plain CSS. Verified in Chromium and WebKit before the fix. | **Fixed.** Stylesheets are rewritten in place through the CSSOM (`deleteRule`/`insertRule`), which CSP does not govern. No `<style>` is created. Tests: five CSP modes, zero violations caused by the library. |
| 2 | **Medium** | **`bind:` exposes live control values to CSS.** Native CSS can match only a control's `value` *attribute*. With `bind:`, CSS can read the typed value. Injected CSS could combine `bind:` with `:when(--pw == "a…")` and a conditional `background: url(…)` to leak a password one character at a time. | **Fixed.** `bind:` refuses `type="password"` and `autocomplete` tokens `current-password`, `new-password`, `one-time-code`, `cc-*`, `webauthn`. Test: typing into such fields never reaches CSS. |
| 3 | **Medium** | **Same-origin is not the same as trusted.** Behavior was accepted from every inline `<style>`. A site that renders user-provided `<style>` content would accept the user's `on:`/`bind:`. | **Mitigated.** Optional `ReactiveCSSConfig.trustInlineStyles: false` accepts behavior only from same-origin `<link>` stylesheets. The default is unchanged (zero config). Documented: user-uploaded CSS must not be served from the page's origin. |
| 4 | Low | **CSP violation noise from the native `random()` probe.** The feature probe used `innerHTML` with `style=""` attributes, which a policy with `style-src-attr` reports as a violation. It also caused a false "not supported" result. | **Fixed.** The probe uses CSSOM (`element.style.setProperty`). |
| 5 | Info | Action, event and function lookups. | **No issue.** All registries are `Map`s, so `constructor`, `__proto__`, `toString` and `hasOwnProperty` resolve to nothing and are reported as unknown. Tested. |
| 6 | Info | Action values. | **No issue.** Values are literals (`parseTyped`) or `sibling-index()`/`sibling-count()`. Any other call, such as `javascript:alert(1)`, rejects the whole declaration at compile time. Tested. |
| 7 | Info | User text reaching CSS. | **No issue.** Strings are serialized as quoted CSS strings with `"`, `\` and newlines escaped, and written through `style.setProperty` on a custom property. Text cannot leave the value. Tested with a breakout attempt. |
| 8 | Info | Dangerous sinks. | **None found.** No `eval`, `new Function`, `innerHTML`, `insertAdjacentHTML`, `document.write`, `setAttribute('style')`, storage, cookies, `postMessage` or dynamic `import()`. The only `fetch` reads a stylesheet that the page itself links, with the link's own credentials mode. |
| 9 | Info | `closest(selector)` scopes. | **No issue.** The selector is used only with `element.closest()`, so it reaches the acting element's ancestors only. Invalid selectors are caught and reported. |

## Trust model

- Behavior (`on:`, `bind:`) can change declared state cells and bound controls' own values, nothing else.
- It is accepted from same-origin linked stylesheets, and from inline `<style>` unless `trustInlineStyles: false`. It is ignored in cross-origin stylesheets, even with CORS.
- The stylesheet's origin is a *necessary* condition, not a sufficient one. If untrusted parties can author CSS on your origin, that CSS is trusted by this rule. Treat it like script injection: keep user CSS off your origin, and set `trustInlineStyles: false` when you render user HTML that may contain `<style>`.
- Shadow-root stylesheets and `@import`ed sheets are not processed, so behavior is never taken from them.
- **Attribute expressions (0.5).** `attr()` inside `state()` and `set()` follows the same trust rule (refused in untrusted sheets; `set()` is part of `on:`). Attribute values are data: they become one CSS string with quotes, backslashes and every control character escaped, so they cannot end the string, add declarations or become actions (tested in Chromium and WebKit with `"; color: red`, `}</style><script>…` and newlines; NUL and other control characters in unit tests). Password, one-time-code and payment fields are never read (the fallback is returned), the same rule as `bind:`. Native `attr()` elsewhere in a stylesheet is untouched; note that the browser forbids native `attr()` in `url()`, while a string copied into a state is an ordinary string: do not build URLs from attribute-derived states.

- **Attribute binding (0.5.2).** `state(…, bind(attribute))` writes HTML attributes, so it follows the `on:`/`bind:` trust rule (refused in untrusted sheets). It writes only to the state's owner and only `aria-expanded`, `aria-pressed`, `aria-selected`, `aria-current`, `disabled`, `hidden`, `required` and `data-*` (lower-case names). Never event handlers, URL attributes (`href`, `src`, `action`, `formaction`), `style`, `class`, `id`, `role` or free-text ARIA. Values go through `setAttribute()` as text. A keyword state initialized from a `data-*` attribute must be an identifier, so an attribute cannot inject `url(...)` or `;` into the CSS value. Changes to bound attributes never re-match reactive rules, which prevents style → DOM → style loops. Tested in `v052.spec.ts` (markup injection, `url()` keywords, untrusted sheets, strict CSP, attribute-selector loops).
- **Derived attributes (0.5.3).** `attr: <attribute> <value>` writes HTML attributes on the elements a rule matches, so it follows the same trust rule: it is refused in untrusted sheets. It uses the same allowlist, and the attribute name is checked at compile time; anything else is a compile error and the declaration is left unchanged. The value is one computed token, written with `setAttribute()`/`toggleAttribute()` as text: `"<img src=x onerror=alert(1)>"` stays a `data-*` string, and no child nodes are created. `attr()` and `url()` are not allowed in the value.
  - **No loops:** attributes written by `attr:` never re-match reactive rules. Rules whose selectors read a written attribute are re-read at most once more in the same task and once in the frame.
  - **No stale writes:** a removed element's binding is disposed and its attribute restored; a queued read after disposal does nothing.
  - **No fights:** another writer (a script, a `state(…, bind())`) is detected, and `attr:` yields.
  - **Tests:** `v053.spec.ts` (unsafe names, markup values, untrusted sheets, strict CSP, a page MutationObserver, attribute-selector loops).
- **Declarative focus (0.6.0).** `focus:` moves focus, a DOM side effect, so it follows the trust rule: it is refused in untrusted sheets.
  - **No selector strings:** the target is the element its rule matched; nothing is queried at runtime from a string.
  - **No cycles, no stealing:** focus moves only on a false → true change caused by a *trusted* user `click`/`keydown`/`input`/`change` (`isTrusted`; scripted events never qualify). Focus events never arm it. It never takes focus from where the user moved it, from an open dialog or popover, or from inside the target.
  - **No native bypass:** it calls `element.focus()` and accepts the browser's answer (inert, disabled, not focusable, other frames). It never adds `tabindex` and never crosses frames (bindings exist only in the document whose sheet declared them).
  - **No leaks:** removed elements drop their record and pending request.
  - **Tests:** `v060.spec.ts`.
- **New attributes (0.6.0).** `aria-disabled` is text `"true"`/`"false"`. `tabindex` accepts only `0` and `-1`: positive values, which would hijack the page's Tab order, are refused.
- **Event cancellation (0.7.0).** `prevent()` is part of `on:`, so untrusted stylesheets cannot use it (tested). It can only cancel the default of the current event, synchronously; it cannot stop propagation, so page listeners still run. To protect native interaction:
  - it is limited to `click` and `key()`;
  - it never cancels in `outside()`, so a rule cannot block clicks elsewhere on the page;
  - it never cancels events that happened outside the element;
  - it never cancels keys in form controls it does not own.

  A rule on a container that cancels clicks on links or buttons inside it is reported in development builds. Navigation and form submission are cancelled only where an author wrote `prevent()` for that element's click. The listener is non-passive only for event types that a live rule cancels.

## CSP compatibility

| Mechanism | Used | CSP directive involved |
|---|---|---|
| Rewriting existing stylesheets through the CSSOM (`deleteRule`/`insertRule`) | yes | none: CSSOM edits are not governed by `style-src` |
| `element.style.setProperty()` for custom properties | yes | none: only `style=""` attribute *parsing* is governed by `style-src-attr` |
| Marker attributes (`data-rcss-*`) | yes | none |
| `CSS.registerProperty()` | yes (`on:`, `state()`, `typed()`) | none |
| `fetch()` of linked stylesheets | yes | `connect-src` must allow the URL (`'self'` does) |
| Creating `<style>` elements, `style=""` attributes, constructable or adopted stylesheets | no | — |

Tested policies (Chromium 156 and WebKit 27.2, real `Content-Security-Policy` headers):
1. none;
2. `script-src 'self'; object-src 'none'; base-uri 'none'`;
3. `default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'`;
4. `default-src 'none'; script-src 'nonce-…'; style-src 'nonce-…'` with `<style nonce>`;
5. policy 3 plus `style-src-attr 'none'`, with an author `<style>` that the policy blocks.

In all five, reactive values, state, `on:` and `when()` work. No violation is caused by the library. A blocked author stylesheet stays blocked and is reported.

Unsupported: applying a stylesheet the policy blocks, `file://` pages, and cross-origin stylesheets without CORS.
