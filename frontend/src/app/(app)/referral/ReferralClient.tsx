"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import toast from "react-hot-toast"
import type { User } from "@/features/user/types/user.types"
import { getLocaleFromPath } from "@/shared/utils/getLocaleFromPath"
import Reveals from "@/shared/anim/Reveals"
import { t } from "@/shared/utils/i18n"

import type { ReferralReward } from "@/shared/server/getReferralRewards"

export default function ReferralClient({
	user,
	referralsCount,
	referralRewards
}: {
	user: User
	referralsCount: number
	referralRewards: ReferralReward[]
}) {
	const pathname = usePathname()
	const currentLocale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, currentLocale)
	const [referralLink, setReferralLink] = useState("")

	useEffect(() => {
		if (typeof window !== 'undefined') {
			setReferralLink(`${window.location.origin}/ref/${user.id}`)
		}
	}, [user.id])

	const copyLink = () => {
		if (referralLink) {
			navigator.clipboard.writeText(referralLink)
			toast.success(T("referral.link.copied"))
		}
	}

	// Форматируем дату
	const formatDate = (dateString: string) => {
		const date = new Date(dateString)
		return date.toLocaleDateString(currentLocale === "ru" ? "ru-RU" : currentLocale === "zh-CN" ? "zh-CN" : "en-US", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		})
	}

	// Преобразуем данные реферальных начислений в формат для отображения
	const earnings = referralRewards.map((reward) => ({
		id: reward.id,
		source: reward.referralName,
		purchase: reward.tariffType,
		amount: reward.amount,
		date: formatDate(reward.createdAt),
	}))

	const card =
		"rounded-[20px] border border-white/[0.08] light:border-[#e6e8ef] bg-[linear-gradient(180deg,#0e1830,#0a1020)] light:bg-none light:bg-white shadow-[0_30px_70px_-44px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)] light:shadow-[0_24px_60px_-44px_rgba(14,16,25,0.16)]"

	return (
		<main className="relative min-h-screen bg-[#060d1e] light:bg-[#eceff5] font-[TalosInter] text-white light:text-[#0e1019]">
			{/* Soft top glow */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 top-0 -z-[1] h-[700px] bg-[radial-gradient(50%_60%_at_50%_-8%,rgba(79,141,255,0.18),transparent_70%)]"
			/>

			<div className="relative z-[1] mx-auto max-w-[1100px] px-5 sm:px-6 py-[clamp(40px,6vw,90px)]">
				{/* Header */}
				<div className="mb-[clamp(28px,4vw,48px)] flex flex-col items-start gap-4">
					<span className="inline-flex w-max items-center gap-2 rounded-full border border-white/10 light:border-[#e2e4ea] bg-white/[0.06] light:bg-[#f4f6fa] px-4 py-1.5 text-[13px] font-semibold text-white/70 light:text-[#475467] backdrop-blur-md">
						<span className="h-2 w-2 rounded-full bg-gradient-to-br from-[#6aa5ff] to-[#34d3ee]" />
						{T("referral.title")}
					</span>
					<h1 className="font-[TalosDisplay] text-[clamp(30px,4vw,48px)] font-semibold leading-[1.06] tracking-[-0.03em] text-white light:text-[#0e1019]">
						{T("referral.link.title")}
					</h1>
				</div>

				{/* Stat tiles */}
				<div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
					{/* Блок 1: Сумма доходов */}
					<div className={`${card} p-6`}>
						<div className="flex items-baseline gap-2">
							<span className="font-[TalosDisplay] text-[clamp(28px,3.4vw,40px)] font-bold leading-none text-white light:text-[#0e1019]">{parseFloat(Number(user.referralBalance || 0).toFixed(2))}</span>
							<span className="font-[TalosDisplay] text-[clamp(16px,1.6vw,20px)] font-semibold bg-gradient-to-r from-[#6aa5ff] to-[#34d3ee] bg-clip-text text-transparent">{T("referral.earnings.currency")}</span>
						</div>
						<div className="mt-3 flex flex-col text-[13px] leading-[1.4] text-white/45 light:text-[#8a93a3]">
							<span>{T("referral.earnings.label")}</span>
							<span>{T("referral.earnings.sublabel")}</span>
						</div>
					</div>

					{/* Блок 2: Число рефералов */}
					<div className={`${card} p-6`}>
						<span className="font-[TalosDisplay] text-[clamp(28px,3.4vw,40px)] font-bold leading-none text-white light:text-[#0e1019]">{referralsCount}</span>
						<div className="mt-3 flex flex-col text-[13px] leading-[1.4] text-white/45 light:text-[#8a93a3]">
							<span>{T("referral.count.label")}</span>
							<span>{T("referral.count.sublabel")}</span>
						</div>
					</div>

					{/* Блок 3: Реферальная ссылка */}
					<div className={`${card} flex flex-col justify-between gap-4 p-6 sm:col-span-2 lg:col-span-1`}>
						<h2 className="font-[TalosDisplay] text-[18px] font-semibold leading-[1.25] tracking-[-0.02em] text-white light:text-[#0e1019]">{T("referral.link.title")}</h2>
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
							<div className="flex h-[52px] min-w-0 flex-1 items-center overflow-hidden rounded-[14px] border border-white/10 light:border-[#e2e4ea] bg-white/[0.04] light:bg-[#f4f6fa] px-4 text-white light:text-[#0e1019]">
								<span className="truncate text-[14px] text-white/60 light:text-[#5b6472]">{referralLink}</span>
							</div>
							<button
								type="button"
								className="inline-flex h-[52px] shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#4f8dff] to-[#2f6bff] px-6 font-[TalosRethink] text-[15px] font-semibold text-white shadow-[0_14px_40px_-12px_rgba(59,130,246,0.8)] transition-transform duration-200 hover:-translate-y-0.5"
								onClick={copyLink}
							>
								<span>{T("referral.link.copy")}</span>
							</button>
						</div>
					</div>
				</div>

				{/* Таблица доходов */}
				<div className="mt-[clamp(32px,4vw,56px)]">
					<div className={`${card} overflow-hidden p-6 sm:p-8`}>
						<h2 className="mb-6 font-[TalosDisplay] text-[clamp(20px,2.4vw,28px)] font-semibold tracking-[-0.02em] text-white light:text-[#0e1019]">{T("referral.table.title")}</h2>

						{/* Desktop table */}
						<div className="hidden overflow-x-auto md:block">
							<table className="w-full border-collapse text-left">
								<thead>
									<tr className="border-b border-white/[0.08] light:border-[#e2e4ea]">
										<th className="pb-4 pr-4 text-[13px] font-semibold uppercase tracking-[0.04em] text-white/45 light:text-[#8a93a3]">{T("referral.table.source")}</th>
										<th className="pb-4 pr-4 text-[13px] font-semibold uppercase tracking-[0.04em] text-white/45 light:text-[#8a93a3]">{T("referral.table.purchase")}</th>
										<th className="pb-4 pr-4 text-[13px] font-semibold uppercase tracking-[0.04em] text-white/45 light:text-[#8a93a3]">{T("referral.table.amount")}</th>
										<th className="pb-4 text-[13px] font-semibold uppercase tracking-[0.04em] text-white/45 light:text-[#8a93a3]">{T("referral.table.date")}</th>
									</tr>
								</thead>
								<tbody>
									{earnings.length > 0 ? (
										earnings.map((item) => (
											<tr key={item.id} className="border-b border-white/[0.05] light:border-[#e2e4ea] last:border-0">
												<td className="py-4 pr-4 text-[15px] text-white/80 light:text-[#475467]">{item.source}</td>
												<td className="py-4 pr-4 text-[15px] text-white/60 light:text-[#5b6472]">{item.purchase}</td>
												<td className="py-4 pr-4">
													<span className="font-semibold text-[#34d3ee]">+ {item.amount} {T("referral.earnings.currency")}</span>
												</td>
												<td className="py-4 text-[14px] text-white/45 light:text-[#8a93a3]">{item.date}</td>
											</tr>
										))
									) : (
										<tr>
											<td colSpan={4} className="py-10 text-center text-[15px] text-white/45 light:text-[#8a93a3]">
												{T("referral.table.empty")}
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>

						{/* Mobile cards */}
						<div className="flex flex-col gap-3 md:hidden">
							{earnings.length > 0 ? (
								earnings.map((item) => (
									<div key={item.id} className="rounded-[14px] border border-white/[0.08] light:border-[#e2e4ea] bg-white/[0.03] light:bg-[#f4f6fa] p-4">
										<div className="flex items-center justify-between border-b border-white/[0.06] light:border-[#e2e4ea] py-2">
											<div className="text-[12px] uppercase tracking-[0.04em] text-white/45 light:text-[#8a93a3]">{T("referral.table.source")}</div>
											<div className="text-[14px] text-white/80 light:text-[#475467]">{item.source}</div>
										</div>
										<div className="flex items-center justify-between border-b border-white/[0.06] light:border-[#e2e4ea] py-2">
											<div className="text-[12px] uppercase tracking-[0.04em] text-white/45 light:text-[#8a93a3]">{T("referral.table.purchase")}</div>
											<div className="text-[14px] text-white/60 light:text-[#5b6472]">{item.purchase}</div>
										</div>
										<div className="flex items-center justify-between border-b border-white/[0.06] light:border-[#e2e4ea] py-2">
											<div className="text-[12px] uppercase tracking-[0.04em] text-white/45 light:text-[#8a93a3]">{T("referral.table.amount")}</div>
											<div className="text-[14px] font-semibold text-[#34d3ee]">+ {item.amount} {T("referral.earnings.currency")}</div>
										</div>
										<div className="flex items-center justify-between py-2">
											<div className="text-[12px] uppercase tracking-[0.04em] text-white/45 light:text-[#8a93a3]">{T("referral.table.date")}</div>
											<div className="text-[14px] text-white/45 light:text-[#8a93a3]">{item.date}</div>
										</div>
									</div>
								))
							) : (
								<div className="rounded-[14px] border border-white/[0.08] light:border-[#e2e4ea] bg-white/[0.03] light:bg-[#f4f6fa] p-6 text-center text-[15px] text-white/45 light:text-[#8a93a3]">
									<span>{T("referral.table.empty")}</span>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</main>
	)
}
