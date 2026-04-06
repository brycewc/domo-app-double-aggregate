import { Proxy } from '@domoinc/ryuu-proxy';
import manifestJson from './public/manifest.json' with { type: 'json' };

export function setupRyuuProxy(server) {
  const config = { manifest: manifestJson };
  const proxy = new Proxy(config);

  proxy.onError = (error, response) => {
    const status = error.response?.data?.statusCode || 500;
    const message = error.response?.data?.statusMessage || error.message || 'Proxy error';

    response.statusCode = status;
    response.end(message);
  };

  server.middlewares.use(proxy.express());
}
