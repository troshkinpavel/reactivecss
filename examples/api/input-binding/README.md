# Input binding

API example 08. Open `index.html` through a local server (`npm run serve`, then `http://localhost:8080/examples/api/input-binding/`). Tests: `tests/browser/api-examples.spec.ts`.

## What it demonstrates
`bind:` connects a native text field to a state in both directions, and `text:` writes the state into the page as DOM text.

## APIs used
- `state("")`: the name, a string.
- `bind: --name`: updates the state on every input (after IME composition ends), and never rewrites the field while you type.
- `text: var(--name)` *(experimental)*: DOM text.
- `:when(--name == "")`: shows "stranger" while the field is empty.
- `content: var(--name)`: native generated content, for comparison only.

## How to interact
Type in the field. Then try to select or copy the two lines at the bottom, or find the name with the browser's Find.

## Expected result
- The greeting and both lines follow the field as you type, and show "stranger" when it is empty.
- Only the `text:` line is real text: you can select it, copy it and find it. The generated-content line looks the same but cannot be selected or found, and screen readers may skip it.

## Native CSS alternative
None for copying a field's value into the page. CSS cannot read a field's value (`:placeholder-shown` only tells empty from not empty). Without Reactive CSS this is an `input` listener.

## Limitations
- `text:` writes into elements that are empty or hold one text node. "Hello," and "!" stay in the HTML around a `<span>`.
- Changes are not announced unless the text is inside a live region.
