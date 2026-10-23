import type { StorybookConfig } from '@storybook/react-vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.stories.@(ts|tsx)', '../src/stories/**/*.mdx'],
  addons: ['@storybook/addon-docs', '@storybook/addon-vitest'],
  // public/ holds the synced runtime that preview iframes load.
  staticDirs: ['../public'],
  viteFinal: async (cfg) => {
    cfg.plugins = [...(cfg.plugins ?? []), tailwindcss()];
    cfg.resolve = { ...cfg.resolve, alias: { ...(cfg.resolve?.alias as object), '~': fileURLToPath(new URL('../src', import.meta.url)) } };
    return cfg;
  },
};
export default config;
