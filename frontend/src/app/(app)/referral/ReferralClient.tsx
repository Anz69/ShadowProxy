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

	return (
		<main className="referral-page">
			<div className="referral-page__container">
				{/* Первый ряд: три блока */}
				<div className="referral-page__top-row">
					{/* Блок 1: Сумма доходов */}
					<div className="referral-block referral-block--1">
						<div className="referral-block__background referral-block__background--1">
							<img src="/left-section-background.jpg" alt="" className="referral-block__bg-image" />
						</div>
						<div className="referral-block__content">
							<div className="referral-block__earnings">
								<span className="referral-earnings-amount">{parseFloat(Number(user.referralBalance || 0).toFixed(2))}</span>
								<span className="referral-earnings-currency">{T("referral.earnings.currency")}</span>
							</div>
							<div className="referral-block__earnings-label">
								<span>{T("referral.earnings.label")}</span>
								<span>{T("referral.earnings.sublabel")}</span>
							</div>
						</div>
					</div>

					{/* Блок 2: Число рефералов */}
					<div className="referral-block referral-block--2">
						<img className="referral-block__bg-image referral-block__bg-image--2" src="/referral/referral-block2.png" alt="" />
						<div className="referral-block__content">
							<span className="referral-referrals-count">{referralsCount}</span>
							<div className="referral-referrals-label">
								<span>{T("referral.count.label")}</span>
								<span>{T("referral.count.sublabel")}</span>
							</div>
						</div>
					</div>

					{/* Блок 3: Реферальная ссылка */}
					<div className="referral-block referral-block--3">
						<img className="referral-block__bg-image referral-block__bg-image--3" src="/referral/referral-block3.png" alt="" />
						<div className="referral-block__content">
							<h2 className="referral-link-title">{T("referral.link.title")}</h2>
							<button
								type="button"
								className="referral-link-copy-btn"
								onClick={copyLink}
							>
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
									<g clipPath="url(#clip0_58_5563)">
										<rect x="4" y="5" width="14" height="15" fill="white"/>
										<path d="M8.75006 19.5C6.40706 19.5 4.5 17.5929 4.5 15.2499V5.00006H2.75006C1.23305 5.00006 0 6.23287 0 7.74994V21.2499C0 22.767 1.23305 24 2.75006 24H15.2499C16.767 24 18 22.767 18 21.2499V19.5H8.75006Z" fill="#0067FF"/>
										<path d="M21.9999 2.75006C21.9999 1.23103 20.7689 0 19.2501 0H8.75006C7.23103 0 6 1.23103 6 2.75006V15.2499C6 16.769 7.23103 18 8.75006 18H19.2501C20.7689 18 21.9999 16.769 21.9999 15.2499V2.75006Z" fill="#0067FF"/>
									</g>
									<defs>
										<clipPath id="clip0_58_5563">
											<rect width="24" height="24" fill="white"/>
										</clipPath>
									</defs>
								</svg>
								<span>{T("referral.link.copy")}</span>
							</button>
						</div>
					</div>
				</div>

				{/* Таблица доходов */}
				<div className="referral-page__earnings">
					<div className="referral-earnings-table">
						<h2 className="referral-earnings-table__title">{T("referral.table.title")}</h2>
						<div className="referral-earnings-table__wrapper">
							<table className="referral-table referral-table--desktop">
								<thead>
									<tr>
										<th>{T("referral.table.source")}</th>
										<th>{T("referral.table.purchase")}</th>
										<th>{T("referral.table.amount")}</th>
										<th>{T("referral.table.date")}</th>
									</tr>
								</thead>
								<tbody>
									{earnings.length > 0 ? (
										earnings.map((item) => (
											<tr key={item.id}>
												<td>{item.source}</td>
												<td>{item.purchase}</td>
												<td>
													<span className="referral-table__amount">+ {item.amount} {T("referral.earnings.currency")}</span>
												</td>
												<td className="referral-table__date">{item.date}</td>
											</tr>
										))
									) : (
										<tr>
											<td colSpan={4} className="referral-table__empty">
												{T("referral.table.empty")}
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>

						{/* Мобильная версия доходов - карточки */}
						<div className="referral-earnings-mobile">
							{earnings.length > 0 ? (
								earnings.map((item) => (
									<div key={item.id} className="referral-earnings-card">
										<div className="referral-earnings-card__field">
											<div className="referral-earnings-card__label">{T("referral.table.source")}</div>
											<div className="referral-earnings-card__value">{item.source}</div>
										</div>
										<div className="referral-earnings-card__field">
											<div className="referral-earnings-card__label">{T("referral.table.purchase")}</div>
											<div className="referral-earnings-card__value">{item.purchase}</div>
										</div>
										<div className="referral-earnings-card__field">
											<div className="referral-earnings-card__label">{T("referral.table.amount")}</div>
											<div className="referral-earnings-card__value referral-earnings-card__amount">+ {item.amount} {T("referral.earnings.currency")}</div>
										</div>
										<div className="referral-earnings-card__field">
											<div className="referral-earnings-card__label">{T("referral.table.date")}</div>
											<div className="referral-earnings-card__value referral-earnings-card__date">{item.date}</div>
										</div>
									</div>
								))
							) : (
								<div className="referral-earnings-card referral-earnings-card--empty">
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

