import winston, { createLogger, format, transports, Logger } from "winston";
import "winston-daily-rotate-file";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma, LogType } from "@prisma/client";

@Injectable()
export class LoggerService {
    private logger: Logger;
    private consoleTransport: winston.transports.ConsoleTransportInstance;

    constructor(private readonly prisma: PrismaService) {
        this.consoleTransport = new transports.Console();

        this.logger = createLogger({
            level: "info",
            format: format.combine(
                format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
                format.errors({ stack: true }),
                format.printf(({ level, message, timestamp }) => `[${timestamp}] ${String(level).toUpperCase()}: ${message}`),
            ),
            transports: [
                new transports.DailyRotateFile({
                    dirname: "logs",
                    filename: "%DATE%.log",
                    datePattern: "DD-MM-YYYY",
                    zippedArchive: false,
                    maxFiles: "30d",
                }),
                this.consoleTransport,
            ],
        });
    }

    async log(type: "USAGE" | "REPLENISH" | "SYSTEM", message: string, userId?: string, metadata?: any, silentConsole = false) {
        const fullMessage = `${type} - ${message}`;
        const prevSilent = this.consoleTransport.silent;
        if (silentConsole) this.consoleTransport.silent = true;
        this.logger.info(fullMessage);
        if (silentConsole) this.consoleTransport.silent = prevSilent ?? false;

        await this.prisma.log.create({
            data: { type, message, userId, metadata },
        });
    }

    async error(message: string, userId?: string, metadata?: object, silentConsole = false) {
        const fullMessage = message;
        const prevSilent = this.consoleTransport.silent;
        if (silentConsole) this.consoleTransport.silent = true;
        this.logger.error(fullMessage);
        if (silentConsole) this.consoleTransport.silent = prevSilent ?? false;

        await this.prisma.log.create({
            data: { type: "SYSTEM", message, userId, metadata },
        });
    }

    /**
     * Логирование трафика
     */
    async logTraffic(data: {
        userId: string;
        packageType: string;
        proxyType?: string;
        port: number;
        inBytes: bigint | string | number;
        outBytes: bigint | string | number;
    }) {
        const inBytes = BigInt(data.inBytes);
        const outBytes = BigInt(data.outBytes);
        const totalBytes = inBytes + outBytes;

        await this.prisma.log.create({
            data: {
                type: LogType.TRAFFIC,
                message: `Трафик: ${data.packageType} прокси, порт ${data.port}, входящий: ${inBytes.toString()}, исходящий: ${outBytes.toString()}`,
                userId: data.userId,
                metadata: {
                    packageType: data.packageType,
                    proxyType: data.proxyType,
                    port: data.port,
                    inBytes: inBytes.toString(),
                    outBytes: outBytes.toString(),
                    totalBytes: totalBytes.toString(),
                },
            },
        });
    }

    /**
     * Логирование действий пользователя
     */
    async logUserAction(data: {
        userId: string;
        actionType: "LOGIN" | "LOGOUT" | "PROXY_GENERATE" | "PROXY_DELETE" | "PACKAGE_PURCHASE" | "BALANCE_TOPUP" | "KEY_ACTIVATE" | "SETTINGS_CHANGE" | "ERROR";
        message: string;
        metadata?: any;
    }) {
        await this.prisma.log.create({
            data: {
                type: LogType.USER_ACTION,
                message: data.message,
                userId: data.userId,
                metadata: {
                    actionType: data.actionType,
                    ...data.metadata,
                },
            },
        });
    }

    /**
     * Логирование API запросов
     */
    async logApi(data: {
        endpoint: string;
        httpStatus: number;
        responseTime: number; // в миллисекундах
        ipAddress?: string;
        userId?: string;
        requestBody?: any;
        responseBody?: any;
        errorMessage?: string;
        metadata?: any; // Дополнительные метаданные (например, apiToken)
    }) {
        // Очищаем чувствительные данные из requestBody
        const sanitizedRequestBody = this.sanitizeRequestBody(data.requestBody);
        // Усекаем responseBody для экономии места
        const truncatedResponseBody = data.responseBody ? this.truncateResponse(data.responseBody) : undefined;

        await this.prisma.log.create({
            data: {
                type: LogType.API,
                message: `API ${data.endpoint}: ${data.httpStatus} (${data.responseTime}ms)`,
                userId: data.userId,
                metadata: {
                    endpoint: data.endpoint,
                    httpStatus: data.httpStatus,
                    responseTime: data.responseTime,
                    ipAddress: data.ipAddress,
                    requestBody: sanitizedRequestBody,
                    responseBody: truncatedResponseBody,
                    errorMessage: data.errorMessage,
                    ...data.metadata, // Добавляем дополнительные метаданные
                },
            },
        });
    }

    /**
     * Очистка чувствительных данных из тела запроса
     */
    private sanitizeRequestBody(body: any): any {
        if (!body || typeof body !== "object") return body;

        const sensitiveFields = ["password", "token", "apiKey", "api-key", "authorization", "secret", "key"];
        const sanitized = { ...body };

        for (const field of sensitiveFields) {
            if (sanitized[field]) {
                sanitized[field] = "***REDACTED***";
            }
        }

        return sanitized;
    }

    /**
     * Усечение ответа для экономии места
     */
    private truncateResponse(response: any, maxLength = 1000): any {
        if (!response) return response;

        const responseStr = JSON.stringify(response);
        if (responseStr.length <= maxLength) return response;

        const truncatedStr = responseStr.substring(0, maxLength) + "...";
        let truncatedData: any;
        try {
            truncatedData = JSON.parse(truncatedStr);
        } catch {
            truncatedData = truncatedStr;
        }

        return {
            _truncated: true,
            _originalLength: responseStr.length,
            _data: truncatedData,
        };
    }

    async getLogs(query: Prisma.LogFindManyArgs) {
        return this.prisma.log.findMany(query);
    }

    /**
     * Записать использованный трафик в TrafficLog (источник данных графика расхода).
     * Группировка по (userPackageId, date, hour) с upsert суммирования outBytes.
     * Используется крон-синхронизациями провайдеров (Mango/ProxyEmpire) в прямом режиме (USE_NODE_GATEWAY=false),
     * чтобы графики работали без node-gateway.
     */
    async recordTrafficLogForUserTariff(userId: string, proxyType: "RESIDENT_PREMIUM" | "MOBILE" | "PREMIUM_RESIDENTIAL" | "MOBILE_GB" | "IPV6_GB" | "RESIDENT", outBytes: bigint) {
        if (outBytes <= 0n) return;
        const userPackage = await this.prisma.userPackage.findUnique({
            where: { userId_type: { userId, type: proxyType as any } },
            select: { id: true },
        });
        if (!userPackage) return;

        // Совместимо с proxy-node.controller.ts (локальное время, дата с обнуленными минутами)
        const currentDate = new Date();
        currentDate.setMinutes(0, 0, 0);
        const hour = currentDate.getHours();

        try {
            const existing = await this.prisma.trafficLog.findUnique({
                where: { userPackageId_date_hour: { userPackageId: userPackage.id, date: currentDate, hour } },
            });
            if (existing) {
                await this.prisma.trafficLog.update({
                    where: { id: existing.id },
                    data: { outBytes: existing.outBytes + outBytes },
                });
            } else {
                await this.prisma.trafficLog.create({
                    data: {
                        userPackageId: userPackage.id,
                        date: currentDate,
                        hour,
                        inBytes: 0n,
                        outBytes,
                    },
                });
            }
        } catch (error: any) {
            this.logger.error(`[TRAFFIC] recordTrafficLogForUserTariff(${userId},${proxyType}) ошибка: ${error.message}`);
        }
    }
}
