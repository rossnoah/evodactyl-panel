import { createRoot } from 'react-dom/client';
import App from '@/components/App';
import { bootstrapStore } from '@/state/bootstrap';

// Enable language support.
import './i18n';

// Seed the easy-peasy store from window.PterodactylUser / window.SiteConfiguration
// before the first render, so no component ever sees `settings.data === undefined`.
bootstrapStore();

const container = document.getElementById('app');
if (!container) throw new Error('Root container #app not found in document.');
createRoot(container).render(<App />);
