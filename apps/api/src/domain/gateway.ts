import { config } from "../config.js";

export interface ModelMessage { role: "system" | "user" | "assistant"; content: string }
export interface ModelRequest { message: string; context?: Record<string, unknown>; history?: ModelMessage[]; stream?: boolean }
export interface ModelResponse { content: string; model: string; finished: boolean }
export interface ModelGateway {
  complete(request: ModelRequest): Promise<ModelResponse>;
  stream?(request: ModelRequest): AsyncGenerator<string>;
}

function contextPrompt(context?: Record<string, unknown>): string {
  if (!context) return "";
  const memories = Array.isArray(context.memories) ? context.memories.map(String).join("\n") : "";
  return memories ? "\nMemórias relevantes do usuário:\n" + memories : "";
}

export class OpenAICompatibleGateway implements ModelGateway {
  async complete(request: ModelRequest): Promise<ModelResponse> {
    if (!config.modelApiUrl) {
      return {
        content: "Estou operacional. A integração de modelo externo ainda não foi configurada neste ambiente. Posso continuar usando minhas funções locais.",
        model: "local-fallback",
        finished: true
      };
    }
    const response = await fetch(config.modelApiUrl.replace(/\/$/, "") + "/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", ...(config.modelApiKey ? { authorization: `Bearer ${config.modelApiKey}` } : {}) },
      body: JSON.stringify({
        model: config.modelName,
        temperature: config.modelTemperature,
        messages: [
          { role: "system", content: "Você é Morok, um assistente pessoal. Seja claro, contextual e seguro." },
          ...(request.history ?? []),
          { role: "user", content: request.message + contextPrompt(request.context) }
        ]
      }),
      signal: AbortSignal.timeout(30_000)
    });
    if (!response.ok) throw new Error(`model_gateway_http_${response.status}`);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("model_gateway_empty_response");
    return { content, model: config.modelName, finished: true };
  }

  async *stream(request: ModelRequest): AsyncGenerator<string> {
    if (!config.modelApiUrl) { yield (await this.complete(request)).content; return; }
    const response = await fetch(config.modelApiUrl.replace(/\/$/, "") + "/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", ...(config.modelApiKey ? { authorization: `Bearer ${config.modelApiKey}` } : {}) },
      body: JSON.stringify({
        model: config.modelName, temperature: config.modelTemperature, stream: true,
        messages: [
          { role: "system", content: "Você é Morok, um assistente pessoal. Seja claro, contextual e seguro." },
          ...(request.history ?? []),
          { role: "user", content: request.message + contextPrompt(request.context) }
        ]
      }),
      signal: AbortSignal.timeout(60_000)
    });
    if (!response.ok || !response.body) throw new Error(`model_gateway_stream_http_${response.status}`);
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
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const parsed = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
          const chunk = parsed.choices?.[0]?.delta?.content;
          if (chunk) yield chunk;
        } catch { /* ignore malformed keep-alive chunks */ }
      }
    }
  }
}

export { OpenAICompatibleGateway as MorokModelGateway };
