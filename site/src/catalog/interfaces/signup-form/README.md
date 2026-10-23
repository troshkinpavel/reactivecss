# Signup form

## What it demonstrates
Native form controls feeding a preview that is outside them. Each control copies its value into a state on the section with an `:on(input)` or `:on(change)` rule; the preview reads the states as DOM text.

## APIs used
- `state("")`, `state("basic")`, `state(false)` on `.signup`: the section contains both the controls and the preview, so both can use the states.
- `:on(input)` and `:on(change)` with `event(value)` and `event(checked)`: the control's value, read at the event.
- `:on(reset)`: the `reset` event bubbles from the form; this rule puts the states back.
- `content: var(--name)`: the preview text, as real DOM text *(experimental)*.
- `:when(--news)`: shows the badge.

## How to interact
Type a name, pick a plan, tick the checkbox, then press Reset.

## Expected result
The preview follows every change. Reset empties the field, selects Basic, clears the checkbox and returns the preview to "Your name · basic".

## Native CSS alternative
None for the preview: CSS can match `:checked`, `:placeholder-shown` or `:invalid`, but it cannot read a field's text or a select's value into another element.

## Limitations
- The copies are one-way: a change of `--name` from another rule does not change the field. For a field that must follow its state, use `state("", bind(value))` on the field itself (see the Form mirror example).
- If the browser restores the form after a reload, the preview shows the defaults until the next change.
