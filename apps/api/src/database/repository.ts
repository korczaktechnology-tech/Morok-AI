import type {
  Db,
  Document,
  Filter,
  OptionalUnlessRequiredId,
  UpdateFilter
} from "mongodb";

export class Repository {
  constructor(private readonly db: Db) {}

  async create<T extends Document>(
    collection: string,
    document: OptionalUnlessRequiredId<T>
  ) {
    return this.db.collection<T>(collection).insertOne(document);
  }

  async findOne<T extends Document>(
    collection: string,
    filter: Filter<T>
  ) {
    return this.db.collection<T>(collection).findOne(filter);
  }

  async updateOne<T extends Document>(
    collection: string,
    filter: Filter<T>,
    update: UpdateFilter<T>
  ) {
    return this.db.collection<T>(collection).updateOne(filter, update);
  }
}
