import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Db } from "mongodb";
import { SessionService } from "./session.js";

const scrypt = promisify(scryptCallback);
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export interface AuthUser { id: string; email: string; roles: string[]; createdAt: Date }
export interface AuthSession { token: string; sessionId: string; user: AuthUser; expiresAt: Date }

async function hashPassword(password: string, salt = randomBytes(16).toString("hex")): Promise<string> {
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}
async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
async function hashToken(token: string): Promise<string> {
  const derived = (await scrypt(token, "morok-session", 32)) as Buffer;
  return derived.toString("hex");
}

export class AuthService {
  private readonly sessions: SessionService;

  constructor(private readonly db: Db) {
    this.sessions = new SessionService(db);
  }
  async register(email: string, password: string): Promise<AuthSession> {
    const normalized = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalized)) throw new Error("invalid_email");
    if (password.length < 8) throw new Error("weak_password");
    const users = this.db.collection("users");
    if (await users.findOne({ email: normalized })) throw new Error("email_already_registered");
    const user: AuthUser = { id: randomUUID(), email: normalized, roles: ["user"], createdAt: new Date() };
    await users.insertOne({ ...user, passwordHash: await hashPassword(password) });
    return this.createSession(user);
  }
  async login(email: string, password: string): Promise<AuthSession> {
    const normalized = email.trim().toLowerCase();
    const user = await this.db.collection("users").findOne({ email: normalized });
    if (!user || typeof user.passwordHash !== "string" || !(await verifyPassword(password, user.passwordHash))) throw new Error("invalid_credentials");
    const authUser: AuthUser = { id: String(user.id), email: String(user.email), roles: Array.isArray(user.roles) ? user.roles.map(String) : ["user"], createdAt: user.createdAt instanceof Date ? user.createdAt : new Date(user.createdAt) };
    return this.createSession(authUser);
  }
  async authenticate(token: string): Promise<AuthUser | null> {
    const session = await this.sessions.getByToken(token);
    if (!session) return null;
    const user = await this.db.collection("users").findOne({ id: session.userId });
    if (!user) return null;
    return { id: String(user.id), email: String(user.email), roles: Array.isArray(user.roles) ? user.roles.map(String) : ["user"], createdAt: user.createdAt instanceof Date ? user.createdAt : new Date(user.createdAt) };
  }
  private async createSession(user: AuthUser): Promise<AuthSession> {
    const authenticated = await this.sessions.createAuthenticated(user.id);
    return { token: authenticated.token, sessionId: authenticated.session.id, user, expiresAt: authenticated.expiresAt };
  }
}