# Deploying the site to Cloudflare

The site is fully static (`output: 'static'`, no adapter, no server code). It is served by a
Cloudflare Worker with Static Assets, configured in [`../wrangler.jsonc`](../wrangler.jsonc):

| Worker | Hostname | Status |
|---|---|---|
| `reactivecss-site-staging` (`--env staging`) | `reactivecss-site-staging.troshkinp.workers.dev`, behind Cloudflare Access | live and Access-protected; version `2273ad67` deployed 2026-10-23 |
| `reactivecss-site` (production) | `reactivecss.com` (custom domain) | live since 2026-10-23 |

No credentials are stored in this repository. Wrangler reads `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` from the environment. Do not write them to `.env`, `.dev.vars` or any
other file in the repository. `.wrangler/` (local state) is ignored by `.gitignore`.

## Build

The site needs the library's build in `../dist`:

```sh
npm ci && npm run build            # repository root: library
cd site && npm ci && npm run build # site/dist (Astro + Pagefind), includes public/_headers
```

Local check (no Cloudflare account needed): `npx wrangler@4 dev` in `site/`.

## API token

Create a custom API token (Cloudflare dashboard, My Profile, API Tokens):

- Permissions: Account, Workers Scripts, Edit.
- Account resources: include only the Reactive CSS account.
- No zone permissions. The production custom domain is added once in the dashboard (see Launch).

The token cannot be limited to one Worker. Keep it in a shell variable for a manual deploy, or
in GitHub environment secrets for CI. Never in a file.

## Staging (one-time setup)

Do these steps in this order, so the real site is never on a public URL:

1. Deploy a placeholder (no site content) to create the Worker:
   `npx wrangler@4 deploy --env staging --assets ./deploy/staging-placeholder`
2. Dashboard: Workers & Pages, `reactivecss-site-staging`, Settings, Domains & Routes,
   `workers.dev`: enable Cloudflare Access.
3. Zero Trust, Access, Applications: open the application that step 2 created. Give it its own
   Allow policy that lists only the team's e-mail addresses. Do not change existing
   account-wide policies.
4. Verify in a private window, and with
   `curl -sI https://reactivecss-site-staging.<account-subdomain>.workers.dev/`:
   the response must be a redirect to `<team>.cloudflareaccess.com`, not `200`.
5. Only then deploy the site: `npm run build && npx wrangler@4 deploy --env staging`.

Repeat step 4 after any change to the staging Worker's domains.

## Launch (production)

Before this, check the existing `reactivecss.com` DNS records for the apex and `www`.
A custom domain cannot replace an existing record for the same hostname.

1. `npx wrangler@4 deploy --env=""` (creates `reactivecss-site`, no public URL yet).
2. Dashboard, `reactivecss-site`, Domains & Routes: add custom domain `reactivecss.com`.
   Then add the same route to `wrangler.jsonc`:
   `"routes": [{ "pattern": "reactivecss.com", "custom_domain": true }]`.
3. `www.reactivecss.com`: in the `reactivecss.com` zone only, add a proxied DNS record
   (`AAAA www 100::`) and a Single Redirect rule: hostname equals `www.reactivecss.com`,
   301 to `concat("https://reactivecss.com", http.request.uri.path)`, preserve query string.
4. `reactivecss.com` zone, SSL/TLS: Always Use HTTPS on, minimum TLS 1.2.
5. Check `/`, `/playground/`, `/experiments/perihelion/`, a docs page without its trailing
   slash (must redirect), an unknown path (must show the 404 page), and search.

Caching: Workers Static Assets serves HTML with revalidation and ETags. `public/_headers` makes
the content-hashed `/_astro/*` files immutable. No zone cache rules are needed.

## CI

[`deploy-site.yml`](deploy-site.yml) is a template and is not active. To activate it:

1. Create GitHub environments `staging` and `production`. Give `production` required reviewers
   and limit it to the `main` branch.
2. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as secrets of each environment.
3. Move the file to `.github/workflows/`.

Pushes to `main` deploy staging. Production deploys only from a manual run with target
`production`, after a reviewer approves.
