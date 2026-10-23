// The public API of every bundle (full, compact and custom): the core runtime. Features are added
// by importing src/features/<id>.ts (src/index.ts imports all of them).

export { start, stop, refresh, stats } from './core/engine';
export { compile } from './core/parser';
export { diagnostics } from './core/log';
export { defineFunction, defineSelector, defineAction, describe } from './core/registry';
export type { FunctionDef, SelectorDef, ActionDef, Instance, ArgInstance, Arg, CallNode, Ctx, SharedSource } from './core/registry';
export { VERSION as version } from './core/version';
export { FEATURES, KEEP_NATIVE } from './core/features';
export type { Feature } from './core/features';
