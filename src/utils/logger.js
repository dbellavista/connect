import pino from 'pino';

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              destination: 2, // Write to stderr
            },
          }
        : undefined,
  },
  pino.destination(2) // Fallback stream for production mode
);

