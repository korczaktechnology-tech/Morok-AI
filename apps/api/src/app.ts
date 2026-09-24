import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { MongoClient } from "mongodb";
import { config } from "./config.js";
import { connectDatabase, initializeDatabase } from "./db.js";
import { coreCommands } from "./domain/commands.js";
import { corePermissions, decidePermission, requiresConfirmation } from "./domain/permissions.js";
import { ToolRegistry } from "./domain/tools.js";
import { MOROK_IDENTITY } from "./domain/identity.js";
import { StubModelGateway } from "./domain/gateway.js";
import { AuthService } from "./domain/auth.js";
import { MemoryService } from "./domain/memory.js";
import { ContextService } from "./domain/context.js";
import { assertPermission } from "./domain/security.js";

export function buildApp() {
  const app = Fastify({ logger: { level: config.logLevel } });
  const tools = new ToolRegistry();
  const gateway = new StubModelGateway();

  app.register(cors, { origin: config.corsOrigin === "*" ? true : config.corsOrigin });

  app.get("/health", async () => ({ status: "ok", service: "morok-api", environment: config.nodeEnv }));
  app.get("/api/v1/status", async () => ({
    status: "ok",
    identity: MOROK_IDENTITY,
    capabilities: {
      commands: coreCommands.length,
      permissions: corePermissions.length,
      tools: tools.list().length,
      modelGateway: true
    }
  }));
  app.get("/api/v1/commands", async () => ({ commands: coreCommands }));
  app.get("/api/v1/permissions", async () => ({ permissions: corePermissions }));
  app.get("/api/v1/permissions/:id", async (request) => {
    const { id } = request.params as { id: string };
    return { permission: id, requiresConfirmation: requiresConfirmation(id) };
  });
  app.post("/api/v1/permissions/check", async (request, reply) => {
    const user = await authenticateRequest(request.headers.authorization);
    if (!user) return reply.code(401).send({ error: "unauthorized" });
    const body = request.body as { permission?: string; confirmed?: boolean };
    if (!body?.permission) return reply.code(400).send({ error: "permission_required" });
    return decidePermission(user.roles, body.permission, body.confirmed === true);
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
    const auth = await authenticateRequest(request.headers.authorization);
    if (!auth) return reply.code(401).send({ error: "unauthorized" });
    return { user: auth.user };
  });

  app.get("/api/v1/conversations/:id", async (request, reply) => {
    const auth = await authenticateRequest(request.headers.authorization);
    if (!auth) return reply.code(401).send({ error: "unauthorized" });
    assertPermission({ userId: auth.user.id, roles: auth.user.roles }, "conversation.read");
    const { id } = request.params as { id: string };
    const conversation = await (await connectDatabase()).collection("conversations").findOne({ id, userId: auth.user.id });
    if (!conversation) return reply.code(404).send({ error: "conversation_not_found" });
    return { conversation };
  });

  app.post("/api/v1/memories", async (request, reply) => {
    const auth = await authenticateRequest(request.headers.authorization);
    if (!auth) return reply.code(401).send({ error: "unauthorized" });
    const body = request.body as { content?: string };
    if (!body?.content?.trim()) return reply.code(400).send({ error: "content_required" });
    const memory = await new MemoryService(await connectDatabase()).create(auth.user.id, body.content);
    return reply.code(201).send({ memory });
  });

  app.get("/api/v1/memories", async (request, reply) => {
    const auth = await authenticateRequest(request.headers.authorization);
    if (!auth) return reply.code(401).send({ error: "unauthorized" });
    const { q } = request.query as { q?: string };
    return { memories: await new MemoryService(await connectDatabase()).search(auth.user.id, q ?? "") };
  });

  app.post("/api/v1/tools/:id/execute", async (request, reply) => {
    const auth = await authenticateRequest(request.headers.authorization);
    if (!auth) return reply.code(401).send({ error: "unauthorized" });
    const { id } = request.params as { id: string };
    const body = request.body as { input?: unknown; confirmed?: boolean };
    const decision = decidePermission(auth.user.roles, "tool.execute", body?.confirmed === true);
    const db = await connectDatabase();
    if (!decision.allowed) {
      await db.collection("audit_logs").insertOne({
        action: decision.reason === "confirmation_required" ? "tool.confirmation.required" : "tool.execution.denied",
        actorId: auth.user.id,
        toolId: id,
        createdAt: new Date()
      });
      return reply.code(decision.reason === "confirmation_required" ? 409 : 403).send(decision);
    }
    try {
      const result = await tools.execute(id, body?.input);
      await db.collection("tool_executions").insertOne({
        id: randomUUID(),
        toolId: id,
        actorId: auth.user.id,
        input: body?.input,
        result,
        confirmed: true,
        createdAt: new Date()
      });
      await db.collection("audit_logs").insertOne({
        action: "tool.execution.completed",
        actorId: auth.user.id,
        toolId: id,
        createdAt: new Date()
      });
      return { ok: true, result };
    } catch (error) {
      const code = error instanceof Error && error.message === "tool_not_found" ? 404 : 400;
      return reply.code(code).send({ error: error instanceof Error ? error.message : "tool_execution_failed" });
    }
  });

  app.post("/api/v1/messages", async (request, reply) => {
    const db = await connectDatabase();
    const auth = await authenticateRequest(request.headers.authorization);
    if (!auth) return reply.code(401).send({ error: "unauthorized" });
    assertPermission({ userId: auth.user.id, roles: auth.user.roles }, "conversation.read");

    const body = request.body as { message?: string; conversationId?: string; sessionId?: string };
    if (!body?.message?.trim()) return reply.code(400).send({ error: "message_required" });

    const now = new Date();
    const message = body.message.trim();
    const session = body.sessionId
      ? await new SessionService(db).getByToken(body.sessionId)
      : null;
    const sessionId = body.sessionId ?? auth.sessionId;
    const conversationId = body.conversationId ?? randomUUID();

    if (body.sessionId && (!session || session.userId !== auth.user.id)) {
      return reply.code(401).send({ error: "invalid_session" });
    }

    await db.collection("conversations").updateOne(
      { id: conversationId, userId: auth.user.id },
      { $set: { userId: auth.user.id, updatedAt: now }, $setOnInsert: { id: conversationId, createdAt: now, messages: [] } },
      { upsert: true }
    );
    await db.collection("conversations").updateOne(
      { id: conversationId, userId: auth.user.id },
      { $push: { messages: { role: "user", content: message, createdAt: now } } }
    );

    const context = await new ContextService(db).create(auth.user.id, sessionId, conversationId);
    const response = await gateway.complete({ message, context });

    await db.collection("conversations").updateOne(
      { id: conversationId, userId: auth.user.id },
      { $push: { messages: { role: "assistant", content: response.content, model: response.model, createdAt: new Date() } }, $set: { updatedAt: new Date() } }
    );
    await db.collection("audit_logs").insertOne({
      action: "conversation.message.completed",
      actorId: auth.user.id,
      conversationId,
      sessionId,
      createdAt: new Date()
    });

    return { ...response, conversationId, sessionId, context };
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
  const db = await connectDatabase();
  const token = authorization.slice(7);
  const service = new AuthService(db);
  const user = await service.authenticate(token);
  if (!user) return null;
  const session = await new SessionService(db).getByToken(token);
  if (!session || session.userId !== user.id) return null;
  return { user, sessionId: session.id };
}