import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";

export interface Task { id:string; userId:string; title:string; description?:string; status:"pending"|"completed"|"cancelled"; dueAt?:Date; createdAt:Date; updatedAt:Date }

export class TaskService {
  constructor(private readonly db:Db){}
  async create(userId:string,title:string,description?:string,dueAt?:string):Promise<Task>{
    const now=new Date(); const task:Task={id:randomUUID(),userId,title:title.trim(),description,status:"pending",dueAt:dueAt?new Date(dueAt):undefined,createdAt:now,updatedAt:now};
    await this.db.collection<Task>("tasks").insertOne(task); return task;
  }
  async list(userId:string,status?:Task["status"]){ return this.db.collection<Task>("tasks").find({userId,...(status?{status}:{})}).sort({dueAt:1,createdAt:-1}).limit(200).toArray(); }
  async update(userId:string,id:string,status:Task["status"]){ const result=await this.db.collection<Task>("tasks").findOneAndUpdate({id,userId},{$set:{status,updatedAt:new Date()}},{returnDocument:"after"}); return result; }
}
