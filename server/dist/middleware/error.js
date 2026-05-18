import log from '../lib/logger.js';
export function errorHandler(error, request, reply) {
    log.error('Error:', error);
    if (error.validation) {
        return reply.status(400).send({
            error: 'Validation Error',
            message: error.message,
            details: error.validation,
        });
    }
    if (error.statusCode) {
        return reply.status(error.statusCode).send({
            error: error.name || 'Error',
            message: error.message,
        });
    }
    reply.status(500).send({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
}
export function notFoundHandler(request, reply) {
    reply.status(404).send({
        error: 'Not Found',
        message: `Route ${request.method} ${request.url} not found`,
    });
}
