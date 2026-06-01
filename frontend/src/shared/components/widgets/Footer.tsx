"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { FC } from "react"
import { getLocaleFromPath, addLocaleToPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"
import type { SupportedLocale } from "@/shared/utils/i18n"

type FooterProps = {
	locale?: SupportedLocale
}

const Footer: FC<FooterProps> = ({ locale: localeProp }) => {
	const pathname = usePathname()
	const currentLocale = localeProp ?? getLocaleFromPath(pathname)
	
	const getLocalizedLink = (path: string) => {
		return addLocaleToPath(path, currentLocale)
	}
	
	// Translation function with current locale
	const T = (key: string) => t(key, currentLocale)
	return (
		<footer className="w-full p-3 md:px-25 md:py-6" style={{ backgroundColor: '#010203' }}>
			{/* Десктопная версия */}
			<div className="hidden md:flex w-full flex-row items-center justify-between">
				{/* Левая часть: логотип + название */}
				<Link href={getLocalizedLink("/")} className="flex items-center gap-3">
					<Image
						src="/logo.svg"
						alt={T("common.logoAlt")}
						width={28}
						height={28}
						priority
						className="h-7 w-7"
					/>
					<span className="text-white text-xl font-semibold font-struve">Shadow Proxy</span>
				</Link>

				{/* Центральная часть: навигационные кнопки */}
				<nav className="flex flex-row items-center gap-1">
					<Link
						href={getLocalizedLink("/")}
						className="footer-nav-btn text-white px-5 py-2 rounded-xl cursor-pointer"
					>
						{T("footer.nav.catalog")}
					</Link>
					<Link
						href={getLocalizedLink("/u-api")}
						className="footer-nav-btn text-white px-5 py-2 rounded-xl cursor-pointer"
					>
						{T("footer.nav.api")}
					</Link>
					<Link
						href={getLocalizedLink("/dashboard")}
						className="footer-nav-btn text-white px-5 py-2 rounded-xl cursor-pointer"
					>
						{T("footer.nav.dashboard")}
					</Link>
					<Link
						href={getLocalizedLink("/support")}
						className="footer-nav-btn text-white px-5 py-2 rounded-xl cursor-pointer"
					>
						{T("footer.nav.support")}
					</Link>
					<Link
						href={getLocalizedLink("/terms")}
						className="footer-nav-btn text-white px-5 py-2 rounded-xl cursor-pointer"
					>
						{T("footer.nav.terms")}
					</Link>
				</nav>

				{/* Правая часть: Privacy Policy */}
				<Link
					href={getLocalizedLink("/privacy")}
					className="text-white text-sm md:text-lg font-normal cursor-pointer transition-colors duration-200 hover:text-[#067BFF]"
				>
					{T("footer.nav.privacy")}
				</Link>
			</div>

			{/* Мобильная версия */}
			<div className="md:hidden flex flex-col gap-3">
				{/* Левая часть: логотип + название */}
				<div className="flex justify-start">
					<Link href={getLocalizedLink("/")} className="flex items-center gap-3">
						<Image
							src="/logo.svg"
							alt={T("common.logoAlt")}
							width={28}
							height={28}
							priority
							className="h-7 w-7"
						/>
						<span className="text-white text-xl font-semibold font-struve">Shadow Proxy</span>
					</Link>
				</div>

				{/* Вертикальные кнопки - по центру */}
				<nav className="flex flex-col items-center w-full gap-2 px-4 mt-6">
					<Link
						href={getLocalizedLink("/")}
						className="footer-nav-btn text-white w-full text-center px-5 py-3 rounded-xl cursor-pointer"
					>
						{T("footer.nav.catalog")}
					</Link>
					<Link
						href={getLocalizedLink("/u-api")}
						className="footer-nav-btn text-white w-full text-center px-5 py-3 rounded-xl cursor-pointer"
					>
						{T("footer.nav.api")}
					</Link>
					<Link
						href={getLocalizedLink("/dashboard")}
						className="footer-nav-btn text-white w-full text-center px-5 py-3 rounded-xl cursor-pointer"
					>
						{T("footer.nav.dashboard")}
					</Link>
					<Link
						href={getLocalizedLink("/support")}
						className="footer-nav-btn text-white w-full text-center px-5 py-3 rounded-xl cursor-pointer"
					>
						{T("footer.nav.support")}
					</Link>
					<Link
						href={getLocalizedLink("/terms")}
						className="footer-nav-btn text-white w-full text-center px-5 py-3 rounded-xl cursor-pointer"
					>
						{T("footer.nav.terms")}
					</Link>
				</nav>

				{/* Privacy Policy - по центру */}
				<div className="flex justify-center mt-6">
					<Link
						href={getLocalizedLink("/privacy")}
						className="text-white text-sm font-normal cursor-pointer transition-colors duration-200 hover:text-[#067BFF]"
					>
						{T("footer.nav.privacy")}
					</Link>
				</div>
			</div>
		</footer>
	)
}

export default Footer
