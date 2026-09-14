import { createRoot } from 'react-dom/client';
import GameClient from '../app/game-client';
import '../app/globals.css';

/** Static GitHub Pages entry; `app/layout.tsx` is the Sites equivalent. */
createRoot(document.getElementById('root')!).render(<GameClient />);
