import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { AppProviders } from './app/providers';
import './styles/tokens.css';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AppProviders>
    <App />
  </AppProviders>
);
