import type { Tool } from "./types.js";

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.id, tool);
  }

  get(id: string): Tool | undefined {
    return this.tools.get(id);
  }

  list(): Tool[] {
    return [...this.tools.values()];
  }

  async execute(id: string, input: unknown): Promise<unknown> {
    const tool = this.get(id);
    if (!tool) throw new Error("tool_not_found");
    if (!tool.execute) throw new Error("tool_not_executable");
    return tool.execute(input);
  }
}