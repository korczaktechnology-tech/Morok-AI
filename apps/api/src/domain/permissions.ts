import type {Permission} from "./types.js";
export const corePermissions: Permission[] = [
 {id:"conversation.read",name:"Ler conversas",description:"Permite consultar conversas"},
 {id:"task.execute",name:"Executar tarefas",description:"Permite executar tarefas"},
 {id:"tool.execute",name:"Executar ferramentas",description:"Permite executar ferramentas"}
];
export function requiresConfirmation(id:string){return id==="task.execute"||id==="tool.execute"}