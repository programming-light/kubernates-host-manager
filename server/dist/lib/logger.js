const isDevelopment = process.env.NODE_ENV === 'development';
export const log = {
    info: (...args) => {
        console.log(...args);
    },
    warn: (...args) => {
        console.warn(...args);
    },
    error: (...args) => {
        console.error(...args);
    },
    debug: (...args) => {
        if (isDevelopment) {
            console.debug(...args);
        }
    },
};
export default log;
