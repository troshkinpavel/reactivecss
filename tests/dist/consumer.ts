// Compiled with tsc against dist/index.d.ts to check the published types.
import { compile, describe, defineFunction, start, type FunctionDef, type Feature } from '../../dist/index.js';

const def: FunctionDef = { name: 'double', kind: 'generator', create: () => ({ get: () => '2px' }) };
defineFunction(def);
const features: Feature[] = describe().features;
const css: string = compile('.a { width: pick(1px) }').css;
start();
export { features, css };
