import type { Db } from "mongodb";
import type { Tool } from "./types.js";
import { FileService } from "./files.js";
import { MemoryService } from "./memory.js";
import { TaskService } from "./tasks.js";
import { WebService } from "./web.js";
import { OrganizerService } from "./organizer.js";

export class ToolRegistry {
  private readonly tools=new Map<string,Tool>();
  register(tool:Tool){this.tools.set(tool.id,tool);}
  get(id:string){return this.tools.get(id);}
  list(){return [...this.tools.values()];}
  async execute(id:string,input:unknown){const tool=this.get(id);if(!tool)throw new Error("tool_not_found");if(!tool.execute)throw new Error("tool_not_executable");return tool.execute(input);}
}

export function createCoreToolRegistry(db:Db):ToolRegistry {
  const r=new ToolRegistry(); const web=new WebService(); const files=new FileService(db); const memories=new MemoryService(db); const tasks=new TaskService(db); const organizer=new OrganizerService(db);
  r.register({id:"web.search",name:"Pesquisa na web",description:"Pesquisa informações públicas na internet.",execute:async(input)=>web.search(String((input as {query?:string})?.query??""))});
  r.register({id:"web.open",name:"Abrir página",description:"Abre e lê uma página web pública.",execute:async(input)=>web.open(String((input as {url?:string})?.url??""))});
  r.register({id:"memory.save",name:"Salvar memória",description:"Salva uma memória persistente.",execute:async(input)=>memories.create(String((input as {userId:string;content:string}).userId),String((input as {content:string}).content))});
  r.register({id:"memory.search",name:"Pesquisar memória",description:"Pesquisa memórias do usuário.",execute:async(input)=>memories.search(String((input as {userId:string}).userId),String((input as {query?:string})?.query??""))});
  r.register({id:"task.create",name:"Criar tarefa",description:"Cria uma tarefa.",execute:async(input)=>tasks.create(String((input as {userId:string;title:string}).userId),String((input as {title:string}).title),String((input as {description?:string}).description??""),(input as {dueAt?:string}).dueAt)});
  r.register({id:"task.list",name:"Listar tarefas",description:"Lista tarefas do usuário.",execute:async(input)=>tasks.list(String((input as {userId:string}).userId))});
  r.register({id:"notification.create",name:"Criar notificação",description:"Cria uma notificação interna.",execute:async(input)=>organizer.notify(String((input as {userId:string;content:string}).userId),String((input as {content:string}).content))});
  r.register({id:"calendar.create",name:"Criar evento",description:"Cria evento no calendário interno.",execute:async(input)=>organizer.calendarCreate(String((input as {userId:string;title:string;startsAt:string}).userId),String((input as {title:string}).title),String((input as {startsAt:string}).startsAt),(input as {endsAt?:string}).endsAt,(input as {notes?:string}).notes)});
  r.register({id:"file.search",name:"Pesquisar arquivos",description:"Pesquisa arquivos enviados ao Morok.",execute:async(input)=>files.list(String((input as {userId:string}).userId),String((input as {query?:string})?.query??""))});
  return r;
}
