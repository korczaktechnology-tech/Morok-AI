import assert from "node:assert/strict";
import test from "node:test";
import { EventBus } from "./bus.js";
import { ToolRegistry } from "./tools.js";
import { requiresConfirmation } from "./permissions.js";

test("event bus dispatches events", async () => {
  const bus = new EventBus();
  let called = false;
  bus.on("system.alert", async () => { called = true; });
  await bus.emit("system.alert", { ok: true });
  assert.equal(called, true);
});

test("tool registry stores and executes tools", async () => {
  const registry = new ToolRegistry();
  registry.register({ id: "x", name: "X", description: "X", execute: async (input) => ({ input }) });
  assert.equal(registry.list().length, 1);
  assert.deepEqual(await registry.execute("x", "ok"), { input: "ok" });
});

test("critical permissions require confirmation", () => {
  assert.equal(requiresConfirmation("tool.execute"), true);
  assert.equal(requiresConfirmation("conversation.read"), false);
});