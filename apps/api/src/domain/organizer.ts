import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";

export interface Notification { id:string; userId:string; content:string; read:boolean; createdAt:Date }
export interface CalendarEvent { id:string; userId:string; title:string; startsAt:Date; endsAt?:Date; notes?:string; createdAt:Date; updatedAt:Date }
export interface Contact { id:string; userId:string; name:string; email?:string; phone?:string; notes?:string; createdAt:Date; updatedAt:Date }

export class OrganizerService {
  constructor(private readonly db:Db){}
  async notify(userId:string,content:string){const item:Notification={id:randomUUID(),userId,content,read:false,createdAt:new Date()};await this.db.collection<Notification>("notifications").insertOne(item);return item;}
  async notifications(userId:string){return this.db.collection<Notification>("notifications").find({userId}).sort({createdAt:-1}).limit(100).toArray();}
  async calendarCreate(userId:string,title:string,startsAt:string,endsAt?:string,notes?:string){const now=new Date();const item:CalendarEvent={id:randomUUID(),userId,title,startsAt:new Date(startsAt),endsAt:endsAt?new Date(endsAt):undefined,notes,createdAt:now,updatedAt:now};await this.db.collection<CalendarEvent>("calendar_events").insertOne(item);return item;}
  async calendarList(userId:string){return this.db.collection<CalendarEvent>("calendar_events").find({userId}).sort({startsAt:1}).limit(200).toArray();}
  async contactCreate(userId:string,name:string,email?:string,phone?:string,notes?:string){const now=new Date();const item:Contact={id:randomUUID(),userId,name,email,phone,notes,createdAt:now,updatedAt:now};await this.db.collection<Contact>("contacts").insertOne(item);return item;}
  async contacts(userId:string,q=""){return this.db.collection<Contact>("contacts").find({userId,...(q?{$or:[{name:{$regex:q,"$options":"i"}},{email:{$regex:q,"$options":"i"}},{phone:{$regex:q,"$options":"i"}}]}:{})}).sort({name:1}).limit(200).toArray();}
}
