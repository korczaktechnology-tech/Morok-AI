import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { config } from "../config.js";

export interface StoredFile { id:string; userId:string; name:string; mimeType:string; size:number; content:string; createdAt:Date; updatedAt:Date }
export class FileService {
  constructor(private readonly db:Db){}
  async save(userId:string,name:string,mimeType:string,buffer:Buffer){
    if(buffer.byteLength>config.maxFileBytes) throw new Error("file_too_large");
    const now=new Date(); const file:StoredFile={id:randomUUID(),userId,name:name.trim(),mimeType,size:buffer.byteLength,content:buffer.toString("base64"),createdAt:now,updatedAt:now};
    await this.db.collection<StoredFile>("files").insertOne(file); return {...file,content:undefined};
  }
  async get(userId:string,id:string){ return this.db.collection<StoredFile>("files").findOne({id,userId}); }
  async list(userId:string,q=""){ const filter=q.trim()?{userId,$or:[{name:{$regex:q,"$options":"i"}},{mimeType:{$regex:q,"$options":"i"}}]}:{userId}; return this.db.collection<StoredFile>("files").find(filter).sort({updatedAt:-1}).limit(100).project({content:0}).toArray(); }
  async delete(userId:string,id:string){ const r=await this.db.collection("files").deleteOne({id,userId}); return r.deletedCount===1; }
  async rename(userId:string,id:string,name:string){ const r=await this.db.collection<StoredFile>("files").findOneAndUpdate({id,userId},{$set:{name:name.trim(),updatedAt:new Date()}},{returnDocument:"after",projection:{content:0}}); return r; }
  async readText(userId:string,id:string){ const f=await this.get(userId,id); if(!f) return null; const buffer=Buffer.from(f.content,"base64"); if(f.mimeType.startsWith("text/") || /json|javascript|typescript|xml|csv|markdown/.test(f.mimeType) || /\.(txt|md|json|csv|xml|ts|tsx|js|css|html)$/i.test(f.name)) return buffer.toString("utf8"); return null; }
}
