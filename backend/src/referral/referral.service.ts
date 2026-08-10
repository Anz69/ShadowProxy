import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";
import { LoggerService } from "../logger/logger.service";

@Injectable()
export class ReferralService {
    private readonly REFERRAL_PERCENTAGE = 0.05; // 5%

    constructor(
        private readonly prisma: PrismaService,
        private readonly logger: LoggerService,
    ) {}

    /**
     * Начисляет реферальное вознаграждение рефереру
     * @param referralId ID пользователя, который совершил покупку
     * @param paymentId ID платежа
     * @param amountUsd Сумма платежа в USD
     * @param tx Опциональная транзакция Prisma (если передана, используется она, иначе создается новая)
     */
    async awardReferralReward(
        referralId: string,
        paymentId: string,
        amountUsd: number,
        tx?: Prisma.TransactionClient,
    ): Promise<void> {
        // Получаем пользователя с его реферером
        const referral = await (tx || this.prisma).user.findUnique({
            where: { id: referralId },
            select: { referrerId: true },
        });

        if (!referral || !referral.referrerId) {
            return; // Нет реферера - ничего не делаем
        }

        const referrerId = referral.referrerId; // Сохраняем для использования после проверки
        const rewardAmount = new Prisma.Decimal(amountUsd * this.REFERRAL_PERCENTAGE);

        if (tx) {
            // Используем переданную транзакцию
            await tx.user.update({
                where: { id: referrerId },
                data: {
                    referralBalance: {
                        increment: rewardAmount,
                    },
                },
            });

            await tx.referralReward.create({
                data: {
                    referrerId: referrerId,
                    referralId: referralId,
                    paymentId: paymentId,
                    amount: rewardAmount,
                },
            });
        } else {
            // Создаем новую транзакцию
            await this.prisma.$transaction(async (transactionTx) => {
                await transactionTx.user.update({
                    where: { id: referrerId },
                    data: {
                        referralBalance: {
                            increment: rewardAmount,
                        },
                    },
                });

                await transactionTx.referralReward.create({
                    data: {
                        referrerId: referrerId,
                        referralId: referralId,
                        paymentId: paymentId,
                        amount: rewardAmount,
                    },
                });
            });
        }

        await this.logger.log(
            "SYSTEM",
            `Начислено реферальное вознаграждение ${rewardAmount}$ пользователю ${referrerId} за покупку пользователя ${referralId} на сумму ${amountUsd}$`,
            referrerId,
            {
                referralId,
                paymentId,
                amountUsd,
                rewardAmount: Number(rewardAmount),
            },
        );
    }
}

