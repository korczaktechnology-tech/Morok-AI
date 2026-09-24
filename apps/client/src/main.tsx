import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function App() {
  return (
    <main className="app">
      <section className="panel">
        <span className="status">MOROK</span>
        <h1>Fundação preparada.</h1>
        <p>A interface inicial do Morok está pronta para receber as próximas fases.</p>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
