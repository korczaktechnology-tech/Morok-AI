export interface ConversationContext{userId:string;sessionId:string;conversationId:string;variables:Record<string,unknown>}
export class ContextService {
 create(userId:string,sessionId:string,conversationId:string):ConversationContext{return{userId,sessionId,conversationId,variables:{}}}
 set(context:ConversationContext,key:string,value:unknown){context.variables[key]=value}
}