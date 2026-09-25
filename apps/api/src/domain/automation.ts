import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";

export interface Automation { id:string; userId:string; name:string; trigger:{type:"interval"|"at";value:string}; action:{type:string;input:Record<string,unknown>}; enabled:boolean; lastRunAt?:Date; createdAt:Date; updatedAt:Date }
export class AutomationService {
  constructor(private readonly db:Db){}
  async create(userId:string,name:string,trigger:Automation["trigger"],action:Automation["action"]){const now=new Date();const item:Automation={id:randomUUID(),userId,name,trigger,action,enabled:true,createdAt:now,updatedAt:now};await this.db.collection<Automation>("automations").insertOne(item);return item;}
  async list(userId:string){return this.db.collection<Automation>("automations").find({userId}).sort({createdAt:-1}).limit(100).toArray();}
  async setEnabled(userId:string,id:string,enabled:boolean){return this.db.collection<Automation>("automations").findOneAndUpdate({id,userId},{$set:{enabled,updatedAt:new Date()}},{returnDocument:"after"});}
}
