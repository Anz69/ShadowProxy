import { ArgumentsHost, Catch, Logger } from "@nestjs/common";
import { BaseExceptionFilter, HttpAdapterHost } from "@nestjs/core";

function isClientRequestAborted(err: unknown): boolean {
    if (!err || typeof err !== "object") return false;
    const e = err as Record<string, unknown>;
    return e.type === "request.aborted" || e.code === "ECONNABORTED";
}

/**
 * Клиент закрыл сокет или прервал тело запроса, пока express/raw-body ещё читал поток.
 * Это не сбой приложения — без фильтра Nest пишет ERROR в ExceptionsHandler (http-errors BadRequest).
 */
@Catch()
export class ClientRequestAbortedExceptionFilter extends BaseExceptionFilter {
    private readonly log = new Logger(ClientRequestAbortedExceptionFilter.name);

    constructor(adapterHost: HttpAdapterHost) {
        super(adapterHost.httpAdapter);
    }

    catch(exception: unknown, host: ArgumentsHost): void {
        if (isClientRequestAborted(exception)) {
            const req = host.switchToHttp().getRequest<{ method?: string; url?: string }>();
            this.log.debug(`Клиент прервал запрос (тело не дочитано): ${req.method ?? "?"} ${req.url ?? ""}`);
            const response = host.switchToHttp().getResponse();
            const applicationRef = this.applicationRef ?? this.httpAdapterHost?.httpAdapter;
            if (applicationRef && !applicationRef.isHeadersSent(response)) {
                applicationRef.reply(response, null, 499);
            }
            return;
        }
        super.catch(exception, host);
    }
}
