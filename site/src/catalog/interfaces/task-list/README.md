# Task list

## What it demonstrates
Native checkboxes with a reaction CSS cannot write: an animation that plays only when the user checks or unchecks a task, not when the page loads already checked.

## APIs used
- `state(false)` on `.task`: one state per task, readable by the label text.
- `:on(change)` with `event(checked)`: the checkbox's value at the change.
- `when(--done, 0.5, 1)`: the text fades when the task is done.
- `:just-checked` and `:just-unchecked`: match for one animation after a real change *(experimental)*.

## How to interact
Check and uncheck the tasks with the mouse or with Space.

## Expected result
A checked task fades and its text pops briefly; unchecking it settles back.

## Native CSS alternative
`:checked + span { opacity: 0.5 }` gives the fade without a script. The one-time animation on the change is what native CSS cannot express: `:checked` also matches a box that was checked on load.

## Limitations
- With reduced motion, the animations do not play; the fade stays.
