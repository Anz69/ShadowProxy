import type { FC } from "react"

import type { Invoice } from "@/features/payments/types/payment.types"

import { formatDate } from "@/shared/utils/format-date"
import { sortByCreatedAtDesc } from "@/shared/utils/sort-by-created-at-desc"

type TransactionsModalProps = {
	transactions: Invoice[]
}

const PROVIDER_LABEL: Record<string, string> = {
	CRYPTO_BOT: "CryptoBot",
	HELEKET: "Heleket",
	BALANCE: "Баланс",
	REFERRAL_BALANCE: "Реферальный баланс"
}

const isBalanceProvider = (p: string) =>
	p === "BALANCE" || p === "REFERRAL_BALANCE"

const TransactionsModal: FC<TransactionsModalProps> = ({ transactions }) => {
	return (
		<div className="flex w-full flex-col items-center gap-4">
			<h2 className="text-body text-2xl font-semibold">
				История транзакций
			</h2>
			<table className="text-body w-full border-collapse overflow-hidden rounded-xl text-left">
				<thead className="text-body/50 border-body/25 border-b-2 text-base">
					<tr>
						<th className="px-3 py-2 font-normal">Сумма</th>
						<th className="px-3 py-2 font-normal">Валюта</th>
						<th className="px-3 py-2 font-normal">Мерчант</th>
						<th className="px-3 py-2 font-normal">Дата</th>
						<th className="px-3 py-2 font-normal">Статус</th>
					</tr>
				</thead>
				<tbody className="text-body text-base font-normal">
					{transactions.sort(sortByCreatedAtDesc).map(el => (
						<tr key={el.id} className="border-body/25 border-b-2">
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
		</div>
	)
}

export default TransactionsModal
