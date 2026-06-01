"use client"

import { ChevronDown, Monitor, User, X, Menu } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { type FC, useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"

import { usePrices } from "@/features/proxy/hooks/usePrices"
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
	"flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white transition-all duration-200 hover:bg-white/[0.1] hover:border-white/20 hover:-translate-y-px"

const Header: FC<HeaderProps> = ({ user, locale: localeProp }) => {
	const [isHover, setIsHover] = useState(false)
	const [isClicked, setIsClicked] = useState(false)
	const [isMobileMenuOpened, setIsMobileMenuOpened] = useState(false)
	const [scrolled, setScrolled] = useState(false)
	const { prices, isLoading } = usePrices()

	const router = useRouter()
	const pathname = usePathname()
	const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
	// После выбора пункта каталога ненадолго подавляем hover-открытие: header
	// персистентный (SPA-навигация без перезагрузки), указатель часто остаётся
	// над каталогом — без этого дропдаун тут же открывался бы снова.
	const suppressHoverRef = useRef(false)

	// Прозрачный хедер сверху → стекло появляется при скролле.
	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 8)
		onScroll()
		window.addEventListener("scroll", onScroll, { passive: true })
		return () => window.removeEventListener("scroll", onScroll)
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

	const currentLocale = localeProp ?? getLocaleFromPath(pathname)
	const getLocalizedLink = (path: string) => addLocaleToPath(path, currentLocale)
	const T = (key: string) => t(key, currentLocale)

	const basePath = removeLocaleFromPath(pathname)
	const isAdminRoute = basePath.startsWith("/admin")
	const adminLink = getLocalizedLink("/admin")
	const adminLabel = T("header.nav.admin")
	const shouldShowAdminButton = user?.role === UserRole.Admin && !isAdminRoute

	// Пункт навигации: стеклянная пилюля, активный = синяя подсветка по роуту.
	const navCls = (route: string) => {
		const active = basePath.startsWith(route)
		return [
			"relative rounded-xl px-5 py-2.5 text-[15px] font-medium transition-all duration-200",
			active
				? "bg-[#0067FF]/15 text-white ring-1 ring-inset ring-[#0067FF]/40"
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
		if (!user) {
			router.push(getLocalizedLink("/auth/login"))
			return
		}
		const tariff = type === "IPV6_GB" ? "IPV6" : type
		router.push(`${getLocalizedLink("/payment")}?tariff=${tariff}`)
	}

	const catalogActive = isHover || isClicked

	return (
		<header
			className={[
				"relative mx-5 flex h-[72px] items-center rounded-[20px] px-5 transition-all duration-300 ease-out md:mx-[54px] md:px-8",
				// Прозрачный сверху → стекло при скролле
				scrolled
					? "border border-white/10 bg-[#0d0e11]/70 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.7)] backdrop-blur-xl backdrop-saturate-150"
					: "border border-transparent bg-transparent"
			].join(" ")}
		>
			{/* нижняя синяя hairline — только когда есть фон */}
			<span
				className={`pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-[#0067FF]/30 to-transparent transition-opacity duration-300 ${scrolled ? "opacity-100" : "opacity-0"}`}
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
				<nav className="relative hidden flex-row items-center gap-1 md:flex">
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
						{T("header.nav.trial")}
					</Link>
				</nav>

				{/* Правый блок */}
				<div className="flex items-center gap-2.5">
					<div className="hidden md:block">
						<LanguageDropdown />
					</div>

					<div className="hidden items-center gap-2.5 md:flex">
						{user && <NotificationBell locale={currentLocale} />}
						{shouldShowAdminButton && (
							<Link href={adminLink} className={iconBtn} aria-label={adminLabel}>
								<Monitor className="h-5 w-5" />
								<span className="sr-only">{adminLabel}</span>
							</Link>
						)}
						{user && pathname !== getLocalizedLink("/dashboard") ? (
							<Link href={getLocalizedLink("/dashboard")} className={iconBtn} aria-label={T("header.userMenu.profile")}>
								<User className="h-5 w-5" />
							</Link>
						) : !user ? (
							<button
								type="button"
								className="rounded-xl bg-[#0067FF] px-6 py-2.5 text-[15px] font-semibold text-white transition-all duration-200 hover:bg-[#0052CC] hover:shadow-[0_8px_24px_-10px_rgba(0,103,255,0.7)]"
								onClick={() => router.push(getLocalizedLink("/auth/login"))}
							>
								{T("header.login")}
							</button>
						) : null}
					</div>

					{/* Бургер (мобайл) */}
					<button
						className={`${iconBtn} md:hidden`}
						onClick={() => setIsMobileMenuOpened(prev => !prev)}
						aria-label="menu"
					>
						{isMobileMenuOpened ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
					</button>
				</div>
			</div>

			{/* Мобильное меню */}
			{isMobileMenuOpened && typeof document !== "undefined" && createPortal(
				<div className="fixed inset-0 z-[9999] flex flex-col overflow-x-hidden bg-[#0d0e11]/95 backdrop-blur-2xl">
					<div className="shrink-0 px-5 pt-[32px]">
						<div className="flex h-[72px] items-center justify-between rounded-[20px] border border-white/10 bg-white/[0.04] px-5 backdrop-blur-xl">
							<Link href={getLocalizedLink("/")} className="flex items-center gap-3" onClick={() => setIsMobileMenuOpened(false)}>
								<Image src="/logo.svg" alt={T("common.logoAlt")} width={28} height={28} priority className="h-7 w-7" />
								<span className="font-struve text-xl font-semibold text-white">Shadow<span className="text-[#8b93a7]">Proxy</span></span>
							</Link>
							<button className={iconBtn} onClick={() => setIsMobileMenuOpened(false)} aria-label="close">
								<X className="h-6 w-6" />
							</button>
						</div>
					</div>

					<div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-3 overflow-y-auto px-6 pt-8 pb-8">
						<div className="w-full">
							<button
								onClick={() => setIsClicked(prev => !prev)}
								className={`flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-medium text-white transition-colors duration-200 ${isClicked ? "bg-white/[0.12]" : "bg-white/[0.06] hover:bg-white/[0.1]"}`}
							>
								{T("header.nav.catalog")}
								<ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isClicked ? "rotate-180" : ""}`} />
							</button>
							{isClicked && !isLoading && prices && (
								<div className="mt-2 w-full">
									<PricesPopUp prices={prices} T={T} variant="burger" onItemSelect={handleCatalogItemSelect} />
								</div>
							)}
						</div>

						<Link href={getLocalizedLink("/referral")} className="rounded-xl bg-white/[0.06] px-6 py-3.5 text-center font-medium text-white transition-colors duration-200 hover:bg-white/[0.1]" onClick={() => setIsMobileMenuOpened(false)}>
							{T("header.nav.referral")}
						</Link>
						<Link href={getLocalizedLink("/u-api")} className="rounded-xl bg-white/[0.06] px-6 py-3.5 text-center font-medium text-white transition-colors duration-200 hover:bg-white/[0.1]" onClick={() => setIsMobileMenuOpened(false)}>
							{T("header.nav.api")}
						</Link>
						<Link href={getLocalizedLink("/dashboard")} className="rounded-xl bg-white/[0.06] px-6 py-3.5 text-center font-medium text-white transition-colors duration-200 hover:bg-white/[0.1]" onClick={() => setIsMobileMenuOpened(false)}>
							{T("header.nav.trial")}
						</Link>

						<div className="my-2 h-px w-full bg-white/10" />

						<LanguageDropdown block onPicked={() => setIsMobileMenuOpened(false)} />

						{shouldShowAdminButton && (
							<Link href={adminLink} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-6 py-3.5 font-medium text-white transition-colors duration-200 hover:bg-white/[0.1]" onClick={() => setIsMobileMenuOpened(false)}>
								<Monitor className="h-5 w-5" />
								{adminLabel}
							</Link>
						)}

						{user && pathname !== getLocalizedLink("/dashboard") ? (
							<Link href={getLocalizedLink("/dashboard")} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-6 py-3.5 font-medium text-white transition-colors duration-200 hover:bg-white/[0.1]" onClick={() => setIsMobileMenuOpened(false)}>
								<User className="h-5 w-5" />
								{T("header.userMenu.profile")}
							</Link>
						) : !user ? (
							<button
								type="button"
								className="w-full rounded-xl bg-[#0067FF] px-6 py-3.5 font-semibold text-white transition-all duration-200 hover:bg-[#0052CC]"
								onClick={() => {
									router.push(getLocalizedLink("/auth/login"))
									setIsMobileMenuOpened(false)
								}}
							>
								{T("header.login")}
							</button>
						) : null}
					</div>
				</div>,
				document.documentElement
			)}
		</header>
	)
}

export default Header
