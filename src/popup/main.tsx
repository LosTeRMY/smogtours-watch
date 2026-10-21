// Point d'entrée du popup : React prend la main sur <div id="root"> de popup.html.

import { createRoot } from 'react-dom/client';
import '../ui.css';
import Popup from './Popup';

createRoot(document.getElementById('root')!).render(<Popup />);
