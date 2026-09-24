import { buildApp } from './app.js';
import { closeDatabase } from './db.js';
import { config } from './config.js';

const app = await buildApp();

const shutdown = async () => {
  await app.close();
  await closeDatabase();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({
  host: config.host,
  port: config.port,
});
