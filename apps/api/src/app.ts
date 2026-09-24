import Fastify from "fastify";
import cors from "@fastify/cors";
import { MongoClient } from "mongodb";
import { loadConfig } from "./config.js";
import { initializeDatabase } from "./db.js";

export function buildApp() {
  const config = loadConfig();
  const app = Fastify({ logger: { level: config.logLevel } });
  app.register(cors, { origin: config.corsOrigin === "*" ? true : config.corsOrigin });

  app.get("/health", async () => ({
    status: "ok", service: "morok-api", environment: config.nodeEnv
  }));

  app.get("/health/database", async (_request, reply) => {
    const client = new MongoClient(config.mongodbUri, { serverSelectionTimeoutMS: 3000 });
    try {
      await client.connect();
      const db = client.db(config.mongodbDatabase);
      await db.command({ ping: 1 });
      await initializeDatabase(db);
      return { status: "ok", service: "mongodb", database: config.mongodbDatabase };
    } catch {
      return reply.code(503).send({ status: "error", service: "mongodb" });
    } finally {
      await client.close().catch(() => undefined);
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    return reply.code(error.statusCode ?? 500).send({ error: "internal_error" });
  });

  return app;
}