import pino from 'pino';

const getLogLevel = () => {
  if (process.env.QUIET === 'true') {
    return 'warn';
  }
  return process.env.LOG_LEVEL || 'info';
};

export const logger = pino(
  {
    level: getLogLevel(),
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

