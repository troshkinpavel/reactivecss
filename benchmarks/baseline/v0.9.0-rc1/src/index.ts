// Programmatic entry point, full runtime. Importing it registers every feature; call start() to
// process the document (the browser build does that for you). Custom bundles import src/api.ts
// and only the selected src/features/* (tools/bundle.mjs).

import './features/events';
import './features/conditions';
import './features/nth-var';
import './features/history';
import './features/forms';
import './features/text';
import './features/attributes';
import './features/focus';
import './features/values';
import './features/dynamic';
import './features/geometry';
import './features/gestures';
import './features/persist';
import './features/blur';

export * from './api';
