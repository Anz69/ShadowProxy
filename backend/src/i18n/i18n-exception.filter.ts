import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";
import { I18nService } from "nestjs-i18n";

@Catch(HttpException)
export class I18nHttpExceptionFilter implements ExceptionFilter {
    constructor(private readonly i18n: I18nService) {}

    catch(exception: HttpException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const status = exception.getStatus();

        const errorResponse = exception.getResponse() as { message: string | string[] } | string;

        let message: string | string[];

        if (typeof errorResponse === "string") {
            message = errorResponse;
        } else {
            message = errorResponse.message;
        }

        if (exception.constructor.name === "GoogleRecaptchaException") {
            message = "errors.captcha_error";
        }

        const translated =
            typeof message === "string"
                ? this.i18n.translate(message)
                : message.map((m) => this.i18n.translate(m));

        response.status(status).json({
            statusCode: status,
            message: translated,
            error: exception.constructor.name,
        });
    }
}
