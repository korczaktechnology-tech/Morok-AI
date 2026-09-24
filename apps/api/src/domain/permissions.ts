import type { Permission } from "./types.js";

export const corePermissions: Permission[] = [
  { id: "conversation.read", name: "Ler conversas", description: "Permite consultar conversas" },
  { id: "task.execute", name: "Executar tarefas", description: "Permite executar tarefas" },
  { id: "tool.execute", name: "Executar ferramentas", description: "Permite executar ferramentas" }
];

export function requiresConfirmation(id: string): boolean {
  return id === "task.execute" || id === "tool.execute";
}

export interface PermissionDecision {
  allowed: boolean;
  requiresConfirmation: boolean;
  reason?: string;
}

export function decidePermission(
  roleList: string[],
  permissionId: string,
  confirmed = false
): PermissionDecision {
  const allowedByRole = roleList.includes("admin") || (roleList.includes("user") && permissionId === "conversation.read");
  if (!allowedByRole) return { allowed: false, requiresConfirmation: false, reason: "permission_denied" };
  const confirmationRequired = requiresConfirmation(permissionId);
  if (confirmationRequired && !confirmed) {
    return { allowed: false, requiresConfirmation: true, reason: "confirmation_required" };
  }
  return { allowed: true, requiresConfirmation: confirmationRequired };
}