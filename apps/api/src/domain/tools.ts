import type {Tool} from "./types.js";
export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();
  register(tool: Tool) { this.tools.set(tool.id, tool); }
  get(id: string) { return this.tools.get(id); }
  list() { return [...this.tools.values()]; }
}