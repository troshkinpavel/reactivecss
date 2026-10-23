# Step wizard

## What it demonstrates
One number state drives a multi-step flow from three directions: the step list, Next and Back. Next and Back compute their value at the click, clamped with `min()` and `max()`, so the step stays between 1 and 3.

## APIs used
- `state(1)` on `.wizard`: the current step.
- `:on(click)` with `set(sibling-index())`: the clicked step's position in the list.
- `set(min(var(--step) + 1, 3))` and `set(max(var(--step) - 1, 1))`: computed at the event, clamped.
- `:nth-var(--step)`: the current panel and the current step in the list.
- `--attr-aria-current: step` and `--attr-disabled: true`: real attributes for assistive technology and the Tab order *(experimental)*.

## How to interact
Use Next and Back, or click a step in the list.

## Expected result
One panel at a time; the current step is filled and has `aria-current="step"`. Back is disabled on step 1 and Next on step 3.

## Native CSS alternative
None: CSS has no counter that a button can change.

## Limitations
- The steps do not validate anything: this example shows navigation only.
