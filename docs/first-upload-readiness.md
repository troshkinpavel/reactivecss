# First GitHub upload: readiness (0.9.0)

Internal report, 2026-10-23. Target: `https://github.com/troshkinpavel/reactivecss` (private first), branch `main`. Nothing was initialized, staged, committed, pushed or published.

## Repository

| | |
|---|---|
| Git | **Not initialized.** No `.git` anywhere in the project, no submodules, no remote. |
| First commit | **1,254 files, 37.8 MB** at the last count (1,248 at the first: this report and five deployment files from a parallel session were added since). Computed with the real ignore rules: a throwaway Git directory in a temporary folder, with the project as a read-only work tree (`git ls-files --others --exclude-standard`). |
| Largest files | Screenshot baselines in `site/tests/e2e/visual.spec.ts-snapshots/`, up to 1.09 MB (`home-1440`). No file is over 1.1 MB. Binaries: 48 PNGs (baselines), 16 JPGs (`site/docs/audits/screens/`), 1 PNG (`site/public/og/`). |
| Secret scan | Clean, over the exact 1,248 files. No npm, GitHub, AWS, Slack, Stripe or Anthropic tokens, private keys, JWTs or credential literals, and no local paths (`/Users/`, `/private/tmp`, `file:///`). The only email address is the author's, in the `author` field of both `package.json` files (intended). Examples use `example.com`. |

**Absent from the first commit** (each 0 files):
- `site/design-source/` and `site/admin/`;
- `site/tests/admin/`, `site/tests/unit/admin-*.test.ts` and `site/playwright.admin.config.ts`;
- the admin docs `site/docs/admin-*.md`;
- root `experiments/`;
- every `node_modules/` and `.env*`;
- the build outputs `dist/`, `packages/mcp/dist/` and `site/dist/`;
- the generated `site/src/generated/`, `site/public/embed/` and `site/public/runtime/*.js`;
- the local files `.idea/`, `.claude/`, `.DS_Store`, `test-results/`, `*.tgz` and `storybook-static/`.

**Present:**

Added by a parallel session during this pass, and audited:
- `site/wrangler.jsonc`: Cloudflare Worker static assets. It has no account ID, token or secret; Wrangler reads them from the environment. `workers_dev` and preview URLs are off for production.
- `site/public/_headers`: security and cache headers.
- `site/deploy/`: a README, a staging placeholder page and `deploy-site.yml`. The workflow is a **template outside `.github/workflows/`**, so GitHub does not run it. It deploys only with repository secrets that do not exist yet.

`.wrangler/` and `.dev.vars` are ignored (rules added by the same session), so local Wrangler state and dev secrets cannot be committed.


| Path | Files |
|---|---:|
| `src/` | 57 |
| `tools/` | 4 |
| `tests/` (including `tests/dist/`, 3) | 58 |
| `packages/mcp/`: `src/`, `scripts/`, `knowledge/`, `skills/`, `test/`, manifest, lockfile, README, AGENTS.md, LICENSE | 23 |
| `site/src/` | 414 |
| `site/experiments/perihelion/` | 3 |
| `site/src/pages/experiments/` | 2 |
| `site/config/` | 6 |
| `site/tests/` | 77 |
| `examples/` | 136 |
| `docs/` | 61 |
| `benchmarks/` | 291 |
| `.github/workflows/test.yml` | 1 |
| `codepen/` | 28 |

The root files are all present: README, LICENSE, SECURITY, CONTRIBUTING and CHANGELOG.

### `.gitignore` changes in this pass
- **`dist/` is anchored:** `/dist/` and `/packages/mcp/dist/`. The unanchored rule would also have ignored `tests/dist/`, the distribution tests' sources.
- **`site/design-source/support.js` → `/site/design-source/`:** the whole Claude Design export stays local. Nothing in the build reads it: the only references are comments and dev-only scripts (`visual-review`, `capture-design`, `convert-*`).
- **The Control Center rules are anchored,** and admin unit tests are matched as `admin-*.test.ts`. The two admin-only docs (`site/docs/admin-control-center.md`, `admin-release-workflow-validation.md`) are excluded too. `site/config/*.json` stays tracked: the public build reads it.
- **`/experiments/`** keeps its leading slash, so `site/experiments/` and `site/src/**/experiments/` are tracked.

## Packages

| | `@reactivecss/core` 0.9.0 | `@reactivecss/mcp` 0.1.0 |
|---|---|---|
| Build | pass | pass |
| Typecheck | pass | pass |
| Tests | 196 unit, 3 dist, TypeScript consumer | build + unit + protocol, clean-install consumer test |
| `npm pack --dry-run` | 134 files, 1,006,856 B packed (`dist` 66, `src` 57, `tools` 3, 4 docs, README, CHANGELOG, LICENSE) | 9 files, 154,484 B packed (`dist` 4, AGENTS.md, skills, README, LICENSE) |
| Metadata | Name, version, MIT, author, repository, homepage, bugs, `engines` ≥ 22, `publishConfig.access: public` | The same, with `repository.directory: packages/mcp` and `reactivecss.supports: 0.9.x` |
| Entry points | `.`, `./auto`, `./bundle`, `./catalog.json`; bin `reactive-css` | bin `reactivecss-mcp` → `dist/index.js` |

- **Clean checkout:** every row above was run in a copy of exactly the 1,248 files, with `npm ci` from the lockfiles and no `node_modules`, `dist` or generated files carried over.
- **Old identifiers that remain on purpose:**
  - the browser bundle files `reactive-css*.js`;
  - the CLI `reactive-css`;
  - the bundle manifest field `"name": "reactive-css"`, which the CLI writes;
  - the site package `reactive-css-site` (private).
- **Fixed in this pass:** `docs/bundle-builder-0.8.md` ships in the npm package, and it still imported `reactive-css/bundle` and `reactive-css/catalog.json`. Both now use the `@reactivecss/core/…` exports.

## Website

- **Clean checkout:**
  - `npm ci`, typecheck (0 errors) and 369 unit tests pass (the 50 Control Center tests are excluded with the admin);
  - the production build passes (113 pages);
  - targeted e2e passes: experiments, admin exclusion, homepage and bundle CLI, 46 tests in Chromium.
- **Fixed:** `npm run typecheck` and `npm test` now run `sync-runtime` first, as `dev` and `build` already did. In a fresh checkout, `src/generated/` does not exist until the sync runs.
- **Caveat:** Vitest 5 keeps a module cache in `node_modules/.vitest-cache`. A run made before the sync cached an empty `import.meta.glob`. Delete that folder if a glob target is ever missing in a run and added later. A fresh checkout and CI are not affected.
- **Public experiments are included:** `site/experiments/perihelion/` (`index.html`, `style.css`, README: source, not generated output), `site/src/pages/experiments/`, `site/src/components/experiments/` and `site/src/lib/content/experiments.ts`.
- **Control Center and design sources are excluded.** `site/tests/e2e/admin-exclusion.spec.ts` (public) checks that the build serves no admin route or code. The site README no longer links the admin docs or the design folder.

## CI (`.github/workflows/test.yml`)

On the first push to `main` and on every pull request, with `contents: read`, no secrets, and no publish or deploy step:

| Job | Steps |
|---|---|
| `library` | `npm ci`, typecheck, unit, build, dist tests, `npm pack --dry-run`, Playwright in Chromium and WebKit |
| `mcp` | Library build, then in `packages/mcp`: `npm ci`, typecheck, build with unit and protocol tests, consumer test, `npm pack --dry-run` |
| `site` | Library build, then in `site`: `npm ci`, typecheck, unit, build, Playwright in Chromium with `--ignore-snapshots` (the baselines are macOS ones) |
| `library-firefox` | `continue-on-error`: informational until Firefox has passed once |

- **Caching:** npm caching through `actions/setup-node`.
- **Configuration needed:** none beyond Actions being enabled for the repository.
- **Not yet verified:** the workflow has not run on GitHub; its YAML parses. The site suite has never run on Linux.

## Blockers

**Before the first private push:** none.

**Before making the repository public:**
1. Review `codepen/`, which a parallel session added. It holds 12 demos and a copy of the 0.9.0 runtime, byte-identical to the build apart from a header comment. Nothing references it.
2. Decide whether the internal reports stay public. Candidates: `docs/release-*`, `docs/github-release-preparation.md`, `docs/first-upload-readiness.md`, `docs/mcp-release-preparation.md`, `site/docs/audits/`, `site/docs/release-0.9.0-website-readiness.md`. None of them contains a secret.
3. Clear or accept the `notes` and `workflow` fields in `site/config/releases.json`. The build strips them, but they are readable in the repository.
4. Enable private vulnerability reporting, which `SECURITY.md` relies on.
5. Let CI run once, and fix the first Linux run of the site suite.

**Before npm publication:** confirm that the publishing account owns `@reactivecss`. Run a final build and `npm pack` from a clean checkout. Change the changelog heading from "(local, unpublished)". Decide whether to add a `./compact` export.

**Later:** visual baselines for Linux, so CI can compare screenshots. A first Firefox pass. Real-client checks of the MCP server (Claude Code, Cursor, VS Code).

## First-push commands (not run)

```bash
cd /Users/pt/Desktop/Projects/CLAUDE/css-functions
```

```bash
git init -b main
```

```bash
git add -A
```

```bash
git ls-files | wc -l
```

```bash
git ls-files | grep -E '^(site/design-source|site/admin|site/tests/admin|experiments|dist|packages/mcp/dist|site/dist)/|node_modules/|\.env'
```

Expect about 1,254 files (more if files were added since), and no output from the second check. Then:

```bash
git commit -m "Reactive CSS 0.9.0: library, MCP server and website"
```

```bash
git remote add origin https://github.com/troshkinpavel/reactivecss.git
```

```bash
git push -u origin main
```
