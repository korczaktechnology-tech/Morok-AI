export interface Actor{userId:string;roles:string[]}
export function can(actor:Actor,permission:string){if(actor.roles.includes("admin"))return true;return permission==="conversation.read"&&actor.roles.includes("user")}
export function assertPermission(actor:Actor,permission:string){if(!can(actor,permission))throw new Error("permission_denied")}