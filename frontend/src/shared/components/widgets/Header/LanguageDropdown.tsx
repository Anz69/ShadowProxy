"use client"

import { Check, ChevronDown } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import {
	getLocaleFromPath,
	addLocaleToPath,
	removeLocaleFromPath
} from "@/shared/utils/getLocaleFromPath"
import type { SupportedLocale } from "@/shared/utils/i18n"

type Lang = { code: SupportedLocale; short: string; name: string; flag: string }

const LANGS: Lang[] = [
	{ code: "ru", short: "RU", name: "Русский", flag: "🇷🇺" },
	{ code: "en", short: "EN", name: "English", flag: "🇬🇧" },
	{ code: "zh-CN", short: "中文", name: "中文", flag: "🇨🇳" }
]

type Props = {
	/** full-width variant for the mobile burger menu */
	block?: boolean
	/** called after a language is chosen (e.g. to close the burger menu) */
	onPicked?: () => void
}

/**
 * Compact language switcher: one trigger (globe + current language) that opens a
 * small glass menu with flag + full name + checkmark on the active one. Closes
 * on outside-click, Esc, and on select. Replaces the old 3-button row.
 */
export default function LanguageDropdown({ block = false, onPicked }: Props) {
	const pathname = usePathname()
	const router = useRouter()
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)

	const currentLocale = getLocaleFromPath(pathname)
	const current = LANGS.find(l => l.code === currentLocale) ?? LANGS[0]

	useEffect(() => {
		if (!open) return
		const onClick = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
		}
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false)
		}
		document.addEventListener("mousedown", onClick)
		document.addEventListener("keydown", onKey)
		return () => {
			document.removeEventListener("mousedown", onClick)
			document.removeEventListener("keydown", onKey)
		}
	}, [open])

	const pick = (code: SupportedLocale) => {
		setOpen(false)
		onPicked?.()
		if (code === currentLocale) return
		const pathWithoutLocale = removeLocaleFromPath(pathname)
		router.push(addLocaleToPath(pathWithoutLocale, code))
	}

	return (
		<div ref={ref} className={`lang-dd ${block ? "lang-dd--block" : ""}`}>
			<button
				type="button"
				className="lang-dd__trigger"
				aria-haspopup="listbox"
				aria-expanded={open}
				onClick={() => setOpen(v => !v)}
			>

				<svg className="lang-dd__globe" xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 8 6 6" /><path d="m4 14 6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1" /><path d="m22 22-5-10-5 10" /><path d="M14 18h6" /></svg>
				<span className="lang-dd__current">{current.short}</span>
				<ChevronDown className={`lang-dd__chev ${open ? "is-open" : ""}`} />
			</button>

			{open && (
				<div className="lang-dd__menu" role="listbox">
					{LANGS.map(l => {
						const active = l.code === currentLocale
						return (
							<button
								key={l.code}
								type="button"
								role="option"
								aria-selected={active}
								onClick={() => pick(l.code)}
								className={`lang-dd__item ${active ? "is-active" : ""}`}
							>
								<span className="lang-dd__flag">{l.flag}</span>
								<span className="lang-dd__name">{l.name}</span>
								{active && <Check className="lang-dd__check" />}
							</button>
						)
					})}
				</div>
			)}
		</div>
	)
}
