# Persistent preference

## What it demonstrates
A setting that is still selected after a reload. `persist("examples.density")` stores the state in `localStorage` and restores it when the page loads again.

## APIs used
- `state(comfortable, persist("examples.density"))` *(experimental)*: a keyword state, stored under the key `rcss:examples.density`. The key is used only by this example.
- `:on(click) { --density: set(compact) }`: each button sets one value.
- `--attr-aria-pressed: when(…)`: the selected button reports `aria-pressed="true"`.
- `:when(--density == compact)`: the list styles for the compact setting.

## How to interact
Choose Compact, then reload. Previews on this site run in a sandboxed frame without storage, so they cannot keep the setting: open the [standalone page](/examples/persistent-preference/standalone/) to try the reload.

## Expected result
On the standalone page the choice survives a reload. In the sandboxed previews the state works but resets on reload, and the runtime notes once that storage is unavailable.

## Native CSS alternative
None: CSS cannot store anything. Without Reactive CSS this needs a script that reads and writes `localStorage`.

## Limitations
- Storage is per browser and per origin: the setting does not follow you to another device or browser.
- Private browsing modes and sandboxed frames may block storage; the state then works without being kept.
