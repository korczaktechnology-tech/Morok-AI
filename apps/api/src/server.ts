import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { closeDatabase, connectDatabase } from './db.js';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: config.corsOrigin,
});

app.get('/health', async () => ({
  status: 'ok',
  service: 'morok-api',
  environment: config.nodeEnv,
}));

app.get('/health/database', async () => {
  const database = await connectDatabase();
  await database.command({ ping: 1 });

  return {
    status: 'ok',
    service: 'mongodb',
    database: config.mongodbDatabase,
  };
});

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
