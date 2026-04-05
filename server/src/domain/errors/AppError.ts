export interface AppErrorOptions {
    readonly statusCode: number;
    readonly code?: string;
    readonly details?: unknown;
    readonly cause?: unknown;
    readonly isOperational?: boolean;
}

export class AppError extends Error {
    readonly statusCode: number;
    readonly code: string;
    readonly details?: unknown;
    readonly isOperational: boolean;
    readonly cause?: unknown;

    constructor(message: string, statusCodeOrOptions: number | AppErrorOptions, details?: unknown) {
        super(message);
        this.name = new.target.name;

        const options = typeof statusCodeOrOptions === 'number'
            ? { statusCode: statusCodeOrOptions, details }
            : statusCodeOrOptions;

        this.statusCode = options.statusCode;
        this.code = options.code ?? 'APP_ERROR';
        this.details = options.details;
        this.cause = options.cause;
        this.isOperational = options.isOperational ?? true;

        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export class ValidationError extends AppError {
    constructor(message = 'La solicitud contiene datos inválidos.', details?: unknown) {
        super(message, { statusCode: 400, code: 'VALIDATION_ERROR', details });
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = 'No autenticado.', details?: unknown) {
        super(message, { statusCode: 401, code: 'UNAUTHORIZED', details });
    }
}

export class ForbiddenError extends AppError {
    constructor(message = 'No autorizado para realizar esta operación.', details?: unknown) {
        super(message, { statusCode: 403, code: 'FORBIDDEN', details });
    }
}

export class NotFoundError extends AppError {
    constructor(message = 'Recurso no encontrado.', details?: unknown) {
        super(message, { statusCode: 404, code: 'NOT_FOUND', details });
    }
}

export class ConflictError extends AppError {
    constructor(message = 'La operación entra en conflicto con el estado actual.', details?: unknown) {
        super(message, { statusCode: 409, code: 'CONFLICT', details });
    }
}

export class InfrastructureError extends AppError {
    constructor(message = 'Error de infraestructura.', details?: unknown) {
        super(message, { statusCode: 500, code: 'INFRASTRUCTURE_ERROR', details });
    }
}
