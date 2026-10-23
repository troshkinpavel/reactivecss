// Browser build: <script src="reactive-css.min.js" defer></script> and you are done.
import * as ReactiveCSS from './index';

declare global { interface Window { ReactiveCSS: typeof ReactiveCSS } }

window.ReactiveCSS = ReactiveCSS;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => ReactiveCSS.start());
else ReactiveCSS.start();
