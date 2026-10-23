# Patch: `set(--x, mouse(x | y [, local]))`

The complete change set for the pointer-snapshot feature: `set()` stores the pointer position of the triggering event, once. It is not in 0.8.1 (a patch release adds no public API) and targets the next minor version. Design: [docs/rfc-pointer-snapshot.md](../../rfc-pointer-snapshot.md), which stays in the tree.

The diffs are against the tree as it was after the 0.8.1 edits (version in `src/core/version.ts`, the 0.8.1 CHANGELOG entry). They were tested on that tree: typecheck, unit tests (107), the dist tests, and the new and changed browser tests in Chromium and WebKit. A full `npm run verify` was stopped partway, with no failures up to that point.

## Contents

- `diffs/<path>.diff`: one unified diff per changed file (`a/<path>` → `b/<path>`):
  - **Runtime:**
    - `src/state/actions.ts`: the `mouse` source, `POINTER_TRIGGERS` and `pointerAt()`;
    - `src/core/registry.ts`: `ActionDef.compile(args, at)` and the `expressions` list for `describe()`;
    - `src/core/parser.ts`: passes `{ trigger, use }` to the action's `compile()`.
  - **Registry and catalog:**
    - `src/core/features.ts`: the `mouse` expression entry and the `set` syntax;
    - `src/features/catalog.ts`: `events` provides `expr:mouse`.
  - **Tests:** `tests/browser/api-examples.spec.ts` (the `context-menu` check, 16 → 17).
  - **Examples and docs:**
    - `examples/api/index.html`, `examples/api/README.md` and `examples/lab/index.html`: the example list;
    - `README.md`: the `set()` row and the "Pointer position on click" section;
    - `CHANGELOG.md`: an "Unreleased" section, inserted above 0.8.0. Move it above the newest entry when you reapply.
- `new/<path>`: the new files, at their paths in the tree:
  - `tests/unit/pointer-snapshot.test.ts`;
  - `tests/browser/pointer-snapshot.spec.ts`;
  - `examples/api/context-menu/{index.html,style.css,README.md}`.

## Reapply

From the repository root:

```bash
for d in $(find docs/patches/pointer-snapshot/diffs -name '*.diff'); do patch -p1 < "$d"; done
```

```bash
cp -R docs/patches/pointer-snapshot/new/ .
```

Then:
- Change `since: 'unreleased'` in `src/core/features.ts` and `data-since="unreleased"` in `examples/lab/index.html` to the new version.
- Rename the CHANGELOG section.
- Run `npm run verify`.

If a hunk does not apply because the files changed after 0.8.1, the change is small enough to redo by hand from the diff. The runtime part is about 40 lines in `src/state/actions.ts` and 10 in `src/core/registry.ts`.
