import { Injectable } from "@nestjs/common";
import { MailerService } from "@nestjs-modules/mailer";
import { LoggerService } from "../logger/logger.service";

@Injectable()
export class MailingService {
    constructor(
        private readonly mailerService: MailerService,
        private readonly logger: LoggerService,
    ) {}

    async sendMail(email: string, subject: string, html: string) {
        try {
            const mail = await this.mailerService.sendMail({
                to: email,
                subject,
                html,
            });
            const responseStr = Array.isArray(mail.response) ? mail.response.join(" | ") : String(mail.response ?? "");
            if (responseStr.toLowerCase().includes("ok") || responseStr.toLowerCase().includes("250")) {
                return { success: true, mail };
            }
            this.logError(`Ошибка SMTP при отправке письма. Ответ сервера: ${responseStr}`);
            return { success: false, error: responseStr };
        } catch (e) {
            const err = e instanceof Error ? e : new Error(String(e));
            this.logError("Ошибка при отправке письма (SMTP недоступен или таймаут)", err.message);
            return { success: false, error: err.message };
        }
    }

    private logError(message: string, details?: string) {
        try {
            void this.logger.error(message, undefined, details ? { details } : undefined);
        } catch {
            console.error(`[MailingService] ${message}`, details ?? "");
        }
    }
}
