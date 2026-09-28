import { MongoClient, type Db } from "mongodb";
import { config } from "./config.js";
import { initializeDatabase } from "./database/schema.js";

let client: MongoClient | undefined;
let database: Db | undefined;
let connecting: Promise<Db> | undefined;

export async function connectDatabase(): Promise<Db> {
  if (database) return database;
  if (connecting) return connecting;

  connecting = (async () => {
    const nextClient = new MongoClient(config.mongodbUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      maxPoolSize: 20,
      minPoolSize: 0,
      retryReads: true,
      retryWrites: true
    });
    try {
      await nextClient.connect();
      const nextDatabase = nextClient.db(config.mongodbDatabase);
      await nextDatabase.command({ ping: 1 });
      await initializeDatabase(nextDatabase);
      client = nextClient;
      database = nextDatabase;
      return nextDatabase;
    } catch (error) {
      await nextClient.close().catch(() => undefined);
      throw error;
    } finally {
      connecting = undefined;
    }
  })();

  return connecting;
}

export async function closeDatabase(): Promise<void> {
  const current = client;
  client = undefined;
  database = undefined;
  connecting = undefined;
  await current?.close().catch(() => undefined);
}

export { initializeDatabase };
