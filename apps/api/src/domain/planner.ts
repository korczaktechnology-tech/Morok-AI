import type { Db } from "mongodb";
import { TaskService } from "./tasks.js";
import { OrganizerService } from "./organizer.js";
export class PlannerService { constructor(private readonly db:Db){} async today(userId:string){const tasks=await new TaskService(this.db).list(userId,"pending");const events=await new OrganizerService(this.db).calendarList(userId);const now=new Date();const end=new Date(now);end.setHours(23,59,59,999);return {date:now.toISOString().slice(0,10),tasks:tasks.filter(t=>!t.dueAt||t.dueAt<=end),events:events.filter(e=>e.startsAt<=end&&(!e.endsAt||e.endsAt>=now))};} }
