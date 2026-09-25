import { config } from "../config.js";

export interface ModelMessage { role: "system" | "user" | "assistant"; content: string }
export interface ModelGateway { complete(request: ModelRequest): Promise<ModelResponse>; stream?(request: ModelRequest): AsyncGenerator<string> }
export interface ModelRequest { message: string; context?: Record<string, unknown>; history?: ModelMessage[]; stream?: boolean }
export interface ModelResponse { content: string; model: string; finished: boolean }

function contextPrompt(context?: Record<string, unknown>): string {
  if (!context) return "";
  const memories = Array.isArray(context.memories) ? context.memories.map(String).join("\n") : "";
  return memories ? "\nMemórias relevantes do usuário:\n" + memories : "";
}

type Provider={url:string;key?:string;name:string};

function providers():Provider[] {
  const list:Provider[]=[];
  if(config.modelApiUrl) list.push({url:config.modelApiUrl,key:config.modelApiKey,name:config.modelName});
  if(config.modelFallbackApiUrl && config.modelFallbackApiUrl!==config.modelApiUrl) list.push({url:config.modelFallbackApiUrl,key:config.modelFallbackApiKey,name:config.modelName+"-fallback"});
  return list;
}

function payload(request:ModelRequest,stream=false){
  return {model:config.modelName,temperature:config.modelTemperature,stream,messages:[
    {role:"system",content:"Você é Morok, um assistente pessoal. Seja claro, contextual e seguro."},
    ...(request.history??[]),
    {role:"user",content:request.message+contextPrompt(request.context)}
  ]};
}

async function completeProvider(provider:Provider,request:ModelRequest):Promise<ModelResponse>{
  const response=await fetch(provider.url.replace(/\/$/,"")+"/chat/completions",{method:"POST",headers:{"content-type":"application/json",...(provider.key?{authorization:"Bearer "+provider.key}:{})},body:JSON.stringify(payload(request)),signal:AbortSignal.timeout(30000)});
  if(!response.ok) throw new Error("model_gateway_http_"+response.status);
  const data=await response.json() as {choices?:Array<{message?:{content?:string}}>};
  const content=data.choices?.[0]?.message?.content?.trim();
  if(!content) throw new Error("model_gateway_empty_response");
  return {content,model:provider.name,finished:true};
}

export class OpenAICompatibleGateway implements ModelGateway {
  async complete(request:ModelRequest):Promise<ModelResponse>{
    const ps=providers();
    if(!ps.length) return {content:"Estou operacional. A integração de modelo externo ainda não foi configurada neste ambiente. Posso continuar usando minhas funções locais.",model:"local-fallback",finished:true};
    let last:unknown;
    for(const provider of ps){try{return await completeProvider(provider,request)}catch(error){last=error}}
    throw last instanceof Error?last:new Error("model_gateway_unavailable");
  }

  async *stream(request:ModelRequest):AsyncGenerator<string>{
    const ps=providers();
    if(!ps.length){yield(await this.complete(request)).content;return;}
    let last:unknown;
    for(const provider of ps){
      try{
        const response=await fetch(provider.url.replace(/\/$/,"")+"/chat/completions",{method:"POST",headers:{"content-type":"application/json",...(provider.key?{authorization:"Bearer "+provider.key}:{})},body:JSON.stringify(payload(request,true)),signal:AbortSignal.timeout(60000)});
        if(!response.ok||!response.body) throw new Error("model_gateway_stream_http_"+response.status);
        const reader=response.body.getReader();const decoder=new TextDecoder();let buffer="";
        while(true){
          const {done,value}=await reader.read();if(done)break;
          buffer+=decoder.decode(value,{stream:true});const lines=buffer.split("\n");buffer=lines.pop()??"";
          for(const line of lines){if(!line.startsWith("data:"))continue;const raw=line.slice(5).trim();if(raw==="[DONE]")return;try{const parsed=JSON.parse(raw) as {choices?:Array<{delta?:{content?:string}}>};const chunk=parsed.choices?.[0]?.delta?.content;if(chunk)yield chunk;}catch{}}
        }
        return;
      }catch(error){last=error}
    }
    throw last instanceof Error?last:new Error("model_gateway_unavailable");
  }
}
export { OpenAICompatibleGateway as MorokModelGateway };
