import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SettingsService {
    constructor(private readonly prisma: PrismaService) {}

    async setKey(key: string, value: object) {
        return this.prisma.setting.upsert({
            where: {
                key,
            },
            update: {
                value,
            },
            create: {
                key,
                value,
            },
        });
    }

    async getValue<T>(key: string) {
        const setting = await this.prisma.setting.findUnique({
            where: {
                key,
            },
        });
        return (setting?.value as T) ?? null;
    }

    /**
     * Размеры скидок в процентах. Хранится в settings.discounts, редактируется в админке.
     * Дефолт {trial:30, review:30} создаётся лениво при первом обращении.
     */
    async getDiscounts(): Promise<{ trial: number; review: number }> {
        const stored = await this.getValue<{ trial?: number; review?: number }>("discounts");
        if (stored && typeof stored.trial === "number" && typeof stored.review === "number") {
            return { trial: stored.trial, review: stored.review };
        }
        const defaults = { trial: 30, review: 30 };
        await this.setKey("discounts", defaults);
        return defaults;
    }

    async getAll() {
        return this.prisma.setting.findMany();
    }
}
