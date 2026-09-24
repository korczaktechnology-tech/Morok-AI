import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { connectDatabase } from './db.js';

export async function buildApp(): Promise<FastifyInstance> {
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

  return app;
}
