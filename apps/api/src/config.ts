export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  host: process.env.HOST ?? '0.0.0.0',
  port: Number(process.env.PORT ?? 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  mongodbUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017',
  mongodbDatabase: process.env.MONGODB_DATABASE ?? 'morok',
};
