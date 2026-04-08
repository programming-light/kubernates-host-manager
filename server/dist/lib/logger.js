const isDevelopment = process.env.NODE_ENV === 'development';
export const log = {
    info: (...args) => {
        if (isDevelopment) {
            console.log(...args);
        }
    },
    warn: (...args) => {
        if (isDevelopment) {
            console.warn(...args);
        }
    },
    error: (...args) => {
        if (isDevelopment) {
            console.error(...args);
        }
    },
    debug: (...args) => {
        if (isDevelopment) {
            console.debug(...args);
        }
    },
};
export default log;
