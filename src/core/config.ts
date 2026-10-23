/**
 * Optional page configuration, read from `window.ReactiveCSSConfig` (set it before the script
 * runs). Zero configuration is the default; every field is optional.
 *   native: false           — compile when() to the runtime instead of native if().
 *   trustInlineStyles: false — accept on: and bind: only from same-origin <link> stylesheets,
 *                              not from <style> elements (for pages that render user-provided
 *                              <style> content).
 */
export interface Config { native?: boolean; trustInlineStyles?: boolean }

export const config = (): Config => (typeof window !== 'undefined' && (window as any).ReactiveCSSConfig) || {};
