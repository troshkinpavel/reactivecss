// Lazy access to the packaged knowledge (dist/knowledge.json) and the bundled compiler
// (dist/compiler.js). Both are read from this package's own folder only, on first use.

import { readFileSync } from 'node:fs';
import type * as Compiler from './compiler.js';

export interface RegistryEntry {
  name: string; kind: string; category: string; status: string; since?: string; syntax: string;
  parameters?: { name: string; type: string; optional?: boolean; default?: string }[];
  returns?: string; description: string; reason?: string; removedIn?: string; examples: string[];
  nativeEquivalent?: string; support?: string; dependsOn?: string[];
}
export interface CatalogFeature { id: string; title: string; category: string; requires: string[]; optional: string[]; status: string; provides: string[]; syntax: string[] }
export interface Example { id: string; group: string; title: string; topics: string[]; summary: string; sections: Record<string, string>; css: string; html: string; uses: string[]; features: string[]; source: string }
export interface Mistake { id: string; title: string; entries: string[]; wrong: string; right: string; explanation: string; codes: string[]; rightCodes?: string[] }
export interface Curated { name: string; kind: string; status: string; since: string; syntax: string; description: string; parameters?: unknown[]; constraints: string[]; examples: string[]; related: string[]; doc: string; legacyForm?: string; mistakes?: string[] }
export interface Overlay { doc?: string; related?: string[]; constraints?: string[]; notes?: string[]; mistakes?: string[]; legacy?: boolean; replacement?: string; syntax09?: string }
export interface Measured { label: string; features: string[]; sizes: { minified: number; gzip: number; brotli: number } }
export interface SearchDoc { id: string; type: string; title: string; snippet: string; ref: Record<string, unknown> }

export interface Knowledge {
  name: string; version: string; builtAt: string;
  reactivecss: { version: string; package: string; status: string; homepage: string; published: boolean };
  registry: { version: string; features: RegistryEntry[]; keepNative: string[]; onEvents: string[]; outsideEvents: string[]; events: string[] };
  catalog: { version: string; features: CatalogFeature[]; profiles: Record<string, string[]> };
  diagnosticCodes: Record<string, { template: string; module: string }>;
  overlay: Record<string, Overlay>; mutations: Record<string, Curated>; modifiers: Record<string, Curated>; aliases: Record<string, string>;
  mistakes: Mistake[]; nativeFirst: { need: string; native: string; note: string }[];
  compatibility: Record<string, unknown>; docPages: Record<string, string>;
  examples: Example[];
  sizes: { measured: Measured[]; prebuilt: (Measured & { file: string; note: string })[]; method: string; measuredWith: string };
  migrationGuide: string;
  index: { docs: SearchDoc[]; postings: Record<string, [number, number][]>; lengths: number[]; avgdl: number };
}

let knowledge: Knowledge | undefined;
export function K(): Knowledge {
  return (knowledge ??= JSON.parse(readFileSync(new URL('./knowledge.json', import.meta.url), 'utf8')) as Knowledge);
}

let compiler: Promise<typeof Compiler> | undefined;
export function C(): Promise<typeof Compiler> {
  return (compiler ??= import(new URL('./compiler.js', import.meta.url).href) as Promise<typeof Compiler>);
}

export const DOCS_BASE = 'https://reactivecss.com/docs/';
