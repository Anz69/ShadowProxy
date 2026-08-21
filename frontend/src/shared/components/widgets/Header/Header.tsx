"use client"

import { ChevronDown, ChevronRight, Monitor, User, X, Menu, Layers, Users, Code2, LayoutDashboard, Zap } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { type FC, useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"

import { usePrices } from "@/features/proxy/hooks/usePrices"
import { useCurrentSessionUser } from "@/features/user/hooks/useCurrentSessionUser"
import type { User as UserType } from "@/features/user/types/user.types"
import { UserRole } from "@/features/user/types/user.types"

import NotificationBell from "@/features/notifications/components/NotificationBell"
import PricesPopUp, { type CatalogItemType } from "@/shared/components/widgets/Header/PricesPopUp"
import LanguageDropdown from "@/shared/components/widgets/Header/LanguageDropdown"
import { getLocaleFromPath, addLocaleToPath, removeLocaleFromPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"
import type { SupportedLocale } from "@/shared/utils/i18n"

type HeaderProps = {
	user?: UserType | null | undefined
	locale?: SupportedLocale
}

// Иконка-кнопка хедера (44×44): тонкое стекло, лёгкая подсветка на hover.
const iconBtn =
	"flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-gradient-to-b from-white/[0.12] to-white/[0.04] text-white backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:border-white/25 hover:from-white/[0.18] hover:to-white/[0.07]"

const Header: FC<HeaderProps> = ({ user, locale: localeProp }) => {
	const [isHover, setIsHover] = useState(false)
	const [isClicked, setIsClicked] = useState(false)
	const [isMobileMenuOpened, setIsMobileMenuOpened] = useState(false)
	const { prices, isLoading } = usePrices()
	const { data: sessionUser } = useCurrentSessionUser(user)
	// undefined = браузер ещё не перепроверил сессию; null = сервер подтвердил гостя.
	const currentUser = sessionUser === undefined ? user : sessionUser

	const router = useRouter()
	const pathname = usePathname()
	const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
	const headerRef = useRef<HTMLElement>(null)
	// После выбора пункта каталога ненадолго подавляем hover-открытие: header
	// персистентный (SPA-навигация без перезагрузки), указатель часто остаётся
	// над каталогом — без этого дропдаун тут же открывался бы снова.
	const suppressHoverRef = useRef(false)

	// Прогрессивное «нарастание» стекла: одна переменная --p (0 сверху → 1 при
	// скролле на RANGE px). Все визуальные свойства интерполируются через calc().
	useEffect(() => {
		const RANGE = 90
		const el = headerRef.current
		if (!el) return
		let raf = 0
		const apply = () => {
			raf = 0
			const p = Math.min(window.scrollY / RANGE, 1)
			el.style.setProperty("--p", p.toFixed(3))
		}
		const onScroll = () => {
			if (!raf) raf = requestAnimationFrame(apply)
		}
		apply()
		window.addEventListener("scroll", onScroll, { passive: true })
		return () => {
			window.removeEventListener("scroll", onScroll)
			if (raf) cancelAnimationFrame(raf)
		}
	}, [])

	const openCatalogHover = () => {
		if (suppressHoverRef.current) return
		if (hoverTimeoutRef.current) {
			clearTimeout(hoverTimeoutRef.current)
			hoverTimeoutRef.current = null
		}
		setIsHover(true)
	}
	const closeCatalogSoon = () => {
		hoverTimeoutRef.current = setTimeout(() => setIsHover(false), 300)
	}

	// Источник истины — URL (реактивен к смене языка через router.push). Серверный
	// locale-prop из persistent-шелла НЕ перекрываем: он устаревает при клиентской
	// навигации и «залипал» бы на языке загрузки. URL всегда кодирует локаль (ru = без
	// префикса), поэтому getLocaleFromPath корректен и на первом рендере, и после смены.
	const currentLocale = getLocaleFromPath(pathname) ?? localeProp
	const getLocalizedLink = (path: string) => addLocaleToPath(path, currentLocale)
	const T = (key: string) => t(key, currentLocale)

	const basePath = removeLocaleFromPath(pathname)
	// Unified premium "header-light" capsule is applied on every page now
	// (styles live in globals.css); no per-route header variant.
	const isAdminRoute = basePath.startsWith("/admin")
	const adminLink = getLocalizedLink("/admin")
	const adminLabel = T("header.nav.admin")
	const shouldShowAdminButton = currentUser?.role === UserRole.Admin && !isAdminRoute

	// Пункт навигации: стеклянная пилюля, активный = синяя подсветка по роуту.
	const navCls = (route: string) => {
		const active = basePath.startsWith(route)
		return [
			"relative overflow-hidden rounded-xl px-5 py-2.5 text-[15px] font-medium transition-all duration-200",
			active
				? "nav-active"
				: "text-white/75 hover:bg-white/[0.07] hover:text-white"
		].join(" ")
	}

	const handleCatalogItemSelect = (type: CatalogItemType) => {
		setIsMobileMenuOpened(false)
		setIsClicked(false)
		setIsHover(false)
		if (hoverTimeoutRef.current) {
			clearTimeout(hoverTimeoutRef.current)
			hoverTimeoutRef.current = null
		}
		suppressHoverRef.current = true
		setTimeout(() => { suppressHoverRef.current = false }, 700)
		if (!currentUser) {
			router.push(getLocalizedLink("/auth/login"))
			return
		}
		const tariff = type === "IPV6_GB" ? "IPV6" : type
		router.push(`${getLocalizedLink("/payment")}?tariff=${tariff}`)
	}

	const catalogActive = isHover || isClicked

	// Mobile-menu row: icon chip + label + chevron, theme-aware glass card.
	const mItem =
		"group flex w-full items-center gap-3.5 rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3.5 text-[15px] font-medium text-white transition-all duration-200 hover:border-white/15 hover:bg-white/[0.08] light:border-[#e9ebf0] light:bg-white light:text-[#0e1019] light:hover:border-[#d8dde6] light:hover:bg-[#f4f6fa]"
	const mIconBox =
		"flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-[#6aa5ff] transition-colors group-hover:bg-white/[0.1] light:bg-[#2f6bff]/[0.08] light:text-[#2f6bff]"
	const mChevron = "h-4 w-4 flex-shrink-0 text-white/30 transition-transform group-hover:translate-x-0.5 light:text-black/25"

	return (
		<header
			ref={headerRef}
			className={`header-progressive header-light relative flex items-center border border-solid pl-5 [--inset:20px] [--p:0] md:pl-8 md:[--inset:54px] pr-2.5`}
			style={{
				marginInline: "calc(var(--inset) * var(--p))",
				height: "calc(80px - 12px * var(--p))",
				borderRadius: "calc(20px * var(--p))",
				paddingRight: "10px",
				background:
					"linear-gradient(180deg, rgba(255,255,255,calc(.05*var(--p))), rgba(255,255,255,calc(.015*var(--p)))), rgba(12,14,19,calc(.72*var(--p)))",
				borderColor: "rgba(255,255,255,calc(.10*var(--p)))",
				WebkitBackdropFilter: "blur(calc(20px*var(--p))) saturate(calc(100% + 60% * var(--p)))",
				backdropFilter: "blur(calc(20px*var(--p))) saturate(calc(100% + 60% * var(--p)))",
				boxShadow:
					"0 calc(24px*var(--p)) calc(60px*var(--p)) calc(-26px*var(--p)) rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,calc(.07*var(--p)))",
				transition:
					"height .45s cubic-bezier(.16,1,.3,1), border-radius .45s cubic-bezier(.16,1,.3,1), margin .45s cubic-bezier(.16,1,.3,1)"
			}}
		>
			{/* синяя hairline по нижней кромке — нарастает вместе со стеклом */}
			<span
				className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-[#0067FF]/50 to-transparent"
				style={{ opacity: "var(--p)" }}
			/>

			<div className="mx-auto flex h-full w-full max-w-[1792px] items-center justify-between">
				{/* Логотип */}
				<Link href={getLocalizedLink("/")} className="group flex items-center gap-3">
					<Image
						src="/logo.svg"
						alt={T("common.logoAlt")}
						width={28}
						height={28}
						priority
						className="h-7 w-7 transition-transform duration-200 group-hover:scale-110"
					/>
					<span className="font-struve text-xl font-semibold text-white">Shadow<span className="text-[#8b93a7]">Proxy</span></span>
				</Link>

				{/* Навигация (десктоп) */}
				<nav className="relative hidden flex-row items-center gap-1 lg:flex">
					<span
						onMouseEnter={openCatalogHover}
						onMouseLeave={closeCatalogSoon}
						onClick={() => setIsClicked(prev => !prev)}
						className={`relative flex cursor-pointer flex-row items-center gap-2 rounded-xl px-5 py-2.5 text-[15px] font-medium transition-all duration-200 ${catalogActive ? "bg-white/[0.07] text-white" : "text-white/75 hover:bg-white/[0.07] hover:text-white"}`}
					>
						{T("header.nav.catalog")}
						<ChevronDown className={`h-4 w-4 transition-transform duration-200 ${catalogActive ? "rotate-180" : ""}`} />
						{catalogActive && !isLoading && prices && (
							<PricesPopUp
								prices={prices}
								T={T}
								variant="dropdown"
								onItemSelect={handleCatalogItemSelect}
								onMouseEnter={openCatalogHover}
								onMouseLeave={closeCatalogSoon}
							/>
						)}
					</span>
					<Link href={getLocalizedLink("/referral")} className={navCls("/referral")}>
						{T("header.nav.referral")}
					</Link>
					<Link href={getLocalizedLink("/u-api")} className={navCls("/u-api")}>
						{T("header.nav.api")}
					</Link>
					<Link href={getLocalizedLink("/dashboard")} className={`${navCls("/dashboard")} whitespace-nowrap`}>
						{currentUser ? T("header.nav.dashboard") : T("header.nav.trial")}
					</Link>
				</nav>

				{/* Правый блок */}
				<div className="flex items-center gap-2.5">
					<div className="hidden lg:block">
						<LanguageDropdown />
					</div>

					{/* Telegram — на всех страницах, рядом с языковым переключателем */}
					<a
						href="https://t.me/shadowproxy"
						target="_blank"
						rel="noopener noreferrer"
						className="hidden lg:flex h-11 w-11 items-center justify-center rounded-xl bg-[#0067FF] text-white transition-all duration-200 hover:brightness-110"
						aria-label="Telegram"
					>
						<svg viewBox="0 0 24 24" fill="currentColor" className="text-white h-5 w-5" aria-hidden="true">
							<path d="M21.94 5.26l-3.03 14.3c-.23 1.01-.83 1.26-1.68.78l-4.64-3.42-2.24 2.16c-.25.25-.46.46-.93.46l.33-4.72 8.59-7.76c.37-.33-.08-.52-.58-.19l-10.62 6.69-4.58-1.43c-1-.31-1.01-1 .21-1.48l17.9-6.9c.83-.31 1.56.2 1.27 1.55z" />
						</svg>
					</a>

					<div className="hidden items-center gap-2.5 lg:flex">
						{currentUser && <NotificationBell locale={currentLocale} />}
						{shouldShowAdminButton && (
							<Link href={adminLink} className={iconBtn} aria-label={adminLabel}>
								<Monitor className="h-5 w-5" />
								<span className="sr-only">{adminLabel}</span>
							</Link>
						)}
						{currentUser && pathname !== getLocalizedLink("/dashboard") ? (
							<Link href={getLocalizedLink("/dashboard")} className={iconBtn} aria-label={T("header.userMenu.profile")}>
								<User className="h-5 w-5" />
							</Link>
						) : !currentUser ? (
							<button
								type="button"
								className="lg-btn lg-btn--primary lg-btn--sm"
								onClick={() => router.push(getLocalizedLink("/auth/login"))}
							>
								<span className="lg-sheen" />
								{T("header.login")}
							</button>
						) : null}
					</div>

					{/* Бургер (мобайл/планшет) */}
					<button
						className={`${iconBtn} lg:hidden`}
						onClick={() => setIsMobileMenuOpened(prev => !prev)}
						aria-label="menu"
					>
						{isMobileMenuOpened ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
					</button>
				</div>
			</div>

			{/* Мобильное меню */}
			{isMobileMenuOpened && typeof document !== "undefined" && createPortal(
				<div className="fixed inset-0 z-[9999] flex flex-col overflow-x-hidden bg-[#0a0c12]/95 backdrop-blur-2xl [animation:sp-fade-in_.2s_ease] light:bg-[#eceff5]/95">
					<div className="shrink-0 px-5 pt-[24px]">
						<div className="flex h-[64px] items-center justify-between rounded-[18px] border border-white/10 bg-white/[0.04] px-5 backdrop-blur-xl light:border-[#e6e8ef] light:bg-white">
							<Link href={getLocalizedLink("/")} className="flex items-center gap-3" onClick={() => setIsMobileMenuOpened(false)}>
								{/* лого в SVG залит белым → в светлой теме перекрашиваем в бренд-синий, иначе сливается с белой шапкой */}
								<Image src="/logo.svg" alt={T("common.logoAlt")} width={28} height={28} priority className="h-7 w-7 light:[filter:brightness(0)_saturate(100%)_invert(31%)_sepia(98%)_saturate(1400%)_hue-rotate(203deg)]" />
								<span className="font-struve text-xl font-semibold text-white light:text-[#0e1019]">Shadow<span className="text-[#8b93a7] light:text-[#2f6bff]">Proxy</span></span>
							</Link>
							<button className={`${iconBtn} light:border-[#e2e4ea] light:from-white light:to-white light:text-[#475467] light:hover:border-[#2f6bff]/40 light:hover:text-[#2f6bff]`} onClick={() => setIsMobileMenuOpened(false)} aria-label="close">
								<X className="h-6 w-6" />
							</button>
						</div>
					</div>

					<div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-2.5 overflow-y-auto px-5 pt-6 pb-8">
						{/* Catalog accordion */}
						<div className="w-full [animation:sp-rise_.3s_ease_both]">
							<button
								onClick={() => setIsClicked(prev => !prev)}
								className={`${mItem} ${isClicked ? "border-white/15 bg-white/[0.08] light:border-[#d8dde6] light:bg-[#f4f6fa]" : ""}`}
							>
								<span className={mIconBox}><Layers className="h-[18px] w-[18px]" /></span>
								<span className="flex-1 text-left">{T("header.nav.catalog")}</span>
								<ChevronDown className={`h-4 w-4 flex-shrink-0 text-white/40 transition-transform duration-200 light:text-black/35 ${isClicked ? "rotate-180" : ""}`} />
							</button>
							{isClicked && !isLoading && prices && (
								<div className="mt-2 w-full">
									<PricesPopUp prices={prices} T={T} variant="burger" onItemSelect={handleCatalogItemSelect} />
								</div>
							)}
						</div>

						<Link href={getLocalizedLink("/referral")} className={`${mItem} [animation:sp-rise_.3s_ease_both] [animation-delay:40ms]`} onClick={() => setIsMobileMenuOpened(false)}>
							<span className={mIconBox}><Users className="h-[18px] w-[18px]" /></span>
							<span className="flex-1 text-left">{T("header.nav.referral")}</span>
							<ChevronRight className={mChevron} />
						</Link>
						<Link href={getLocalizedLink("/u-api")} className={`${mItem} [animation:sp-rise_.3s_ease_both] [animation-delay:80ms]`} onClick={() => setIsMobileMenuOpened(false)}>
							<span className={mIconBox}><Code2 className="h-[18px] w-[18px]" /></span>
							<span className="flex-1 text-left">{T("header.nav.api")}</span>
							<ChevronRight className={mChevron} />
						</Link>
						<Link href={getLocalizedLink("/dashboard")} className={`${mItem} [animation:sp-rise_.3s_ease_both] [animation-delay:120ms]`} onClick={() => setIsMobileMenuOpened(false)}>
							<span className={mIconBox}>{currentUser ? <LayoutDashboard className="h-[18px] w-[18px]" /> : <Zap className="h-[18px] w-[18px]" />}</span>
							<span className="flex-1 text-left">{currentUser ? T("header.nav.dashboard") : T("header.nav.trial")}</span>
							<ChevronRight className={mChevron} />
						</Link>

						{shouldShowAdminButton && (
							<Link href={adminLink} className={`${mItem} [animation:sp-rise_.3s_ease_both] [animation-delay:160ms]`} onClick={() => setIsMobileMenuOpened(false)}>
								<span className={mIconBox}><Monitor className="h-[18px] w-[18px]" /></span>
								<span className="flex-1 text-left">{adminLabel}</span>
								<ChevronRight className={mChevron} />
							</Link>
						)}

						<div className="my-1.5 h-px w-full bg-white/10 light:bg-black/[0.08]" />

						<div className="[animation:sp-rise_.3s_ease_both] [animation-delay:200ms]">
							<LanguageDropdown block onPicked={() => setIsMobileMenuOpened(false)} />
						</div>

						<div className="pt-1 [animation:sp-rise_.3s_ease_both] [animation-delay:240ms]">
							{currentUser && pathname !== getLocalizedLink("/dashboard") ? (
								<Link href={getLocalizedLink("/dashboard")} className={mItem} onClick={() => setIsMobileMenuOpened(false)}>
									<span className={mIconBox}><User className="h-[18px] w-[18px]" /></span>
									<span className="flex-1 text-left">{T("header.userMenu.profile")}</span>
									<ChevronRight className={mChevron} />
								</Link>
							) : !currentUser ? (
								<button
									type="button"
									className="lg-btn lg-btn--primary lg-btn--block"
									onClick={() => {
										router.push(getLocalizedLink("/auth/login"))
										setIsMobileMenuOpened(false)
									}}
								>
									<span className="lg-sheen" />
									{T("header.login")}
								</button>
							) : null}
						</div>
					</div>
				</div>,
				document.documentElement
			)}
		</header>
	)
}

export default Header
