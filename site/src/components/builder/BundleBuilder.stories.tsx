import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { measuredFor, resolve } from '~/lib/bundles/catalog';
import { DEFAULT_OUT, type BuildChoice } from '~/lib/bundles/command';
import { AnalyzerPanel, BundleBuilder, BundleSummary, ConfigOutput, FeatureSelector, PresetPicker } from './BundleBuilder';

const meta = { title: 'Bundle Builder', parameters: { layout: 'padded' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const wide = (node: React.ReactNode) => <div className="mx-auto max-w-[1200px]">{node}</div>;
const buildCode = (el: HTMLElement) => el.querySelector('[data-output="2 · Build"] code')!.textContent;

/** The whole configurator, starting empty (the core alone). */
export const Builder: Story = {
  render: () => wide(<BundleBuilder />),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole('checkbox', { name: /Core & state/ })).toBeDisabled();
    await expect(buildCode(canvasElement)).toBe(`npx reactive-css build --features core --out ${DEFAULT_OUT}`);
    await userEvent.click(c.getByRole('checkbox', { name: /Declarative focus/ }));
    const events = c.getByRole('checkbox', { name: /Events & actions/ });
    await expect(events).toBeChecked();
    await expect(events).toBeDisabled();
    await expect(events).toHaveAccessibleDescription(/required by Declarative focus/);
    await expect(buildCode(canvasElement)).toContain('--features focus');
    await expect(c.getByText(/Exact size available after building/)).toBeVisible();
    await userEvent.click(c.getByRole('button', { name: 'Reset' }));
    await expect(events).not.toBeChecked();
    await expect(buildCode(canvasElement)).toContain('--features core');
  },
};

/** Profiles select their real feature lists and build with --profile. */
export const Presets: Story = {
  render: () => {
    const [selected, setSelected] = useState<string[]>([]);
    return <div className="flex flex-col gap-4">
      <PresetPicker selected={selected} onPick={(p) => setSelected(resolve({ profile: p }).features.filter((f) => f !== 'core'))} onReset={() => setSelected([])} />
      <output data-selected-list>{selected.join(',')}</output>
    </div>;
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: /^Forms/ }));
    await expect(c.getByRole('button', { name: /^Forms/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(canvasElement.querySelector('[data-selected-list]')!.textContent).toBe('events,forms,text,attributes');
    await userEvent.click(c.getByRole('button', { name: /^Stateful interfaces/ }));
    await expect(c.getByRole('button', { name: /^Forms/ })).toHaveAttribute('aria-pressed', 'false');
  },
};

/** A required feature is checked, locked, and says which feature needs it. Experimental is a word, not a color. */
export const RequiredDependency: Story = {
  render: () => wide(<FeatureSelector selected={['focus']} resolved={resolve({ features: ['focus'] })} onToggle={() => {}} />),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole('checkbox', { name: /Events & actions/ })).toBeDisabled();
    await expect(c.getByText('Included automatically: required by Declarative focus.')).toBeVisible();
    await expect(c.getByText('Works with Form bindings (optional, not added).')).toBeVisible();
    await expect(c.getAllByText('experimental').length).toBeGreaterThan(0);
  },
};

export const MeasuredSize: Story = {
  name: 'Summary · measured profile',
  render: () => wide(<BundleSummary selected={['events']} resolved={resolve({ features: ['events'] })} />),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole('table')).toBeVisible();
    await expect(c.getByRole('rowheader', { name: 'minified' })).toBeVisible();
    // The library's measured size for exactly these features (core, events).
    await expect(canvasElement.querySelector('[data-size]')!.textContent).toContain(measuredFor(resolve({ features: ['events'] }).features)!.minified.toLocaleString('en-US'));
  },
};

export const UnmeasuredSize: Story = {
  name: 'Summary · not measured',
  render: () => wide(<BundleSummary selected={['events', 'text']} resolved={resolve({ features: ['events', 'text'] })} />),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Exact size available after building/)).toBeVisible();
    await expect(canvasElement.querySelector('table')).toBeNull();
  },
};

/** An invalid output path is reported on its field; the commands keep the last valid one. Copy gives feedback. */
export const Output: Story = {
  render: () => {
    const [choice, setChoice] = useState<BuildChoice>({ selected: ['text'], out: DEFAULT_OUT, format: 'iife', minify: true });
    return wide(<ConfigOutput choice={choice} onChange={setChoice} />);
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const input = c.getByLabelText('Output file');
    await userEvent.clear(input);
    await userEvent.type(input, '../x.js');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toHaveAccessibleDescription(/relative path ending in .js/);
    await expect(buildCode(canvasElement)).toContain(`--out ${DEFAULT_OUT}`);
    await userEvent.clear(input);
    await userEvent.type(input, 'static/rcss.js');
    await expect(buildCode(canvasElement)).toBe('npx reactive-css build --features text --out static/rcss.js');
    await userEvent.click(c.getByRole('radio', { name: 'ES module' }));
    await expect(buildCode(canvasElement)).toContain('--format esm');
    await userEvent.click(c.getByRole('button', { name: 'Copy build command' }));
    await expect(c.getByRole('button', { name: 'Copy build command' })).toHaveTextContent('Copied');
  },
};

/** The real compiler, loaded on demand. */
export const Analyzer: Story = {
  render: () => {
    const [applied, setApplied] = useState<string[]>();
    return wide(<><AnalyzerPanel onApply={setApplied} /><output data-applied>{applied?.join(',')}</output></>);
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.type(c.getByLabelText(/Paste every stylesheet/), '.a {{ --n: state(0); content: var(--n) } .a:changed(--n) {{ color: red }');
    await userEvent.click(c.getByRole('button', { name: 'Analyze' }));
    await waitFor(() => expect(c.getByText(/Recommended: core, history, text/)).toBeVisible(), { timeout: 8000 });
    await userEvent.click(c.getByRole('button', { name: 'Use these features' }));
    await expect(canvasElement.querySelector('[data-applied]')!.textContent).toBe('text,history');
  },
};

export const AnalyzerIncomplete: Story = {
  name: 'Analyzer · incomplete',
  render: () => wide(<AnalyzerPanel onApply={() => {}} />),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.type(c.getByLabelText(/Paste every stylesheet/), '@import url(more.css); .a {{ --n: state(0) }');
    await userEvent.click(c.getByRole('button', { name: 'Analyze' }));
    await waitFor(() => expect(c.getByText(/the full runtime, because the analysis is incomplete/)).toBeVisible(), { timeout: 8000 });
    await expect(c.getByRole('button', { name: 'Use the full runtime' })).toBeVisible();
  },
};

export const AnalyzerError: Story = {
  name: 'Analyzer · compiler failed to load',
  render: () => wide(<AnalyzerPanel onApply={() => {}} analyze={() => Promise.reject(new Error('network error'))} />),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole('button', { name: 'Analyze' })).toBeDisabled(); // empty input
    await userEvent.type(c.getByLabelText(/Paste every stylesheet/), '.a {{ color: red }');
    await userEvent.click(c.getByRole('button', { name: 'Analyze' }));
    await waitFor(() => expect(c.getByRole('alert')).toHaveTextContent('network error'));
  },
};
