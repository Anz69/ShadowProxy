"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import toast from "react-hot-toast"
import { useLogout } from "@/features/auth/hooks/useLogout"
import type { User } from "@/features/user/types/user.types"
import type { Prices, Plan } from "@/features/proxy/types/proxy.types"
import { getLocaleFromPath, addLocaleToPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"
import { useMyPackages } from "@/features/packages/hooks/useMyPackages"
import UserPackageCard from "./components/UserPackageCard"
import TrafficStats from "./components/TrafficStats"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"
import TrialModal from "@/features/trial/components/TrialModal"
import ReviewModal from "@/features/reviews/components/ReviewModal"
import LinkedAccounts from "@/features/user/components/LinkedAccounts"
import { useMyReview } from "@/features/reviews/hooks/useReview"
import { useActiveDiscount } from "@/features/payments/hooks/useActiveDiscount"
import Reveals from "@/shared/anim/Reveals"
import CountUp from "@/shared/anim/CountUp"

export default function DashboardClient({ user, prices, plans }: { user: User | null; prices: Prices | null; plans: Plan[] }) {
	const { logout, isLoading: isLoggingOut } = useLogout()
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const { open } = useModalStore()
	
	// Get current locale from pathname
	const currentLocale = getLocaleFromPath(pathname)
	
	// Helper function to create localized links
	const getLocalizedLink = (path: string) => {
		return addLocaleToPath(path, currentLocale)
	}
	
	// Translation function with current locale
	const T = (key: string) => t(key, currentLocale)
	
	// Проверяем, был ли уже получен триал
	const hasTrial = user?.trial !== null && user?.trial !== undefined

	// Отзыв пользователя + статус скидок
	const { data: myReview } = useMyReview()
	const hasReview = !!myReview?.hasReview
	const reviewEligible = !!myReview?.eligible
	const reviewDiscountGranted = !!myReview?.reviewDiscountGranted

	// Тост по результату привязки аккаунта (Часть 2 ТЗ).
	// Бэкенд после OAuth-callback редиректит сюда с ?link=ok | canceled | <reason>.
	useEffect(() => {
		const link = searchParams.get("link")
		if (!link) return
		if (link === "ok") {
			toast.success(T("profile.linkedAccounts.linkSuccess"))
		} else if (link === "canceled") {
			toast(T("profile.linkedAccounts.linkCanceled"))
		} else if (link.includes("account_already_linked") || link.includes("already_linked")) {
			toast.error(T("profile.linkedAccounts.errorAlreadyLinked"))
		} else {
			toast.error(T("profile.linkedAccounts.errorGeneric"))
		}
		// Чистим URL, чтобы тост не показывался повторно при reload.
		const url = new URL(window.location.href)
		url.searchParams.delete("link")
		router.replace(url.pathname + url.search + url.hash)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchParams])
	// Единый источник истины по скидке — бэк считает по lifecycle (trial/review),
	// возвращает null если скидка неприменима/сгорела. Не используем сырые user-флаги.
	const { data: activeDiscount } = useActiveDiscount(true)
	const discountPct = activeDiscount?.pct ?? 0
	const hasDiscount = discountPct > 0

	// Получаем активные пакеты пользователя
	const { userPackages, isLoading: isLoadingPackages } = useMyPackages()

	// Сортируем пакеты по дате создания (новые сначала).
	// Legacy MOBILE (LTE Socks, time-based с planId+rentTime) скрываем — они не показывались никогда по ТЗ,
	// видимы только новые GB-based MOBILE.
	const sortedPackages = Array.isArray(userPackages)
		? [...userPackages]
				.filter(p => {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const pkg = p as any
					if (pkg.type === "MOBILE" && pkg.planId && pkg.rentTime) return false
					return true
				})
				.sort((a, b) => {
					const dateA = new Date(a.createdAt).getTime()
					const dateB = new Date(b.createdAt).getTime()
					return dateB - dateA
				})
		: []

	const [currentIndex, setCurrentIndex] = useState(0)
	const [slideDir, setSlideDir] = useState<"next" | "prev" | "initial">("initial")
	const itemsPerPage = 2
	const maxIndex = Math.max(0, sortedPackages.length - itemsPerPage)

	const nextSlide = () => {
		setSlideDir("next")
		setCurrentIndex((prev) => Math.min(prev + 1, maxIndex))
	}

	const prevSlide = () => {
		setSlideDir("prev")
		setCurrentIndex((prev) => Math.max(prev - 1, 0))
	}

	const [isMobile, setIsMobile] = useState(false)

	useEffect(() => {
		const checkMobile = () => {
			setIsMobile(window.innerWidth <= 992)
		}
		
		checkMobile()
		window.addEventListener('resize', checkMobile)
		
		return () => window.removeEventListener('resize', checkMobile)
	}, [])

	// Рендеринг пакетов
	const renderPackages = () => {
		if (isLoadingPackages) {
			return <div>{T("common.loading")}</div>
		}

		if (!sortedPackages || sortedPackages.length === 0) {
			return <div className="dashboard-empty-packages">{T("dashboard.packagesList.empty") || "У вас нет активных пакетов"}</div>
		}

		// На мобиле показываем все элементы для нативного скролла
		// На десктопе показываем только видимые через currentIndex
		const visiblePackages = isMobile 
			? sortedPackages 
			: sortedPackages.slice(currentIndex, currentIndex + itemsPerPage)

		return (
			<div
				className={`proxy-packages${isMobile ? "" : ` proxy-packages-anim proxy-packages-anim--${slideDir}`}`}
				key={isMobile ? "mobile" : `page-${currentIndex}`}
			>
				{visiblePackages.map(userPackage => (
					<UserPackageCard key={userPackage.id} userPackage={userPackage} user={user} prices={prices} plans={plans} />
				))}
			</div>
		)
	}

	return (
		<main className="dashboard" data-dashboard>
			<Reveals
				config={[
					{ selector: ".left__row", variant: "rise", stagger: 0.12, amount: 0.04, duration: 0.9 },
					{ selector: ".dashboard__right", variant: "blur", amount: 0.04, duration: 0.95 },
					{ selector: ".dashboard-linked-accounts", variant: "up", amount: 0.06 }
				]}
			/>
			<div className="dashboard__container" data-dashboard-content style={{ flexDirection: "column", gap: "24px" }}>
				{/* Скидка 30% активна (после триала / за отзыв) */}
				{hasDiscount && (
					<div className="glass-card glass-card--premium flex items-center justify-between gap-4 rounded-2xl px-5 py-4">
						<div>
							<p className="text-body font-semibold">
								{T("dashboard.discountBanner.title").replace("30", String(discountPct))}
							</p>
							<p className="text-body/60 text-sm">{T("dashboard.discountBanner.subtitle")}</p>
						</div>
						<button
							className="rounded-xl bg-[#0067FF] px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-105"
							onClick={() => router.push(getLocalizedLink("/payment"))}
						>
							{T("dashboard.discountBanner.cta")}
						</button>
					</div>
				)}

				{/* Просьба оставить отзыв (после первой покупки, до отправки отзыва).
				    Никогда не показываем одновременно с баннером активной скидки. */}
				{!hasDiscount && !hasReview && reviewEligible && !reviewDiscountGranted && (
					<div className="glass-card flex items-center justify-between gap-4 rounded-2xl px-5 py-4">
						<div>
							<p className="text-body font-semibold">{T("dashboard.reviewBanner.title")}</p>
							<p className="text-body/60 text-sm">{T("dashboard.reviewBanner.subtitle")}</p>
						</div>
						<button
							className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition-transform hover:scale-105"
							onClick={() => open(<ReviewModal />)}
						>
							{T("dashboard.reviewBanner.cta")}
						</button>
					</div>
				)}

				{/* Первый ряд: левый блок и карусель */}
				<div className="dashboard__row">
					{/* Левый узкий блок (3 ряда) */}
					<aside className="dashboard__left" data-dashboard-left>
					{/* Row 1 — balance */}
					<div className="left__row left__row--balance" role="region" aria-label="balance">
						<img className="balance__mask" src="/profile-left-r1-shadow.png" alt="" />
						<div className="balance__content">
							<div className="balance__amount-wrap">
								<div className="balance__amount">
									<CountUp value={user ? Number(user.balance || 0) : 0} decimals={2} />
									<span className="balance__currency">USD</span>
								</div>
								<div className="balance__label-row">
									<div className="balance__label">{T("dashboard.balance.label")}</div>
								</div>
								<div className="balance__traffic-wrap">
									<TrafficStats user={user} />
									{!hasTrial && (
										<button 
											className="btn btn-primary balance__trial-btn" 
											type="button"
											onClick={() => open(<TrialModal user={user} />)}
										>
											{T("dashboard.trialButton")}
										</button>
									)}
								</div>
								<div className="balance__cta">
									<button 
										className="btn btn-primary balance__btn" 
										type="button"
										onClick={() => router.push(getLocalizedLink('/balance'))}
									>
										{T("dashboard.balance.replenish")}
									</button>
									<button 
										className="btn btn-primary balance__btn balance__btn--buy" 
										type="button"
										onClick={() => router.push(getLocalizedLink('/payment'))}
									>
										{T("dashboard.balance.buyProxy")}
									</button>
									{!hasTrial && (
										<button 
											className="btn btn-primary balance__trial-btn-mobile" 
											type="button"
											onClick={() => open(<TrialModal user={user} />)}
										>
											{T("dashboard.trialButton")}
										</button>
									)}
								</div>
							</div>
						</div>
					</div>

					{/* Row 2 — user info */}
					<div className="left__row left__row--user" role="region" aria-label="user">
						<img className="user__mask" src="/profile-left-r2-shadow.png" alt="" />
						<div className="user__title">{T("dashboard.user.title")}</div>
						<div className="user__info">
							<div className="user__meta">
								<div className="user__meta-line">
									<span className="user__meta-label">{T("dashboard.user.id")}</span>
									<span className="user__meta-value">{user?.id || '—'}</span>
								</div>
								<div className="user__meta-line">
									<span className="user__meta-label">{T("dashboard.user.telegramLogin")}</span>
									<span className="user__meta-value">{user?.tgLogin ? `@${user.tgLogin}` : '—'}</span>
								</div>
							</div>
						</div>
					</div>

					{/* Row 3 — actions */}
					<div className="left__row left__row--actions">
						<img className="actions__mask" src="/profile-left-r3-shadow.png" alt="" />
						<div className="actions__title">{T("dashboard.actions.title")}</div>
						<div className="actions__buttons">
							<button 
								className="action-btn" 
								type="button" 
								aria-label={T("header.nav.api")}
								onClick={() => router.push(getLocalizedLink('/u-api'))}
							>
								{/* SVG 1 */}
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
									<circle cx="12" cy="12" r="10.875" fill="#0067FF"/>
									<rect x="6" y="11.25" width="12.375" height="1.875" rx="0.9375" fill="white"/>
									<rect x="11.25" y="18.375" width="12.375" height="1.875" rx="0.9375" transform="rotate(-90 11.25 18.375)" fill="white"/>
								</svg>
								<span>{T("header.nav.api")}</span>
							</button>
							<button 
							className="action-btn action-btn--referral" 
							type="button" 
							aria-label={T("header.nav.referral")}
							onClick={() => router.push(getLocalizedLink('/referral'))}
						>
								{/* SVG 2 */}
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
									<path d="M4.5 9H6L10.5 10L11.5 11V13L4 13.5L3.5 11L4.5 9Z" fill="white"/>
									<path d="M15.5002 12H20.0002L21.8 13.5L22.5002 16L15.0002 16.5L14.7002 14L15.5002 12Z" fill="white"/>
									<path d="M13.75 15V16C13.7453 16.9931 13.3487 17.9442 12.6464 18.6464C11.9442 19.3487 10.9931 19.7453 10 19.75H5C4.00552 19.7497 3.05185 19.3546 2.34864 18.6514C1.64544 17.9482 1.25027 16.9945 1.25 16V15C1.25019 14.1834 1.46106 13.3807 1.86222 12.6695C2.26339 11.9583 2.84127 11.3626 3.54 10.94C4.03162 11.5081 4.63971 11.9637 5.32299 12.276C6.00626 12.5883 6.74873 12.75 7.5 12.75C8.25127 12.75 8.99374 12.5883 9.67701 12.276C10.3603 11.9637 10.9684 11.5081 11.46 10.94C12.3565 11.4817 13.049 12.3043 13.43 13.28C13.6445 13.8279 13.7531 14.4116 13.75 15ZM22.75 16V17C22.7503 17.3612 22.6793 17.7189 22.5412 18.0527C22.4031 18.3865 22.2005 18.6897 21.9451 18.9451C21.6897 19.2005 21.3865 19.4031 21.0527 19.5412C20.7189 19.6793 20.3612 19.7503 20 19.75H15C14.4419 19.7518 13.8969 19.5806 13.44 19.26L13.46 19.24C14.2891 18.3651 14.7508 17.2054 14.75 16V15C14.7546 14.5858 14.7076 14.1726 14.61 13.77C15.4372 14.4097 16.4544 14.7546 17.5 14.75C18.2123 14.7508 18.9157 14.5912 19.558 14.2831C20.2002 13.9749 20.7649 13.5262 21.21 12.97C21.6867 13.3185 22.0746 13.7745 22.3421 14.301C22.6097 14.8274 22.7494 15.4095 22.75 16Z" fill="#0067FF"/>
									<path d="M7.5 11.75C9.84721 11.75 11.75 9.84721 11.75 7.5C11.75 5.15279 9.84721 3.25 7.5 3.25C5.15279 3.25 3.25 5.15279 3.25 7.5C3.25 9.84721 5.15279 11.75 7.5 11.75Z" fill="#0067FF"/>
									<path d="M17.5 13.75C19.5711 13.75 21.25 12.0711 21.25 10C21.25 7.92893 19.5711 6.25 17.5 6.25C15.4289 6.25 13.75 7.92893 13.75 10C13.75 12.0711 15.4289 13.75 17.5 13.75Z" fill="#0067FF"/>
								</svg>
								<span>{T("header.nav.referral")}</span>
							</button>
							<button 
								className="action-btn action-btn--logout" 
								type="button" 
								aria-label={T("dashboard.actions.logout")}
								onClick={() => logout()}
								disabled={isLoggingOut}
							>
								<span>{isLoggingOut ? T("dashboard.actions.logoutInProgress") : T("dashboard.actions.logout")}</span>
							</button>
						</div>
					</div>
				</aside>

				{/* Правый широкий блок (карусель пакетов) */}
				<section className="dashboard__right" data-dashboard-right>
					<div className="right__header">
						<h1 className="right__title">{T("dashboard.packagesList.title")}</h1>
							<div className="carousel__controls">
								<button
									className="carousel__btn carousel__prev"
									aria-label="prev"
									disabled={currentIndex === 0}
									onClick={prevSlide}
								>
									<img src="/arrow-left.svg" alt="Previous" width="18" height="18" />
								</button>
								<button
									className="carousel__btn carousel__next"
									aria-label="next"
									disabled={currentIndex >= maxIndex}
									onClick={nextSlide}
								>
									<img src="/arrow-right.svg" alt="Next" width="18" height="18" />
								</button>
							</div>
					</div>

					{/* Купленные пакеты прокси */}
					{renderPackages()}

					{/* Привязанные аккаунты (Часть 2 ТЗ) */}
					{user && (
						<section id="linked-accounts" className="w-full">
							<LinkedAccounts user={user} locale={currentLocale} />
						</section>
					)}
				</section>
				</div>
			</div>
		</main>
	)
}
