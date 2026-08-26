import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { installChunkLoadRecovery } from './app/chunkLoadRecovery';
import { AppProviders } from './app/providers';
import './styles/tokens.css';
import './styles/global.css';

installChunkLoadRecovery();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AppProviders>
    <App />
  </AppProviders>
);
