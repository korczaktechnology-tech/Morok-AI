import { decidePermission } from "./permissions.js";

export interface Actor {
  userId: string;
  roles: string[];
}

export function can(actor: Actor, permission: string, confirmed = false): boolean {
  return decidePermission(actor.roles, permission, confirmed).allowed;
}

export function assertPermission(actor: Actor, permission: string, confirmed = false): void {
  const decision = decidePermission(actor.roles, permission, confirmed);
  if (!decision.allowed) throw new Error(decision.reason ?? "permission_denied");
}