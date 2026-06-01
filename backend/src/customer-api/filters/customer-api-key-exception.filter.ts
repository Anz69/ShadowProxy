import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from "@nestjs/common";
import { Response } from "express";
import { ApiErrorResponse } from "../types/api-response.types";

@Catch(HttpException)
export class CustomerApiKeyExceptionFilter implements ExceptionFilter {
    catch(exception: HttpException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const status = exception.getStatus();
        const exceptionResponse = exception.getResponse();

        // Если ответ уже в формате ApiErrorResponse, возвращаем его как есть
        if (typeof exceptionResponse === "object" && exceptionResponse !== null && "status" in exceptionResponse && exceptionResponse.status === "error") {
            return response.status(status).json(exceptionResponse as ApiErrorResponse);
        }

        // Иначе форматируем стандартное исключение
        const message = typeof exceptionResponse === "string" 
            ? exceptionResponse 
            : (typeof exceptionResponse === "object" && exceptionResponse !== null && "message" in exceptionResponse
                ? (Array.isArray(exceptionResponse.message) 
                    ? exceptionResponse.message.join(", ")
                    : String(exceptionResponse.message))
                : "Внутренняя ошибка сервера");

        const errorResponse: ApiErrorResponse = {
            status: "error",
            code: String(status),
            message,
        };

        response.status(status).json(errorResponse);
    }
}

