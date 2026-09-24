import assert from "node:assert/strict";
import test from "node:test";
import { MongoClient } from "mongodb";
import { buildApp } from "../app.js";
import { closeDatabase, initializeDatabase } from "../db.js";

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017";
const databaseName = process.env.MONGODB_DATABASE ?? "morok_test";

test("authentication, message persistence and memory persistence work end-to-end", async () => {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(databaseName);
  await initializeDatabase(db);
  await Promise.all([
    db.collection("users").deleteMany({}),
    db.collection("sessions").deleteMany({}),
    db.collection("conversations").deleteMany({}),
    db.collection("memories").deleteMany({}),
    db.collection("audit_logs").deleteMany({})
  ]);

  const app = buildApp();
  await app.ready();

  const email = `test-${Date.now()}@morok.local`;
  const password = "MorokTest123!";

  const register = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: { email, password }
  });
  assert.equal(register.statusCode, 201);
  const registered = register.json() as { token: string; sessionId: string; user: { id: string } };
  assert.ok(registered.token);
  assert.ok(registered.sessionId);

  const denied = await app.inject({
    method: "POST",
    url: "/api/v1/messages",
    payload: { message: "sem autenticação" }
  });
  assert.equal(denied.statusCode, 401);

  const memory = await app.inject({
    method: "POST",
    url: "/api/v1/memories",
    headers: { authorization: `Bearer ${registered.token}` },
    payload: { content: "Memória de teste do Morok" }
  });
  assert.equal(memory.statusCode, 201);

  const message = await app.inject({
    method: "POST",
    url: "/api/v1/messages",
    headers: { authorization: `Bearer ${registered.token}` },
    payload: { message: "Olá Morok" }
  });
  assert.equal(message.statusCode, 200);
  const response = message.json() as { conversationId: string; sessionId: string };
  assert.equal(response.sessionId, registered.sessionId);

  const storedConversation = await db.collection("conversations").findOne({ id: response.conversationId, userId: registered.user.id });
  assert.ok(storedConversation);
  assert.equal(Array.isArray(storedConversation.messages), true);
  assert.equal(storedConversation.messages.length, 2);

  const storedMemory = await db.collection("memories").findOne({ userId: registered.user.id, content: "Memória de teste do Morok" });
  assert.ok(storedMemory);

  const audit = await db.collection("audit_logs").find({ actorId: registered.user.id }).toArray();
  assert.ok(audit.some((entry) => entry.action === "conversation.message.completed"));

  await app.close();
  await closeDatabase();
  await client.close();
});