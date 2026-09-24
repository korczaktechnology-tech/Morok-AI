import type { Db } from "mongodb";
import { MemoryService, type MemoryEntry } from "./memory.js";
import { SessionService } from "./session.js";

export interface ConversationContext {
  userId: string;
  sessionId: string;
  conversationId: string;
  variables: Record<string, unknown>;
  memories: MemoryEntry[];
  history: Array<{ role: string; content: string; createdAt?: Date }>;
}

export class ContextService {
  private readonly memories: MemoryService;
  private readonly sessions: SessionService;

  constructor(private readonly db: Db) {
    this.memories = new MemoryService(db);
    this.sessions = new SessionService(db);
  }

  async create(userId: string, sessionId: string, conversationId: string): Promise<ConversationContext> {
    const session = await this.db.collection("sessions").findOne({ id: sessionId, userId });
    if (!session) throw new Error("session_not_found");
    const conversation = await this.db.collection("conversations").findOne({ id: conversationId, userId });
    if (!conversation) throw new Error("conversation_not_found");
    const memories = await this.memories.search(userId);
    const history = Array.isArray(conversation.messages)
      ? conversation.messages.slice(-20).map((message) => {
          const item = message as Record<string, unknown>;
          return {
            role: String(item.role),
            content: String(item.content),
            createdAt: item.createdAt instanceof Date ? item.createdAt : undefined
          };
        })
      : [];
    await this.sessions.touch(sessionId);
    return { userId, sessionId, conversationId, variables: {}, memories, history };
  }

  set(context: ConversationContext, key: string, value: unknown): void {
    context.variables[key] = value;
  }
}