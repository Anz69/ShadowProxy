export interface ApiErrorResponse {
    status: "error";
    code: string; // Стабильный код ошибки (например, INVALID_COUNTRY, INSUFFICIENT_BALANCE)
    message: string; // Описание ошибки
}

export interface ApiSuccessResponse<T = any> {
    status: "ok";
    code: "200";
    message: T;
}

