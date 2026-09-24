import type { Db, Document } from "mongodb";

export class Repository {
  constructor(private readonly db: Db) {}
  async create<T extends Document>(collection: string, document: T) {
    return this.db.collection<T>(collection).insertOne(document);
  }
  async findOne<T extends Document>(collection: string, filter: Document) {
    return this.db.collection<T>(collection).findOne(filter);
  }
  async updateOne(collection: string, filter: Document, update: Document) {
    return this.db.collection(collection).updateOne(filter, update);
  }
}