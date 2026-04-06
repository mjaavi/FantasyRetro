"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InfrastructureError = exports.ConflictError = exports.NotFoundError = exports.ForbiddenError = exports.UnauthorizedError = exports.ValidationError = exports.AppError = void 0;
class AppError extends Error {
    constructor(message, statusCodeOrOptions, details) {
        var _a, _b;
        super(message);
        this.name = new.target.name;
        const options = typeof statusCodeOrOptions === 'number'
            ? { statusCode: statusCodeOrOptions, details }
            : statusCodeOrOptions;
        this.statusCode = options.statusCode;
        this.code = (_a = options.code) !== null && _a !== void 0 ? _a : 'APP_ERROR';
        this.details = options.details;
        this.cause = options.cause;
        this.isOperational = (_b = options.isOperational) !== null && _b !== void 0 ? _b : true;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message = 'La solicitud contiene datos inválidos.', details) {
        super(message, { statusCode: 400, code: 'VALIDATION_ERROR', details });
    }
}
exports.ValidationError = ValidationError;
class UnauthorizedError extends AppError {
    constructor(message = 'No autenticado.', details) {
        super(message, { statusCode: 401, code: 'UNAUTHORIZED', details });
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends AppError {
    constructor(message = 'No autorizado para realizar esta operación.', details) {
        super(message, { statusCode: 403, code: 'FORBIDDEN', details });
    }
}
exports.ForbiddenError = ForbiddenError;
class NotFoundError extends AppError {
    constructor(message = 'Recurso no encontrado.', details) {
        super(message, { statusCode: 404, code: 'NOT_FOUND', details });
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends AppError {
    constructor(message = 'La operación entra en conflicto con el estado actual.', details) {
        super(message, { statusCode: 409, code: 'CONFLICT', details });
    }
}
exports.ConflictError = ConflictError;
class InfrastructureError extends AppError {
    constructor(message = 'Error de infraestructura.', details) {
        super(message, { statusCode: 500, code: 'INFRASTRUCTURE_ERROR', details });
    }
}
exports.InfrastructureError = InfrastructureError;
