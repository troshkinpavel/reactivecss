import type { Preview } from '@storybook/react-vite';
import '../src/styles/global.css';
import './fonts.css';

const preview: Preview = {
  parameters: {
    layout: 'padded',
    controls: { expanded: true },
    backgrounds: { options: { paper: { name: 'paper', value: 'oklch(0.985 0.004 85)' }, night: { name: 'night', value: 'oklch(0.21 0.01 80)' } } },
    viewport: { options: { mobile: { name: 'Mobile 390', styles: { width: '390px', height: '844px' } }, tablet: { name: 'Tablet 1024', styles: { width: '1024px', height: '768px' } } } },
  },
  initialGlobals: { backgrounds: { value: 'paper' } },
};
export default preview;
