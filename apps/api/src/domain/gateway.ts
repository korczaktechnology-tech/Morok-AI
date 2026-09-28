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

type Provider = { url: string; key?: string; username: string; name: string };

function providers(): Provider[] {
  const list: Provider[] = [];
  if (config.modelApiUrl)
    list.push({ url: config.modelApiUrl, key: config.modelApiKey, username: config.modelApiUsername, name: config.modelName });
  if (config.modelFallbackApiUrl && config.modelFallbackApiUrl !== config.modelApiUrl)
    list.push({ url: config.modelFallbackApiUrl, key: config.modelFallbackApiKey, username: config.modelApiUsername, name: config.modelName + "-fallback" });
  return list;
}

function payload(request: ModelRequest, stream = false) {
  return {
    model: config.modelName,
    temperature: config.modelTemperature,
    max_tokens: 256,
    stream,
    messages: [
      { role: "system", content: "Você é Morok, um assistente pessoal. Seja claro, contextual e seguro." },
      ...(request.history ?? []),
      { role: "user", content: request.message + contextPrompt(request.context) }
    ]
  };
}

function headers(provider: Provider) {
  const authorization = provider.key
    ? "Basic " + Buffer.from(provider.username + ":" + provider.key).toString("base64")
    : undefined;

  return {
    accept: "application/json",
    "content-type": "application/json",
    ...(authorization ? { authorization } : {})
  };
}

function endpoint(provider: Provider) {
  const url = provider.url.trim().replace(/\/$/, "");
  return url.endsWith("/v1") ? url + "/chat/completions" : url + "/v1/chat/completions";
}

async function upstreamError(response: Response, prefix: string) {
  let detail = "";
  try {
    const text = await response.text();
    if (text) {
      try {
        const parsed = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
        const value = typeof parsed.error === "string"
          ? parsed.error
          : parsed.error?.message ?? parsed.message;
        if (value) detail = String(value).slice(0, 300);
      } catch {
        detail = text.slice(0, 300);
      }
    }
  } catch {}

  throw new Error(prefix + response.status + (detail ? "_" + detail.replace(/[^a-zA-Z0-9_.:-]+/g, "_") : ""));
}

async function wait(ms:number){return new Promise(resolve=>setTimeout(resolve,ms));}

async function requestWithRetry(url:string, init:RequestInit):Promise<Response>{
  let last:unknown;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch(url,init);
      if(response.ok || ![408,425,429,502,503,504].includes(response.status) || attempt===2)return response;
      await wait(750*(attempt+1));
    }catch(error){
      last=error;
      if(attempt===2)throw error;
      await wait(750*(attempt+1));
    }
  }
  throw last instanceof Error?last:new Error("model_gateway_unavailable");
}

async function completeProvider(provider: Provider, request: ModelRequest): Promise<ModelResponse> {
  const response = await requestWithRetry(endpoint(provider), {
    method: "POST",
    headers: headers(provider),
    body: JSON.stringify(payload(request)),
    signal: AbortSignal.timeout(90000)
  });

  if (!response.ok) await upstreamError(response, "model_gateway_http_");

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("model_gateway_empty_response");

  return { content, model: provider.name, finished: true };
}

export class OpenAICompatibleGateway implements ModelGateway {
  async complete(request: ModelRequest): Promise<ModelResponse> {
    const ps = providers();
    if (!ps.length)
      return {
        content: "Estou operacional. A integração de modelo externo ainda não foi configurada neste ambiente. Posso continuar usando minhas funções locais.",
        model: "local-fallback",
        finished: true
      };

    let last: unknown;
    for (const provider of ps) {
      try {
        return await completeProvider(provider, request);
      } catch (error) {
        last = error;
      }
    }
    throw last instanceof Error ? last : new Error("model_gateway_unavailable");
  }

  async *stream(request: ModelRequest): AsyncGenerator<string> {
    const ps = providers();
    if (!ps.length) {
      yield (await this.complete(request)).content;
      return;
    }

    let last: unknown;
    for (const provider of ps) {
      try {
        const response = await fetch(endpoint(provider), {
          method: "POST",
          headers: headers(provider),
          body: JSON.stringify(payload(request, true)),
          signal: AbortSignal.timeout(180000)
        });

        if (!response.ok) await upstreamError(response, "model_gateway_stream_http_");
        if (!response.body) throw new Error("model_gateway_stream_empty_body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const raw = line.slice(5).trim();
            if (raw === "[DONE]") return;

            try {
              const parsed = JSON.parse(raw) as { choices?: Array<{ delta?: { content?: string } }> };
              const chunk = parsed.choices?.[0]?.delta?.content;
              if (chunk) yield chunk;
            } catch {}
          }
        }

        const tail = decoder.decode();
        if (tail) buffer += tail;
        if (buffer.startsWith("data:")) {
          const raw = buffer.slice(5).trim();
          if (raw && raw !== "[DONE]") {
            try {
              const parsed = JSON.parse(raw) as { choices?: Array<{ delta?: { content?: string } }> };
              const chunk = parsed.choices?.[0]?.delta?.content;
              if (chunk) yield chunk;
            } catch {}
          }
        }
        return;
      } catch (error) {
        last = error;
      }
    }

    throw last instanceof Error ? last : new Error("model_gateway_unavailable");
  }
}

export { OpenAICompatibleGateway as MorokModelGateway };
