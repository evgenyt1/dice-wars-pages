import { createRoot } from 'react-dom/client';
import GameClient from './game-client';
import './globals.css';

createRoot(document.getElementById('root')!).render(<GameClient />);
