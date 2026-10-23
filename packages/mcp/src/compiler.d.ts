// Types of dist/compiler.js: the library's compiler, bundled by scripts/build.mjs from ../../src.
// Only the parts the server reads are declared.

export interface Token { type: string; start: number; end: number; value: string }
export interface Typed { type: 'boolean' | 'number' | 'dimension' | 'value' | 'string'; v: boolean | number | string; unit?: string }
export type Expr =
  | { k: 'lit'; t: Typed }
  | { k: 'attr'; name: string; fallback: Typed }
  | { k: 'pick'; items: Expr[] }
  | { k: 'split'; of: Expr; sep: string };
export type ActNode =
  | { k: 'lit'; t: Typed }
  | { k: 'op'; op: '+' | '-' | '*' | '/'; a: ActNode; b: ActNode }
  | { k: 'neg'; a: ActNode }
  | { k: 'math'; fn: 'min' | 'max' | 'clamp' | 'abs'; args: ActNode[] }
  | { k: 'round'; mode: string; a: ActNode; b?: ActNode }
  | { k: 'var'; name: string; fallback?: ActNode }
  | { k: 'event'; field: string }
  | { k: 'mouse'; axis: 'x' | 'y'; local: boolean }
  | { k: 'size'; of: 'element' | 'viewport'; dim: 'width' | 'height' }
  | { k: 'attr'; name: string; fallback?: Typed }
  | { k: 'pick'; items: ActNode[] }
  | { k: 'split'; of: ActNode; sep: string }
  | { k: 'random'; min: ActNode; max: ActNode; step?: ActNode }
  | { k: 'sibling'; count: boolean };
export interface Mutation { name: string; op: 'set' | 'toggle' | 'increment' | 'decrement' | 'cycle'; expr?: ActNode; values?: Typed[] }
export interface CompiledRule {
  match: string;
  states: { name: string; init: Expr; persist?: unknown; bind?: unknown }[];
  onSpec?: { trigger: { key: string; category: string; phase?: string }; mods: { prevent: boolean; stop: boolean }; slots: { m: Mutation }[] };
  prelude?: [number, number];
}
export interface CompiledSheet { css: string; rules: CompiledRule[]; changed: boolean; uses: Set<string> }

export function compile(source: string, options?: { trusted?: boolean }): CompiledSheet;
export const diagnostics: string[];
export const noted: Set<string>;
/** Added by the build: clears the compiler's page-lifetime name maps. */
export function resetNames(): void;
export function describe(): unknown;
export const version: string;
export function tokenize(s: string): Token[];
export function matching(tokens: Token[], open: number): number;
export function assignable(to: Typed, from: Typed): boolean;
export function convert(a: Typed, b: Typed): number | undefined;
