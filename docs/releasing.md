# Releasing

How `@reactivecss/core`, `@reactivecss/mcp` and the website are released, and what the
repository checks about it. Maintainers release with `git`, `gh`, `npm` and `wrangler`.
Contributors need none of this: CI checks the facts below on every pull request.

The three lifecycles are independent:

| Release | Version source | Publishes | Tag |
|---|---|---|---|
| Core | `package.json` | `@reactivecss/core` on npm, GitHub Release, then the website | `v<version>` |
| MCP | `packages/mcp/package.json` | `@reactivecss/mcp` on npm, then the website | `mcp-v<version>` (from 0.1.2; earlier MCP releases have no tag) |
| Website | none | the website only (Cloudflare) | none |

A Core release never publishes MCP. Publish MCP only when MCP itself changes. A Core release
always ends with a website deploy, so Core and documentation changes ship together. An MCP release
has no GitHub Release, so that Core's release stays "Latest".

## Sources of truth

| Fact | Where it is |
|---|---|
| Current versions | `package.json`, `packages/mcp/package.json` |
| Release notes | `CHANGELOG.md`, one `## <version>` section per Core release |
| What is published | npm, the CDNs and GitHub |
| What the site says is published | `site/config/distribution.json` (`npmVersions`) |
| MCP knowledge version | `packages/mcp/package.json` `reactivecss.knowledge` |

The current version is also stated in `src/core/version.ts`, both lockfiles, the README, the MCP
README, `docs/library-reference.md` and the installation page. The list is `VERSION_REFS` in
`scripts/release-check.mjs`. Historical mentions ("added in 0.9.0", old CHANGELOG sections) are
not in the list and never change.

## The consistency check

```bash
node scripts/release-check.mjs
node --test scripts/release-check.test.mjs
```

`release-check.mjs` reads files only: no network, and it never changes anything. CI runs both
commands. The check fails when:

- a file in `VERSION_REFS` states a different version than `package.json`;
- the newest CHANGELOG section is not the current Core version, or it still has the placeholder
  notes `- Describe the changes.`;
- `distribution.json` lists a version newer than `package.json`, out of order or twice, or lists a
  published Core version whose CHANGELOG heading is still marked "unpublished";
- the MCP knowledge version is neither published nor the current Core version, is outside
  `reactivecss.supports`, or the MCP README or the generated `AGENTS.md` disagree with it;
- after a build, the README bundle table disagrees with the minified sizes in `dist/` (gzip is not
  compared, because it differs between zlib versions).

It does not assume that the current version is published. A prepared but unpublished version
passes, and so does a published one. The site shows "Not on npm yet" until `distribution.json`
lists the version.

## Release rules

- **One reviewed commit.** The version change, its references and the release notes go through a
  pull request. All four CI jobs (`library`, `mcp`, `site`, `library-firefox`) pass before merge.
  Never bypass required checks.
- **Publish what was validated.** Pack the validated commit (`npm pack`) and publish that `.tgz`
  file (`npm publish <file>.tgz`), not a new build. The merge commit's tree must equal the packed
  commit's tree.
- **Record only what npm confirms.** A version is added to `distribution.json` only after
  `npm view` shows it with the shasum of the published tarball, in its own pull request
  ([site/README.md](../site/README.md#publication-state)). A failed or partial publish leaves the
  site in the "Not on npm yet" state.
- **MCP knowledge describes a published Core.** Set `reactivecss.knowledge` to a Core version that
  is already on npm, then run `npm run build` in `packages/mcp` to regenerate `AGENTS.md` and the
  skill.
- **Reconcile before you repeat.** External publication is not transactional. Before you repeat a
  step, ask npm, the tag on `origin`, GitHub and Cloudflare what already happened. npm never
  accepts the same version twice.
- **Deploy from a clean checkout** of a green `main` commit. Cloudflare credentials come from the
  environment, never from a file (`site/deploy/README.md`).

## Adding a version reference

If a new file states the current version, add it to `VERSION_REFS` in
`scripts/release-check.mjs`, and a case to `scripts/release-check.test.mjs`.
