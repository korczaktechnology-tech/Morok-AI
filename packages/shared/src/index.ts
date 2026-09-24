export const MOROK_VERSION = '0.1.0';

export type HealthStatus = 'ok' | 'error';

export interface ServiceHealth {
  status: HealthStatus;
  service: string;
}

export interface UserReference {
  userId: string;
}

export interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationReference extends UserReference {
  conversationId: string;
}

export interface ToolExecution extends ConversationReference {
  tool: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
}

export interface AutomationReference extends UserReference {
  automationId: string;
  enabled: boolean;
}
