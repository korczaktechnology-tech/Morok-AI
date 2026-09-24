export const MOROK_VERSION = '0.1.0';

export type HealthStatus = 'ok' | 'error';

export interface ServiceHealth {
  status: HealthStatus;
  service: string;
}
