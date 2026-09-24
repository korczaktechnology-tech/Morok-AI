import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { MongoClient } from "mongodb";
import { config } from "./config.js";
import { connectDatabase, initializeDatabase } from "./db.js";
import { coreCommands } from "./domain/commands.js";
import { corePermissions, requiresConfirmation } from "./domain/permissions.js";
import { ToolRegistry } from "./domain/tools.js";
import { MOROK_IDENTITY } from "./domain/identity.js";
import { StubModelGateway } from "./domain/gateway.js";
import { AuthService } from "./domain/auth.js";
import { assertPermission } from "./domain/security.js";

export function buildApp() {
  const app = Fastify({ logger: { level: config.logLevel } });
  const tools = new ToolRegistry();
  const gateway = new StubModelGateway();

  app.register(cors, { origin: config.corsOrigin === "*" ? true : config.corsOrigin });

  app.get("/health", async () => ({ status: "ok", service: "morok-api", environment: config.nodeEnv }));
  app.get("/api/v1/status", async () => ({
    status: "ok", identity: MOROK_IDENTITY,
    capabilities: { commands: coreCommands.length, permissions: corePermissions.length, tools: tools.list().length, modelGateway: true }
  }));
  app.get("/api/v1/commands", async () => ({ commands: coreCommands }));
  app.get("/api/v1/permissions", async () => ({ permissions: corePermissions }));
  app.get("/api/v1/permissions/:id", async (request) => {
    const { id } = request.params as { id: string };
    return { permission: id, requiresConfirmation: requiresConfirmation(id) };
  });

  app.post("/api/v1/auth/register", async (request, reply) => {
    const body = request.body as { email?: string; password?: string };
    if (!body?.email || !body?.password) return reply.code(400).send({ error: "credentials_required" });
    try {
      return reply.code(201).send(await new AuthService(await connectDatabase()).register(body.email, body.password));
    } catch (error) {
      if (error instanceof Error && error.message === "email_already_registered") return reply.code(409).send({ error: error.message });
      if (error instanceof Error && ["invalid_email", "weak_password"].includes(error.message)) return reply.code(400).send({ error: error.message });
      throw error;
    }
  });

  app.post("/api/v1/auth/login", async (request, reply) => {
    const body = request.body as { email?: string; password?: string };
    if (!body?.email || !body?.password) return reply.code(400).send({ error: "credentials_required" });
    try {
      return await new AuthService(await connectDatabase()).login(body.email, body.password);
    } catch (error) {
      if (error instanceof Error && error.message === "invalid_credentials") return reply.code(401).send({ error: error.message });
      throw error;
    }
  });

  app.get("/api/v1/auth/me", async (request, reply) => {
    const user = await authenticateRequest(request.headers.authorization);
    if (!user) return reply.code(401).send({ error: "unauthorized" });
    return { user };
  });

  app.post("/api/v1/messages", async (request, reply) => {
    const db = await connectDatabase();
    const user = await authenticateRequest(request.headers.authorization);
    if (!user) return reply.code(401).send({ error: "unauthorized" });
    assertPermission({ userId: user.id, roles: user.roles }, "conversation.read");

    const body = request.body as { message?: string; conversationId?: string; sessionId?: string };
    if (!body?.message?.trim()) return reply.code(400).send({ error: "message_required" });

    const now = new Date();
    const conversationId = body.conversationId ?? randomUUID();
    const sessionId = body.sessionId ?? randomUUID();
    const message = body.message.trim();

    await db.collection("conversations").updateOne(
      { id: conversationId, userId: user.id },
      { $set: { userId: user.id, updatedAt: now }, $setOnInsert: { id: conversationId, createdAt: now, messages: [] } },
      { upsert: true }
    );
    await db.collection("conversations").updateOne(
      { id: conversationId, userId: user.id },
      { $push: { messages: { role: "user", content: message, createdAt: now } } }
    );

    const response = await gateway.complete({ message, context: { userId: user.id, sessionId, conversationId } });

    await db.collection("conversations").updateOne(
      { id: conversationId, userId: user.id },
      { $push: { messages: { role: "assistant", content: response.content, model: response.model, createdAt: new Date() } }, $set: { updatedAt: new Date() } }
    );
    await db.collection("audit_logs").insertOne({ action: "conversation.message.completed", actorId: user.id, conversationId, createdAt: new Date() });

    return { ...response, conversationId, sessionId };
  });

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
    const statusCode = typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500;
    return reply.code(statusCode).send({ error: "internal_error" });
  });
  return app;
}

async function authenticateRequest(authorization: string | undefined) {
  if (!authorization?.startsWith("Bearer ")) return null;
  return new AuthService(await connectDatabase()).authenticate(authorization.slice(7));
}
