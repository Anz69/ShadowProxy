import { useQuery } from "@tanstack/react-query"
import type { FC } from "react"
import axios from "axios"

import type { Invoice } from "@/features/payments/types/payment.types"

import Loader from "@/shared/components/ui/Loader/Loader"
import { formatDate } from "@/shared/utils/format-date"
import { sortByCreatedAtDesc } from "@/shared/utils/sort-by-created-at-desc"

/**
 * Транзакции юзера грузятся ЛЕНИВО по клику (GET /payments/user/:userId) —
 * раньше платежи всех юзеров приезжали целиком в списке /users/all и лагали админку.
 */
type TransactionsModalProps = {
	userId: string
}

const PROVIDER_LABEL: Record<string, string> = {
	CRYPTO_BOT: "CryptoBot",
	HELEKET: "Heleket",
	BALANCE: "Баланс",
	REFERRAL_BALANCE: "Реферальный баланс"
}

const isBalanceProvider = (p: string) =>
	p === "BALANCE" || p === "REFERRAL_BALANCE"

const fetchUserPayments = async (userId: string): Promise<Invoice[]> => {
	const res = await axios.get<Invoice[]>(
		`${process.env.NEXT_PUBLIC_BACKEND_URI}/payments/user/${userId}`,
		{ withCredentials: true }
	)
	return res.data
}

const TransactionsModal: FC<TransactionsModalProps> = ({ userId }) => {
	const { data: transactions, isLoading, isError } = useQuery({
		queryKey: ["admin-user-payments", userId],
		queryFn: () => fetchUserPayments(userId)
	})

	return (
		<div className="flex w-full flex-col items-center gap-4">
			<h2 className="font-[TalosDisplay] text-2xl font-semibold text-white">
				История транзакций
			</h2>
			{isLoading ? (
				<div className="flex w-full items-center justify-center py-8">
					<Loader weight={4} size={44} />
				</div>
			) : isError ? (
				<p className="py-6 text-[14px] text-error">Не удалось загрузить транзакции</p>
			) : !transactions?.length ? (
				<p className="py-6 text-[14px] text-white/45">Транзакций нет</p>
			) : (
			<table className="w-full border-collapse text-left">
				<thead>
					<tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-[0.06em] text-white/35">
						<th className="px-3 py-2 font-medium">Сумма</th>
						<th className="px-3 py-2 font-medium">Валюта</th>
						<th className="px-3 py-2 font-medium">Мерчант</th>
						<th className="px-3 py-2 font-medium">Дата</th>
						<th className="px-3 py-2 font-medium">Статус</th>
					</tr>
				</thead>
				<tbody className="text-[13px] text-white/75">
					{[...transactions].sort(sortByCreatedAtDesc).map(el => (
						<tr key={el.id} className="border-b border-white/[0.05] transition-colors hover:bg-white/[0.03]">
							<td className="px-3 py-2">{el.amountUsd}$</td>
							<td className="px-3 py-2">
								{isBalanceProvider(el.provider) ? "—" : el.asset}
							</td>
							<td className="px-3 py-2">
								{PROVIDER_LABEL[el.provider] ?? el.provider}
							</td>
							<td className="px-3 py-2">
								{formatDate(el.createdAt, true)}
							</td>
							<td
								className={`${
									el.status === "WAITING"
										? "text-body/50"
										: el.status === "PAID"
											? "text-success"
											: "text-error"
								} px-3 py-2`}
							>
								{el.status === "WAITING"
									? "В ожидании"
									: el.status === "PAID"
										? "Оплачен"
										: "Отменён"}
							</td>
						</tr>
					))}
				</tbody>
			</table>
			)}
		</div>
	)
}

export default TransactionsModal
