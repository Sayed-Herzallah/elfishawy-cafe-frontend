import http from 'http';
import https from 'https';

/** Fetch-compatible subset for Electron 22's Node 16 main process. */
export function httpFetch(input, options = {}) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(String(input));
    } catch (error) {
      reject(error);
      return;
    }

    const transport = url.protocol === 'https:' ? https : url.protocol === 'http:' ? http : null;
    if (!transport) {
      reject(new Error(`Unsupported protocol: ${url.protocol}`));
      return;
    }

    if (options.signal?.aborted) {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      reject(error);
      return;
    }

    const request = transport.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('error', reject);
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({
          ok: (response.statusCode || 0) >= 200 && (response.statusCode || 0) < 300,
          status: response.statusCode || 0,
          text: async () => body,
          json: async () => JSON.parse(body),
        });
      });
    });

    const abortRequest = () => {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      request.destroy(error);
    };
    options.signal?.addEventListener('abort', abortRequest, { once: true });
    request.on('error', reject);
    request.on('close', () => options.signal?.removeEventListener('abort', abortRequest));

    if (options.body !== undefined && options.body !== null) request.write(options.body);
    request.end();
  });
}
