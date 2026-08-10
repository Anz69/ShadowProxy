import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RedeemKeyDto } from "./dtos/redeem-key.dto";
import { KeyStatus } from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CreateKeyDto } from "./dtos/create-key.dto";
import { LoggerService } from "../logger/logger.service";
import { ProvisioningQueueService } from "../provisioning/provisioning-queue.service";
import { DeleteKeysDto } from "./dtos/delete-keys.dto";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class KeyService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly eventEmitter: EventEmitter2,
        private readonly logger: LoggerService,
        private readonly configService: ConfigService,
        private readonly provisioningQueue: ProvisioningQueueService,
    ) {}

    /** SPRINT-1: Mango в gateway-режиме (см. MangoProxyProvider.isGatewayMode). */
    private isMangoGatewayMode(): boolean {
        return this.configService.get<string>("MANGO_MODE", "api") === "gateway";
    }

    async createKey(dto: CreateKeyDto) {
        return this.prisma.$transaction(
            new Array(dto.quantity).fill(null).map(() =>
                this.prisma.key.create({
                    data: {
                        type: dto.tariff,
                        contents: dto.contents,
                    },
                }),
            ),
        );
    }

    async deleteKeys(dto: DeleteKeysDto) {
        await this.prisma.key.deleteMany({
            where: {
                key: {
                    in: dto.keys,
                },
            },
        });
        return {
            success: true,
        };
    }

    async redeemKey(dto: RedeemKeyDto, userId: string) {
        const dtoKey = dto.key.toLowerCase();
        const key = await this.findOneByKey(dtoKey);
        if (!key) {
            throw new NotFoundException("errors.key_not_found");
        }
        if (key.status === KeyStatus.ACTIVATED) {
            throw new BadRequestException("errors.key_already_activated");
        }
        await this.logger.log("SYSTEM", `Пользователь ${userId} успешно активировал ключ ${key.key}`);
        await this.logger.logUserAction({
            userId,
            actionType: "KEY_ACTIVATE",
            message: `Пользователь ${userId} активировал ключ ${key.key} (тип: ${key.type}, трафик: ${key.contents} ГБ)`,
            metadata: {
                keyId: key.id,
                keyType: key.type,
                traffic: key.contents,
            },
        });
        const userBeforeCreate = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { premiumUsername: true },
        });
        const keyTraffic = String(BigInt(Math.round(Number(key.contents) * 1024 ** 3)));
        const keyAccJustCreated = key.type === "RESIDENT_PREMIUM" ? !userBeforeCreate?.premiumUsername?.length : undefined;
        if (this.isMangoGatewayMode()) {
            // SPRINT-1 (Task C): баланс + пакет начисляем синхронно (быстро, без апстрим-API),
            // провижининг апстрим-аккаунта Mango — в фон (создастся лениво при генерации).
            await this.eventEmitter.emitAsync("user.distribute_traffic", {
                tariff: key.type,
                traffic: keyTraffic,
                userId,
                accountJustCreated: keyAccJustCreated,
            });
            // Провижининг апстрим-аккаунта — в очередь с идемпотентными ретраями.
            this.provisioningQueue.enqueue(userId, key.type);
        } else {
            // api-режим: прежний синхронный порядок (create_account → distribute).
            await this.eventEmitter.emitAsync("proxy.create_account", {
                type: key.type,
                userId,
            });
            await this.eventEmitter.emitAsync("user.distribute_traffic", {
                tariff: key.type,
                traffic: keyTraffic,
                userId,
                accountJustCreated: keyAccJustCreated,
            });
        }
        await this.prisma.key.update({
            where: {
                key: dtoKey,
            },
            data: {
                status: KeyStatus.ACTIVATED,
                activatedBy: userId,
            },
        });
        return key;
    }

    async redeemSubKey(dto: RedeemKeyDto) {
        const dtoKey = dto.key.toLowerCase();
        const key = await this.findOneByKey(dtoKey);
        if (!key) {
            throw new NotFoundException("errors.key_not_found");
        }
        if (key.status === KeyStatus.ACTIVATED) {
            throw new BadRequestException("errors.key_already_activated");
        }
        return this.prisma.key.update({
            where: {
                key: dtoKey,
            },
            data: {
                status: KeyStatus.ACTIVATED,
                activatedBy: this.configService.getOrThrow<string>("SUB_USER_ID"),
            },
        });
    }

    async findOneById(id: string) {
        return this.prisma.key.findUnique({
            where: { id },
        });
    }

    async findOneByKey(key: string) {
        return this.prisma.key.findUnique({
            where: { key },
        });
    }

    async findAll() {
        return this.prisma.key.findMany({});
    }
}
