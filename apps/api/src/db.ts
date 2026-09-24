import { MongoClient, type Db } from 'mongodb';
import { config } from './config.js';
import { initializeDatabase } from './database/schema.js';

let client: MongoClient | undefined;
let database: Db | undefined;

export async function connectDatabase(): Promise<Db> {
  if (database) return database;

  client = new MongoClient(config.mongodbUri);
  await client.connect();
  database = client.db(config.mongodbDatabase);
  await database.command({ ping: 1 });
  await initializeDatabase(database);

  return database;
}

export async function closeDatabase(): Promise<void> {
  await client?.close();
  client = undefined;
  database = undefined;
}
