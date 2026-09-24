import Fastify from "fastify";
import cors from "@fastify/cors";
import { MongoClient } from "mongodb";
import { loadConfig } from "./config.js";
import { initializeDatabase } from "./db.js";
import { coreCommands } from "./domain/commands.js";
import { corePermissions, requiresConfirmation } from "./domain/permissions.js";
import { ToolRegistry } from "./domain/tools.js";
import { MOROK_IDENTITY } from "./domain/identity.js";

export function buildApp() {
  const config = loadConfig();
  const app = Fastify({ logger: { level: config.logLevel } });
  const tools = new ToolRegistry();
  app.register(cors, { origin: config.corsOrigin === "*" ? true : config.corsOrigin });
  app.get("/health", async () => ({ status: "ok", service: "morok-api", environment: config.nodeEnv }));
  app.get("/api/v1/status", async () => ({ status: "ok", identity: MOROK_IDENTITY, capabilities: { commands: coreCommands.length, permissions: corePermissions.length, tools: tools.list().length } }));
  app.get("/api/v1/commands", async () => ({ commands: coreCommands }));
  app.get("/api/v1/permissions", async () => ({ permissions: corePermissions }));
  app.get("/api/v1/permissions/:id", async (request) => { const { id } = request.params as { id: string }; return { permission: id, requiresConfirmation: requiresConfirmation(id) }; });
  app.get("/health/database", async (_request, reply) => {
    const client = new MongoClient(config.mongodbUri, { serverSelectionTimeoutMS: 3000 });
    try { await client.connect(); const db = client.db(config.mongodbDatabase); await db.command({ ping: 1 }); await initializeDatabase(db); return { status: "ok", service: "mongodb", database: config.mongodbDatabase }; }
    catch { return reply.code(503).send({ status: "error", service: "mongodb" }); }
    finally { await client.close().catch(() => undefined); }
  });
  app.setErrorHandler((error, _request, reply) => { app.log.error(error); return reply.code(error.statusCode ?? 500).send({ error: "internal_error" }); });
  return app;
}