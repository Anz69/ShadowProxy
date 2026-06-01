"use client"

import { Globe, ChevronDown } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useState, useRef, useEffect } from "react"
import { getLocaleFromPath, addLocaleToPath, removeLocaleFromPath } from "@/shared/utils/getLocaleFromPath"
import type { SupportedLocale } from "@/shared/utils/i18n"

const languages: { code: SupportedLocale; name: string; flag: string }[] = [
	{ code: "ru", name: "Русский", flag: "🇷🇺" },
	{ code: "en", name: "English", flag: "🇬🇧" },
	{ code: "zh-CN", name: "中文", flag: "🇨🇳" },
]

export default function LanguageSwitcher() {
	const [isOpen, setIsOpen] = useState(false)
	const pathname = usePathname()
	const router = useRouter()
	const dropdownRef = useRef<HTMLDivElement>(null)

	// Get current locale from pathname
	const currentLocale = getLocaleFromPath(pathname)
	const currentLanguage = languages.find((lang) => lang.code === currentLocale) || languages[0]

	// Close dropdown when clicking outside
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsOpen(false)
			}
		}

		document.addEventListener("mousedown", handleClickOutside)
		return () => {
			document.removeEventListener("mousedown", handleClickOutside)
		}
	}, [])

	const handleLanguageChange = (locale: SupportedLocale) => {
		if (locale === currentLocale) {
			setIsOpen(false)
			return
		}

		// Get path without locale
		const pathWithoutLocale = removeLocaleFromPath(pathname)
		
		// Add new locale to path
		const newPath = addLocaleToPath(pathWithoutLocale, locale)
		
		// Navigate to new path
		router.push(newPath)
		setIsOpen(false)
	}

	return (
		<div className="relative" ref={dropdownRef}>
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="text-white relative flex flex-row items-center gap-2 px-5 py-2 rounded-xl cursor-pointer duration-200 hover:bg-white/10"
				style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
			>
				<Globe className="h-4 w-4" />
				<span className="hidden md:inline">{currentLanguage.flag}</span>
				<span className="hidden lg:inline">{currentLanguage.name}</span>
				<ChevronDown
					className={`h-4 w-4 duration-200 ${isOpen ? "rotate-180" : ""}`}
				/>
			</button>

			{isOpen && (
				<div className="absolute top-full right-0 mt-2 w-48 md:w-48 bg-[rgba(24,25,29,0.95)] border border-white/25 rounded-xl shadow-lg overflow-hidden z-50">
					{languages.map((lang) => (
						<button
							key={lang.code}
							type="button"
							onClick={() => handleLanguageChange(lang.code)}
							className={`w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-white/10 transition-colors ${
								lang.code === currentLocale
									? "bg-white/20 text-white font-semibold"
									: "text-white/80"
							}`}
						>
							<span className="text-xl">{lang.flag}</span>
							<span>{lang.name}</span>
							{lang.code === currentLocale && (
								<span className="ml-auto text-white/60">✓</span>
							)}
						</button>
					))}
				</div>
			)}
		</div>
	)
}

