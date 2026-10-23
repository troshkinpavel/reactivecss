# Form mirror

## What it demonstrates
A field copied into a state that its neighbors can read. Typing writes the field's value into a state on the form, the preview reads that state as DOM text, and the Clear button resets the form and the state together.

`state("", bind(value))` gives the input a state of its own, kept equal to the field in both directions. Only the input and its descendants can read that state, and an input has no children, so the field uses it to style itself. The preview beside it reads a second state on the section around the form, which an `:on(input)` rule fills with `event(value)`. See the [bind() reference](/docs/reference/bind-state/).

## APIs used
- `state("", bind(value))` on the input: the field and `--typed` stay equal in both directions; the field's border reads it.
- `state("")` on `.mirror`: the section owns the state, so both the field and the preview, which are inside it, can use it.
- `.mirror input:on(input) { --name: set(event(value)) }`: each keystroke copies the field's value into the state.
- `content: var(--name)` *(experimental)*: the preview text.
- `.mirror:on(reset) { --name: set("") }`: the native reset empties the field; the `reset` event bubbles from the form to the section, whose rule clears the state.

## How to interact
Type a name, then press Clear.

## Expected result
The preview shows what you type, or "stranger" when the field is empty. Clear empties both the field and the preview.

## Native CSS alternative
None: CSS can match `:placeholder-shown` or `:invalid`, but it cannot read a field's text into another element.

## Limitations
- The copy is one-way: a change of `--name` from another rule does not change the field. For a field that must follow the state, use `state("", bind(value))` on the field itself.
- The value is not stored: a reload empties the field (unless the browser restores form fields, in which case the preview stays at "stranger" until the next keystroke).
