import type { Db } from 'mongodb';

export const collectionNames = [
  'users',
  'sessions',
  'conversations',
  'memories',
  'tasks',
  'tool_executions',
  'devices',
  'integrations',
  'automations',
  'audit_logs',
  'configurations',
  'system_events',
  'schema_migrations',
] as const;

export async function initializeDatabase(db: Db): Promise<void> {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));

  for (const name of collectionNames) {
    if (!existing.has(name)) {
      await db.createCollection(name);
    }
  }

  await Promise.all([
    db.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true }),
    db.collection('sessions').createIndex({ userId: 1 }),
    db.collection('conversations').createIndex({ userId: 1, updatedAt: -1 }),
    db.collection('memories').createIndex({ userId: 1, updatedAt: -1 }),
    db.collection('tasks').createIndex({ userId: 1, status: 1 }),
    db.collection('tool_executions').createIndex({ conversationId: 1, createdAt: -1 }),
    db.collection('devices').createIndex({ userId: 1 }),
    db.collection('integrations').createIndex({ userId: 1, type: 1 }),
    db.collection('automations').createIndex({ userId: 1, enabled: 1 }),
    db.collection('audit_logs').createIndex({ createdAt: -1 }),
    db.collection('system_events').createIndex({ createdAt: -1 }),
    db.collection('schema_migrations').createIndex({ version: 1 }, { unique: true }),
  ]);
}
