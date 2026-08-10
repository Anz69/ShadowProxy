import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PackageType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type Job = {
    userId: string;
    type: PackageType;
    attempts: number;
    nextRunAt: number; // epoch ms
};

/**
 * SPRINT-1 (ТЗ 1.4 п.3) — фоновая очередь провижининга апстрим-аккаунтов.
 *
 * Зачем: покупка/триал/ключ должны быть мгновенными (баланс + пакет пишем в БД сразу),
 * а создание апстрим-аккаунта (Mango master `proxy.create_account`) — медленное и может
 * падать. Раньше это был `void emitAsync(...).catch(log)` — одна попытка, без ретраев.
 * Теперь — очередь с идемпотентными повторами и экспоненциальным бэкоффом.
 *
 * Идемпотентность: для RESIDENT_PREMIUM «успех» = у пользователя реально появился
 * `premiumUsername`. Повторный enqueue того же (userId,type) дедуплицируется; если аккаунт
 * уже есть — задача завершается без обращения к апстриму.
 *
 * Durability: очередь in-memory (без новой инфры). На случай рестарта/потери задачи
 * страховкой служит ленивое до-создание аккаунта при первой генерации прокси
 * (`PackageService.generatePackageProxy`). Полностью durable-вариант (Redis/BullMQ или
 * таблица в БД) — тривиальный апгрейд поверх этого же интерфейса, если потребуется.
 */
@Injectable()
export class ProvisioningQueueService {
    private readonly logger = new Logger("ProvisioningQueue");
    private readonly queue = new Map<string, Job>();
    private readonly MAX_ATTEMPTS = 6;
    private processing = false;

    constructor(
        private readonly prisma: PrismaService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    private key(userId: string, type: PackageType): string {
        return `${userId}:${type}`;
    }

    /** Поставить провижининг апстрим-аккаунта в очередь (неблокирующе, идемпотентно). */
    enqueue(userId: string, type: PackageType): void {
        const key = this.key(userId, type);
        if (this.queue.has(key)) return; // уже в очереди — дедуп
        this.queue.set(key, { userId, type, attempts: 0, nextRunAt: Date.now() });
        this.logger.log(`enqueue provisioning ${type} for user ${userId}`);
    }

    /** Экспоненциальный бэкофф: 5с, 10с, 20с, 40с, затем потолок 60с. */
    private backoffMs(attempts: number): number {
        return Math.min(60_000, 5_000 * 2 ** (attempts - 1));
    }

    /** RESIDENT_PREMIUM провижинен, если у юзера появился premiumUsername. */
    private async isProvisioned(job: Job): Promise<boolean> {
        if (job.type !== "RESIDENT_PREMIUM") return false; // для прочих типов нет верифицируемого признака
        const u = await this.prisma.user.findUnique({
            where: { id: job.userId },
            select: { premiumUsername: true },
        });
        return !!u?.premiumUsername && u.premiumUsername.length > 0;
    }

    @Interval(20_000)
    async process(): Promise<void> {
        if (this.processing) return; // не наслаивать прогоны
        this.processing = true;
        try {
            const now = Date.now();
            const due = [...this.queue.entries()]
                .filter(([, j]) => j.nextRunAt <= now)
                .slice(0, 10); // батч за один тик

            for (const [key, job] of due) {
                this.queue.delete(key); // «забираем» задачу
                try {
                    // Уже провижинен (например, ленивым путём при генерации) — выходим.
                    if (await this.isProvisioned(job)) {
                        this.logger.log(`provisioning ${job.type} for ${job.userId}: already done`);
                        continue;
                    }

                    await this.eventEmitter.emitAsync("proxy.create_account", {
                        userId: job.userId,
                        type: job.type,
                    });

                    // Для RESIDENT_PREMIUM проверяем результат: createUser глушит ошибки и
                    // возвращает false, поэтому единственный надёжный признак успеха — наличие
                    // premiumUsername. Нет — считаем попытку неудачной и ретраим.
                    if (job.type === "RESIDENT_PREMIUM" && !(await this.isProvisioned(job))) {
                        throw new Error("premiumUsername не появился после proxy.create_account");
                    }

                    this.logger.log(`provisioning ${job.type} for ${job.userId}: ok`);
                } catch (e: unknown) {
                    job.attempts += 1;
                    const msg = e instanceof Error ? e.message : String(e);
                    if (job.attempts >= this.MAX_ATTEMPTS) {
                        this.logger.error(
                            `provisioning ${job.type} for ${job.userId}: FAILED after ${job.attempts} attempts: ${msg} ` +
                                `(будет до-создано лениво при первой генерации прокси)`,
                        );
                    } else {
                        job.nextRunAt = Date.now() + this.backoffMs(job.attempts);
                        this.queue.set(key, job);
                        this.logger.warn(
                            `provisioning ${job.type} for ${job.userId}: retry #${job.attempts} in ${Math.round(
                                this.backoffMs(job.attempts) / 1000,
                            )}s (${msg})`,
                        );
                    }
                }
            }
        } finally {
            this.processing = false;
        }
    }
}
