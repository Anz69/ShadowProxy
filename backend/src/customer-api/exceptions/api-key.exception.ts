import { UnauthorizedException } from "@nestjs/common";
import { ApiErrorResponse } from "../types/api-response.types";
import { ApiErrorCode } from "./api-error-codes";

export class ApiKeyNotFoundException extends UnauthorizedException {
    constructor(message: string = "API ключ не найден") {
        const errorResponse: ApiErrorResponse = {
            status: "error",
            code: ApiErrorCode.API_KEY_NOT_FOUND,
            message,
        };
        super(errorResponse);
    }
}

export class InvalidApiKeyException extends UnauthorizedException {
    constructor(message: string = "Недействительный API ключ") {
        const errorResponse: ApiErrorResponse = {
            status: "error",
            code: ApiErrorCode.INVALID_API_KEY,
            message,
        };
        super(errorResponse);
    }
}

