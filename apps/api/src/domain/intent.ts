export type IntentKind =
  | "chat" | "memory.save" | "memory.search" | "task.create" | "task.list"
  | "web.search" | "web.open" | "file.search" | "notification.create" | "calendar.create";

export interface Intent { kind: IntentKind; confidence: number; parameters: Record<string, string> }

export function detectIntent(message: string): Intent {
  const text = message.trim();
  const lower = text.toLowerCase();
  if (/\b(lembre|memorize|memoriza|guarde|salve)\b/.test(lower)) return { kind:"memory.save", confidence:.9, parameters:{content:text.replace(/^.*?\b(?:que|de)\b\s*/i,"").trim() || text} };
  if (/\b(o que você lembra|o que voce lembra|minhas memórias|minhas memorias|lembranças|lembrancas)\b/.test(lower)) return { kind:"memory.search", confidence:.9, parameters:{query:""} };
  if (/\b(crie|criar|adicione|adicionar)\s+(uma\s+)?tarefa\b/.test(lower)) return { kind:"task.create", confidence:.9, parameters:{title:text.replace(/^.*?tarefa\s*/i,"").trim() || text} };
  if (/\b(minhas tarefas|listar tarefas|lista de tarefas)\b/.test(lower)) return { kind:"task.list", confidence:.95, parameters:{} };
  if (/\b(pesquise|pesquisar|busque|buscar)\b/.test(lower) && /\b(internet|web|online)\b/.test(lower)) return { kind:"web.search", confidence:.85, parameters:{query:text.replace(/^.*?\b(?:internet|web|online)\b\s*/i,"").trim() || text} };
  if (/\b(abra|abrir|acesse|acessar)\s+(https?:\/\/|www\.)/i.test(text)) return { kind:"web.open", confidence:.95, parameters:{url:text.match(/https?:\/\/\S+|www\.\S+/i)?.[0] ?? ""} };
  if (/\b(procure|buscar|encontre)\b.*\barquivo\b/i.test(text)) return { kind:"file.search", confidence:.9, parameters:{query:text} };
  if (/\b(notifique|notificação|notificacao)\b/.test(lower)) return { kind:"notification.create", confidence:.8, parameters:{content:text} };
  if (/\b(calendário|calendario|agenda|evento)\b/.test(lower)) return { kind:"calendar.create", confidence:.8, parameters:{title:text} };
  return { kind:"chat", confidence:.6, parameters:{} };
}
