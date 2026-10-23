# Security policy

Reactive CSS reads stylesheets and, from them, changes state, element text, a fixed set of HTML attributes and focus, in response to DOM events. A flaw in that pipeline can matter to the pages that use it, so please report vulnerabilities privately.

## Supported versions

| Version | Supported |
|---|---|
| 0.9.x | Yes |
| Earlier | No (never published) |

## Reporting a vulnerability

Use GitHub's private vulnerability reporting: open the repository's **Security** tab and choose **Report a vulnerability**. Do not open a public issue.

Include the affected version or bundle, a minimal page that reproduces the problem, and its impact. You will get an answer when the report has been read. A fix and an advisory are published after a patched version is released.

## Scope

In scope, for example:

- CSS or attribute values that escape their string or declaration and inject markup, script, URLs or other declarations;
- writes to attributes outside the documented allowlist (event handlers, `href`, `src`, `style` and similar);
- behavior accepted from stylesheets that the trust model rejects (cross-origin sheets, or inline styles with `trustInlineStyles: false`);
- values of password, one-time-code or payment fields reaching CSS;
- problems that break a strict Content-Security-Policy.

Out of scope: problems that need an attacker to already control same-origin CSS or script. The runtime treats same-origin stylesheets as trusted, like scripts. See the trust model in [docs/security.md](docs/security.md).
