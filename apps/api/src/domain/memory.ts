import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";

export interface MemoryEntry {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export class MemoryService {
  constructor(private readonly db: Db) {}

  async save(entry: MemoryEntry): Promise<MemoryEntry> {
    await this.db.collection("memories").updateOne(
      { id: entry.id, userId: entry.userId },
      { $set: entry },
      { upsert: true }
    );
    return entry;
  }

  async create(userId: string, content: string): Promise<MemoryEntry> {
    const now = new Date().toISOString();
    return this.save({ id: randomUUID(), userId, content: content.trim(), createdAt: now, updatedAt: now });
  }

  async get(id: string, userId?: string): Promise<MemoryEntry | undefined> {
    const filter: Record<string, unknown> = { id };
    if (userId) filter.userId = userId;
    const entry = await this.db.collection("memories").findOne(filter);
    return entry ? this.normalize(entry) : undefined;
  }

  async search(userId: string, query = ""): Promise<MemoryEntry[]> {
    const entries = await this.db.collection("memories")
      .find({ userId })
      .sort({ updatedAt: -1 })
      .limit(100)
      .toArray();
    const normalizedQuery = query.trim().toLowerCase();
    return entries
      .map((entry) => this.normalize(entry))
      .filter((entry) => !normalizedQuery || entry.content.toLowerCase().includes(normalizedQuery))
      .slice(0, 50);
  }

  private normalize(entry: Record<string, unknown>): MemoryEntry {
    return {
      id: String(entry.id),
      userId: String(entry.userId),
      content: String(entry.content),
      createdAt: new Date(String(entry.createdAt)).toISOString(),
      updatedAt: new Date(String(entry.updatedAt)).toISOString()
    };
  }
}