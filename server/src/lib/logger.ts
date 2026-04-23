const isDevelopment = process.env.NODE_ENV === 'development';

export const log = {
  info: (...args: any[]) => {
    console.log(...args);
  },
  warn: (...args: any[]) => {
    console.warn(...args);
  },
  error: (...args: any[]) => {
    console.error(...args);
  },
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
};

export default log;
