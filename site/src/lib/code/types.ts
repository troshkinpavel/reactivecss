/** Visual role of a token. Weight carries structure, color only marks reactive syntax. */
export type TokenKind =
  | 'com'  // comment
  | 'sel'  // selector part
  | 'tag'  // HTML tag
  | 'at'   // at-rule keyword
  | 'var'  // custom property / JS keyword-ish emphasis
  | 'kw'   // keyword
  | 'prop' // property name
  | 'id'   // identifier
  | 'attr' // HTML attribute
  | 'fn'   // native function name
  | 'str'  // string
  | 'val'  // value, number, unit, color
  | 'pun'  // punctuation
  | 'rx'   // Reactive CSS syntax
  | 'ws';  // whitespace

export type Lang = 'css' | 'html' | 'js' | 'ts' | 'json' | 'sh';

/** A Reactive CSS feature, keyed like the registry: `${kind}:${name}`. */
export type FeatureKey = `${'function' | 'selector' | 'declaration' | 'action' | 'trigger' | 'expression' | 'scope' | 'rule'}:${string}`;

export interface Token {
  /** Text, never containing a newline. */
  t: string;
  k: TokenKind;
  /** Offset of the first character in the source. */
  start: number;
  /** Set on `rx` tokens. */
  feature?: FeatureKey;
}

export type Line = Token[];
