import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { MongoClient } from "mongodb";
import { config } from "./config.js";
import { connectDatabase, initializeDatabase } from "./db.js";
import { coreCommands } from "./domain/commands.js";
import { corePermissions, decidePermission, requiresConfirmation } from "./domain/permissions.js";
import { createCoreToolRegistry } from "./domain/tools.js";
import { MOROK_IDENTITY } from "./domain/identity.js";
import { MorokModelGateway } from "./domain/gateway.js";
import { AuthService } from "./domain/auth.js";
import { MemoryService } from "./domain/memory.js";
import { ContextService } from "./domain/context.js";
import { SessionService } from "./domain/session.js";
import { assertPermission } from "./domain/security.js";
import { detectIntent } from "./domain/intent.js";
import { TaskService } from "./domain/tasks.js";
import { FileService } from "./domain/files.js";
import { OrganizerService } from "./domain/organizer.js";
import { AutomationService } from "./domain/automation.js";
import { registerPhase1Routes } from "./phase1-routes.js";

interface ConversationMessage { role:string;content:string;model?:string;createdAt:Date }
interface ConversationDocument { id:string;userId:string;createdAt:Date;updatedAt:Date;messages:ConversationMessage[] }

export function buildApp(){
  const app=Fastify({logger:{level:config.logLevel}}); const gateway=new MorokModelGateway();
  void registerPhase1Routes(app);
  app.register(cors,{origin:config.corsOrigin==="*" ? true:config.corsOrigin});

  app.get("/health",async()=>({status:"ok",service:"morok-api",environment:config.nodeEnv}));
  app.get("/api/v1/status",async()=>({status:"ok",identity:MOROK_IDENTITY,phase:1,capabilities:{commands:coreCommands.length,permissions:corePermissions.length,tools:createCoreToolRegistry(await connectDatabase()).list().length,modelGateway:Boolean(config.modelApiUrl),voice:true,web:true,files:true,automation:true,organizer:true}}));
  app.get("/api/v1/commands",async()=>({commands:coreCommands}));
  app.get("/api/v1/permissions",async()=>({permissions:corePermissions}));
  app.get("/api/v1/permissions/:id",async(req)=>{const {id}=req.params as {id:string};return {permission:id,requiresConfirmation:requiresConfirmation(id)};});
  app.post("/api/v1/permissions/check",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});const body=req.body as {permission?:string;confirmed?:boolean};if(!body?.permission)return reply.code(400).send({error:"permission_required"});return decidePermission(auth.user.roles,body.permission,body.confirmed===true);});

  app.post("/api/v1/auth/register",async(req,reply)=>{const body=req.body as {email?:string;password?:string};if(!body?.email||!body?.password)return reply.code(400).send({error:"credentials_required"});try{return reply.code(201).send(await new AuthService(await connectDatabase()).register(body.email,body.password));}catch(error){if(error instanceof Error&&error.message==="email_already_registered")return reply.code(409).send({error:error.message});if(error instanceof Error&&["invalid_email","weak_password"].includes(error.message))return reply.code(400).send({error:error.message});throw error;}});
  app.post("/api/v1/auth/login",async(req,reply)=>{const body=req.body as {email?:string;password?:string};if(!body?.email||!body?.password)return reply.code(400).send({error:"credentials_required"});try{return await new AuthService(await connectDatabase()).login(body.email,body.password);}catch(error){if(error instanceof Error&&error.message==="invalid_credentials")return reply.code(401).send({error:error.message});throw error;}});
  app.post("/api/v1/auth/logout",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});await (await connectDatabase()).collection("sessions").deleteOne({id:auth.sessionId,userId:auth.user.id});return {ok:true};});
  app.get("/api/v1/auth/me",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});return {user:auth.user};});

  app.get("/api/v1/conversations",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});assertPermission({userId:auth.user.id,roles:auth.user.roles},"conversation.read");const rows=await (await connectDatabase()).collection<ConversationDocument>("conversations").find({userId:auth.user.id}).sort({updatedAt:-1}).limit(100).project({messages:{$slice:-1}}).toArray();return {conversations:rows};});
  app.get("/api/v1/conversations/:id",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});assertPermission({userId:auth.user.id,roles:auth.user.roles},"conversation.read");const {id}=req.params as {id:string};const conversation=await (await connectDatabase()).collection<ConversationDocument>("conversations").findOne({id,userId:auth.user.id});if(!conversation)return reply.code(404).send({error:"conversation_not_found"});return {conversation};});

  app.post("/api/v1/memories",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});const body=req.body as {content?:string};if(!body?.content?.trim())return reply.code(400).send({error:"content_required"});return reply.code(201).send({memory:await new MemoryService(await connectDatabase()).create(auth.user.id,body.content)});});
  app.get("/api/v1/memories",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});const {q}=req.query as {q?:string};return {memories:await new MemoryService(await connectDatabase()).search(auth.user.id,q??"")};});
  app.delete("/api/v1/memories/:id",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});const {id}=req.params as {id:string};const result=await (await connectDatabase()).collection("memories").deleteOne({id,userId:auth.user.id});return result.deletedCount?{ok:true}:reply.code(404).send({error:"memory_not_found"});});

  app.get("/api/v1/tasks",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});return {tasks:await new TaskService(await connectDatabase()).list(auth.user.id)};});
  app.post("/api/v1/tasks",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});const b=req.body as {title?:string;description?:string;dueAt?:string};if(!b?.title?.trim())return reply.code(400).send({error:"title_required"});return reply.code(201).send({task:await new TaskService(await connectDatabase()).create(auth.user.id,b.title,b.description,b.dueAt)});});
  app.patch("/api/v1/tasks/:id",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});const b=req.body as {status?: "pending"|"completed"|"cancelled"};if(!b?.status)return reply.code(400).send({error:"status_required"});const task=await new TaskService(await connectDatabase()).update(auth.user.id,(req.params as {id:string}).id,b.status);return task?{task}:reply.code(404).send({error:"task_not_found"});});

  app.get("/api/v1/notifications",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});return {notifications:await new OrganizerService(await connectDatabase()).notifications(auth.user.id)};});
  app.post("/api/v1/notifications",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});const b=req.body as {content?:string};if(!b?.content?.trim())return reply.code(400).send({error:"content_required"});return reply.code(201).send({notification:await new OrganizerService(await connectDatabase()).notify(auth.user.id,b.content)});});
  app.get("/api/v1/calendar",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});return {events:await new OrganizerService(await connectDatabase()).calendarList(auth.user.id)};});
  app.post("/api/v1/calendar",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});const b=req.body as {title?:string;startsAt?:string;endsAt?:string;notes?:string};if(!b?.title||!b?.startsAt)return reply.code(400).send({error:"title_and_startsAt_required"});return reply.code(201).send({event:await new OrganizerService(await connectDatabase()).calendarCreate(auth.user.id,b.title,b.startsAt,b.endsAt,b.notes)});});
  app.get("/api/v1/contacts",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});const {q}=req.query as {q?:string};return {contacts:await new OrganizerService(await connectDatabase()).contacts(auth.user.id,q??"")};});
  app.post("/api/v1/contacts",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});const b=req.body as {name?:string;email?:string;phone?:string;notes?:string};if(!b?.name)return reply.code(400).send({error:"name_required"});return reply.code(201).send({contact:await new OrganizerService(await connectDatabase()).contactCreate(auth.user.id,b.name,b.email,b.phone,b.notes)});});

  app.get("/api/v1/automations",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});return {automations:await new AutomationService(await connectDatabase()).list(auth.user.id)};});
  app.post("/api/v1/automations",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});const b=req.body as {name?:string;trigger?:{type:"interval"|"at";value:string};action?:{type:string;input:Record<string,unknown>}};if(!b?.name||!b.trigger||!b.action)return reply.code(400).send({error:"automation_fields_required"});return reply.code(201).send({automation:await new AutomationService(await connectDatabase()).create(auth.user.id,b.name,b.trigger,b.action)});});
  app.patch("/api/v1/automations/:id",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});const b=req.body as {enabled?:boolean};if(typeof b?.enabled!=="boolean")return reply.code(400).send({error:"enabled_required"});const automation=await new AutomationService(await connectDatabase()).setEnabled(auth.user.id,(req.params as {id:string}).id,b.enabled);return automation?{automation}:reply.code(404).send({error:"automation_not_found"});});

  app.get("/api/v1/files",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});const {q}=req.query as {q?:string};return {files:await new FileService(await connectDatabase()).list(auth.user.id,q??"")};});
  app.post("/api/v1/files",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});const b=req.body as {name?:string;mimeType?:string;contentBase64?:string};if(!b?.name||!b?.contentBase64)return reply.code(400).send({error:"name_and_content_required"});try{return reply.code(201).send({file:await new FileService(await connectDatabase()).save(auth.user.id,b.name,b.mimeType??"application/octet-stream",Buffer.from(b.contentBase64,"base64"))});}catch(e){if(e instanceof Error&&e.message==="file_too_large")return reply.code(413).send({error:e.message});throw e;}});
  app.get("/api/v1/files/:id",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});const file=await new FileService(await connectDatabase()).get(auth.user.id,(req.params as {id:string}).id);if(!file)return reply.code(404).send({error:"file_not_found"});return {file};});
  app.get("/api/v1/files/:id/download",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});const file=await new FileService(await connectDatabase()).get(auth.user.id,(req.params as {id:string}).id);if(!file)return reply.code(404).send({error:"file_not_found"});return reply.header("content-type",file.mimeType).header("content-disposition",`attachment; filename="${file.name.replace(/"/g,"")}"`).send(Buffer.from(file.content,"base64"));});
  app.patch("/api/v1/files/:id",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});const b=req.body as {name?:string};if(!b?.name)return reply.code(400).send({error:"name_required"});const file=await new FileService(await connectDatabase()).rename(auth.user.id,(req.params as {id:string}).id,b.name);return file?{file}:reply.code(404).send({error:"file_not_found"});});
  app.delete("/api/v1/files/:id",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});const ok=await new FileService(await connectDatabase()).delete(auth.user.id,(req.params as {id:string}).id);return ok?{ok:true}:reply.code(404).send({error:"file_not_found"});});

  app.get("/api/v1/web/open",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});const {url}=req.query as {url?:string};if(!url)return reply.code(400).send({error:"url_required"});const {WebService}=await import("./domain/web.js");return {page:await new WebService().open(url)};});
  app.get("/api/v1/web/search",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});const {q}=req.query as {q?:string};if(!q)return reply.code(400).send({error:"q_required"});const {WebService}=await import("./domain/web.js");return {results:await new WebService().search(q)};});

  app.post("/api/v1/tools/:id/execute",async(req,reply)=>{const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});const id=(req.params as {id:string}).id;const body=req.body as {input?:unknown;confirmed?:boolean};const decision=decidePermission(auth.user.roles,"tool.execute",body?.confirmed===true);const db=await connectDatabase();if(!decision.allowed){await db.collection("audit_logs").insertOne({action:decision.reason==="confirmation_required"?"tool.confirmation.required":"tool.execution.denied",actorId:auth.user.id,toolId:id,createdAt:new Date()});return reply.code(decision.reason==="confirmation_required"?409:403).send(decision);}try{const result=await createCoreToolRegistry(db).execute(id,{...(typeof body?.input==="object"&&body.input?body.input:{}),userId:auth.user.id},{userId:auth.user.id,roles:auth.user.roles,confirmed:body?.confirmed===true});await db.collection("tool_executions").insertOne({id:randomUUID(),toolId:id,actorId:auth.user.id,input:body?.input,result,confirmed:true,createdAt:new Date()});await db.collection("audit_logs").insertOne({action:"tool.execution.completed",actorId:auth.user.id,toolId:id,createdAt:new Date()});return {ok:true,result};}catch(error){const code=error instanceof Error&&error.message==="tool_not_found"?404:400;return reply.code(code).send({error:error instanceof Error?error.message:"tool_execution_failed"});}});

  app.post("/api/v1/messages",async(req,reply)=>{
    const db=await connectDatabase(); const auth=await authenticateRequest(req.headers.authorization); if(!auth)return reply.code(401).send({error:"unauthorized"});
    const body=req.body as {message?:string;conversationId?:string;confirmed?:boolean}; if(!body?.message?.trim())return reply.code(400).send({error:"message_required"});
    const message=body.message.trim(); const now=new Date(); const conversationId=body.conversationId??randomUUID();
    const conversations=db.collection<ConversationDocument>("conversations");
    await conversations.updateOne({id:conversationId,userId:auth.user.id},{$set:{userId:auth.user.id,updatedAt:now},$setOnInsert:{id:conversationId,createdAt:now,messages:[]}},{upsert:true});
    await conversations.updateOne({id:conversationId,userId:auth.user.id},{$push:{messages:{role:"user",content:message,createdAt:now}}});
    const context=await new ContextService(db).create(auth.user.id,auth.sessionId,conversationId); const intent=detectIntent(message);
    let responseContent:string|undefined;
    if(intent.kind!=="chat"){
      const registry=createCoreToolRegistry(db); const input={...intent.parameters,userId:auth.user.id};
      const toolMap:Record<string,string>={"memory.save":"memory.save","memory.search":"memory.search","task.create":"task.create","task.list":"task.list","web.search":"web.search","web.open":"web.open","file.search":"file.search","notification.create":"notification.create","calendar.create":"calendar.create"};
      const toolId=toolMap[intent.kind];
      if(toolId){
        const decision=decidePermission(auth.user.roles,"tool.execute",body.confirmed===true);
        if(!decision.allowed){
          await db.collection("audit_logs").insertOne({action:decision.reason==="confirmation_required"?"intent.confirmation.required":"intent.execution.denied",actorId:auth.user.id,conversationId,toolId,createdAt:new Date()});
          if(decision.requiresConfirmation) return reply.code(409).send({error:"confirmation_required",confirmationRequired:true,intent,toolId,conversationId});
          return reply.code(403).send({error:"permission_denied",intent,toolId,conversationId});
        }
        try{const result=await registry.execute(toolId,input,{userId:auth.user.id,roles:auth.user.roles,confirmed:body.confirmed===true});responseContent=JSON.stringify(result,null,2);}
        catch(error){responseContent=error instanceof Error?error.message:"Falha ao executar intenção";}
      }
    }
    if(!responseContent){responseContent=(await gateway.complete({message,context:context as unknown as Record<string,unknown>,history:context.history.map((item) => ({ role: (item.role === "user" || item.role === "assistant" || item.role === "system") ? item.role : "user", content: item.content }))})).content;}
    await conversations.updateOne({id:conversationId,userId:auth.user.id},{$push:{messages:{role:"assistant",content:responseContent,model:config.modelName,createdAt:new Date()}},$set:{updatedAt:new Date()}});
    await db.collection("audit_logs").insertOne({action:"conversation.message.completed",actorId:auth.user.id,conversationId,sessionId:auth.sessionId,intent:intent.kind,createdAt:new Date()});
    return {content:responseContent,model:config.modelName,finished:true,conversationId,sessionId:auth.sessionId,intent};
  });

  app.get("/api/v1/messages/stream",async(req,reply)=>{
    const auth=await authenticateRequest(req.headers.authorization);if(!auth)return reply.code(401).send({error:"unauthorized"});
    const q=req.query as {message?:string;conversationId?:string};if(!q.message?.trim())return reply.code(400).send({error:"message_required"});
    const db=await connectDatabase();const conversationId=q.conversationId??randomUUID();const now=new Date();const conversations=db.collection<ConversationDocument>("conversations");
    await conversations.updateOne({id:conversationId,userId:auth.user.id},{$set:{userId:auth.user.id,updatedAt:now},$setOnInsert:{id:conversationId,createdAt:now,messages:[]}},{upsert:true});
    await conversations.updateOne({id:conversationId,userId:auth.user.id},{$push:{messages:{role:"user",content:q.message.trim(),createdAt:now}}});
    const context=await new ContextService(db).create(auth.user.id,auth.sessionId,conversationId);
    reply.hijack();reply.raw.writeHead(200,{"content-type":"text/event-stream; charset=utf-8","cache-control":"no-cache","connection":"keep-alive","x-accel-buffering":"no"});
    let full="";
    try{for await(const chunk of gateway.stream!({message:q.message.trim(),context:context as unknown as Record<string,unknown>,history:context.history.map((item)=>({role:(item.role==="user"||item.role==="assistant"||item.role==="system")?item.role:"user",content:item.content}))})){full+=chunk;reply.raw.write(`data: ${JSON.stringify({chunk,conversationId})}\n\n`);}await conversations.updateOne({id:conversationId,userId:auth.user.id},{$push:{messages:{role:"assistant",content:full,model:config.modelName,createdAt:new Date()}},$set:{updatedAt:new Date()}});await db.collection("audit_logs").insertOne({action:"conversation.message.stream_completed",actorId:auth.user.id,conversationId,sessionId:auth.sessionId,createdAt:new Date()});reply.raw.write("data: [DONE]\n\n");reply.raw.end();}catch(error){reply.raw.write(`event: error\ndata: ${JSON.stringify({error:error instanceof Error?error.message:"stream_failed"})}\n\n`);reply.raw.end();}
  });

  app.get("/health/database",async(_req,reply)=>{const client=new MongoClient(config.mongodbUri,{serverSelectionTimeoutMS:3000});try{await client.connect();const db=client.db(config.mongodbDatabase);await db.command({ping:1});await initializeDatabase(db);return {status:"ok",service:"mongodb",database:config.mongodbDatabase};}catch{return reply.code(503).send({status:"error",service:"mongodb"});}finally{await client.close().catch(()=>undefined);}});
  app.setErrorHandler((error,_req,reply)=>{app.log.error(error);const statusCode=typeof error==="object"&&error!==null&&"statusCode" in error&&typeof error.statusCode==="number"?error.statusCode:500;return reply.code(statusCode).send({error:"internal_error"});});
  return app;
}
async function authenticateRequest(authorization:string|undefined){if(!authorization?.startsWith("Bearer "))return null;const db=await connectDatabase();const token=authorization.slice(7);const service=new AuthService(db);const user=await service.authenticate(token);if(!user)return null;const session=await new SessionService(db).getByToken(token);if(!session||session.userId!==user.id)return null;return {user,sessionId:session.id};}
