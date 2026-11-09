import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Наш власний API-ендпоінт для проксування запитів до poe.ninja без CORS
 */
app.get('/api/proxy-ninja', async (req, res) => {
  const type = req.query['type'] || 'Currency';
  const league = req.query['league'] || 'Settlers';
  
  const targetUrl = `https://poe.ninja/api/data/currencyoverview?league=${league}&type=${type}`;

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) {
      throw new Error(`PoE.ninja responded with status: ${response.status}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Помилка проксі сервера:', error);
    res.status(500).json({ error: 'Не вдалося отримати дані з poe.ninja' });
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point...
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
