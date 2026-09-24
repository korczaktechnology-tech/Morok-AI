import { randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import type { Db } from "mongodb";
import type { Session } from "./types.js";

const scrypt = promisify(scryptCallback);
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;

async function hashToken(token: string): Promise<string> {
  const derived = (await scrypt(token, "morok-session", 32)) as Buffer;
  return derived.toString("hex");
}

export class SessionService {
  constructor(private readonly db: Db) {}

  async create(userId: string): Promise<Session> {
    return (await this.createAuthenticated(userId)).session;
  }

  async createAuthenticated(userId: string): Promise<{ session: Session; token: string; expiresAt: Date }> {
    const now = new Date();
    const session: Session = { id: randomUUID(), userId, createdAt: now.toISOString(), updatedAt: now.toISOString() };
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    await this.db.collection("sessions").insertOne({
      ...session,
      tokenHash: await hashToken(token),
      expiresAt
    });
    return { session, token, expiresAt };
  }

  async getByToken(token: string): Promise<Session | null> {
    const record = await this.db.collection("sessions").findOne({ $or: [{ tokenHash: await hashToken(token) }, { id: token }] });
    if (!record || !(record.expiresAt instanceof Date) || record.expiresAt <= new Date()) return null;
    return {
      id: String(record.id),
      userId: String(record.userId),
      createdAt: new Date(String(record.createdAt)).toISOString(),
      updatedAt: new Date(String(record.updatedAt)).toISOString()
    };
  }

  async touch(sessionId: string): Promise<Session | null> {
    const now = new Date().toISOString();
    const result = await this.db.collection("sessions").findOneAndUpdate(
      { id: sessionId },
      { $set: { updatedAt: now } },
      { returnDocument: "after" }
    );
    if (!result) return null;
    return {
      id: String(result.id),
      userId: String(result.userId),
      createdAt: new Date(String(result.createdAt)).toISOString(),
      updatedAt: new Date(String(result.updatedAt)).toISOString()
    };
  }
}