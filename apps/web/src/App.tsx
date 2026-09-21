import { useEffect, useState } from 'react';
import { http } from './api/http';
import type { Health } from './types/health';

export default function App() {
  const [status, setStatus] = useState('Comprobando conexión con la API…');
  useEffect(() => {
    const controller = new AbortController();
    void http.get<Health>('/health', { signal: controller.signal })
      .then(({ data }) => setStatus(data.status === 'ok' ? 'API conectada: ' + data.service : 'API no disponible'))
      .catch(() => { if (!controller.signal.aborted) setStatus('No se pudo conectar con la API.'); });
    return () => controller.abort();
  }, []);
  return <main><h1>Maneja de Una</h1><p role="status">{status}</p></main>;
}

