export type Environment = "development" | "test" | "production";

export interface MorokConfig {
  nodeEnv: Environment;
  host: string;
  port: number;
  corsOrigin: string;
  mongodbUri: string;
  mongodbDatabase: string;
  logLevel: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): MorokConfig {
  const nodeEnv = (env.NODE_ENV ?? "development") as Environment;
  const port = Number(env.PORT ?? 10000);
  if (!Number.isInteger(port) || port <= 0) throw new Error("PORT must be a positive integer");
  if (!env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  return {
    nodeEnv, host: env.HOST ?? "0.0.0.0", port,
    corsOrigin: env.CORS_ORIGIN ?? "*",
    mongodbUri: env.MONGODB_URI,
    mongodbDatabase: env.MONGODB_DATABASE ?? "morok",
    logLevel: env.LOG_LEVEL ?? "info"
  };
}