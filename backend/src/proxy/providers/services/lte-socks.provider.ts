import { Injectable } from "@nestjs/common";
import { ServerRegion } from "../../types/server-region.type";
import axios, { AxiosInstance } from "axios";
import { ConfigService } from "@nestjs/config";
import { generateRandomString } from "../../../shared/utils/generate-random-string";
import { ProxyType, UserRegion } from "@prisma/client";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../../prisma/prisma.service";
import { LoggerService } from "../../../logger/logger.service";
import { MobileProxyPlan } from "../types/mobile-proxy-plan.type";

@Injectable()
export class LteSocksProvider {
    private readonly ipList: ServerRegion = {
        cis: "143.110.160.236",
        europe: "143.110.160.236",
        usa: "104.131.164.187",
    };
    private readonly lteSocksApi: AxiosInstance;

    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
        private readonly logger: LoggerService,
    ) {
        this.lteSocksApi = axios.create({
            baseURL: configService.getOrThrow<string>("LTE_SOCKS_BASE_URL"),
            headers: {
                Authorization: configService.getOrThrow<string>("LTE_SOCKS_API_KEY"),
            },
        });
    }

    async createProxy(plan: any, userRegion: UserRegion, rentTime: number) {
        try {
            this.logger.log("SYSTEM", `LteSocksProvider.createProxy вызван: plan=${JSON.stringify(plan)}, userRegion=${userRegion}, rentTime=${rentTime}`);
            
            const username = generateRandomString(12);
            const password = generateRandomString(12);
            this.logger.log("SYSTEM", `Сгенерированы credentials: username=${username}`);

            this.logger.log("SYSTEM", `Отправка запроса /ports/order с данными: ${JSON.stringify(plan)}`);
            const portRes = await this.lteSocksApi.post<{ port: string }>("/ports/order", plan);
            this.logger.log("SYSTEM", `Получен ответ от /ports/order: port=${portRes.data.port}`);
            
            const port = portRes.data.port;
            const autoRenew = rentTime > 300;
            this.logger.log("SYSTEM", `Настройка автопродления для порта ${port}: autoRenew=${autoRenew}`);
            await this.editAutoRenew(port, autoRenew);
            
            this.logger.log("SYSTEM", `Настройка credentials для порта ${port}`);
            await this.editCredentials(port, username, password);
            
            this.logger.log("SYSTEM", `Обновление прокси для порта ${port}`);
            await this.refreshProxy(port);

            const host = this.ipList[userRegion.toLowerCase()] as string;
            const result = {
                username,
                password,
                host,
                port: Number(port),
            };
            
            this.logger.log("SYSTEM", `Прокси успешно создан: ${host}:${result.port}`);
            return result;
        } catch (e: unknown) {
            const errorMessage = e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
            const errorResponse = e && typeof e === "object" && "response" in e && e.response 
                ? (typeof e.response === "object" && "data" in e.response ? JSON.stringify(e.response.data) : String(e.response))
                : undefined;
            const errorStatus = e && typeof e === "object" && "response" in e && e.response && typeof e.response === "object" && "status" in e.response
                ? e.response.status
                : undefined;
            
            await this.logger.error(
                `Ошибка при создании мобильного прокси на стороне провайдера: ${errorMessage}${errorStatus ? ` (status: ${errorStatus})` : ""}${errorResponse ? `, response: ${errorResponse}` : ""}`,
                undefined,
                e && typeof e === "object" ? e : undefined
            );
            throw e;
        }
    }

    async editAutoRenew(port: string | number, autoRenew: boolean) {
        return this.lteSocksApi.post(`/ports/${port}/autorenew`, {
            autoRenew,
        });
    }

    async editCredentials(port: string | number, login: string, password: string) {
        return this.lteSocksApi.post(`/ports/${port}/credentials`, {
            ip: [],
            password: [
                {
                    login,
                    password,
                },
            ],
        });
    }

    async refreshProxy(port: string | number) {
        return this.lteSocksApi.post<{ port: string, ip: string }>(`/ports/${port}/reset`);
    }

    async deletePort(port: string | number) {
        return this.lteSocksApi.delete(`/ports/${port}`);
    }

    async parsePlans() {
        try {
            const plansRes = await this.lteSocksApi.get<{ plans: MobileProxyPlan[] }>("/plans");
            return plansRes.data.plans.filter((el) => el.countryCode.length === 2);
        } catch (e: unknown) {
            await this.logger.error(`Ошибка при парсинге доступных локаций на Lte Socks: ${String(e)}`, undefined, e && typeof e === "object" ? e : undefined);
            return [];
        }
    }

    @Cron(CronExpression.EVERY_MINUTE)
    async updateProxies() {
        const mobileProxies = await this.prisma.proxy.findMany({
            where: {
                type: ProxyType.MOBILE,
            },
            include: {
                user: true,
            },
        });

        for (const el of mobileProxies) {
            if (el.rentTime == null) continue;

            const endTime = el.createdAt.getTime() + el.rentTime * 1000;
            const timeLeft = endTime - Date.now();
            if ((timeLeft <= 1000 * 60 * 5 && timeLeft >= 1000 * 60 * 3 && el.rentTime !== 300) || timeLeft <= 0) {
                try {
                    await this.editAutoRenew(el.port, false);
                } catch {
                    // ошибка провайдера — продолжаем обход остальных прокси
                }
                if (timeLeft <= 0) {
                    try {
                        await this.deletePort(el.port);
                        await this.prisma.proxy.delete({ where: { id: el.id } });
                    } catch {
                        // —
                    }
                }
            }
        }
    }
}
