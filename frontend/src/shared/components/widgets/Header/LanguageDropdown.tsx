"use client"

import { Check, ChevronDown, Globe } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import {
	getLocaleFromPath,
	addLocaleToPath,
	removeLocaleFromPath
} from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"
import type { SupportedLocale } from "@/shared/utils/i18n"

type Lang = { code: SupportedLocale; short: string; tile: string; name: string }

// tile = текстовый код в плитке (без эмодзи-флагов, по бренд-правилу)
const LANGS: Lang[] = [
	{ code: "ru", short: "РУ", tile: "RU", name: "Русский" },
	{ code: "en", short: "EN", tile: "EN", name: "English" },
	{ code: "zh-CN", short: "中文", tile: "中", name: "中文" }
]

const EASE = "cubic-bezier(.16,1,.3,1)"

type Props = {
	/** full-width variant for the mobile burger menu */
	block?: boolean
	/** called after a language is chosen (e.g. to close the burger menu) */
	onPicked?: () => void
}

/**
 * Compact language switcher (per HEADER-SPEC): backgroundless trigger
 * (globe + current code + chevron) opens a glass menu with a caption label,
 * code-tile + name + checkmark on the active locale. Closes on outside-click,
 * Esc, and select. i18n-aware: label localised via t(), switches locale by
 * rewriting the path. Pure Tailwind, no bespoke CSS classes.
 */
export default function LanguageDropdown({ block = false, onPicked }: Props) {
	const pathname = usePathname()
	const router = useRouter()
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)

	const currentLocale = getLocaleFromPath(pathname)
	const current = LANGS.find(l => l.code === currentLocale) ?? LANGS[0]
	const T = (key: string) => t(key, currentLocale)

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
		<div ref={ref} className={`relative ${block ? "w-full" : ""}`}>
			<button
				type="button"
				aria-haspopup="listbox"
				aria-expanded={open}
				onClick={() => setOpen(v => !v)}
				className={`group inline-flex h-11 items-center gap-[7px] rounded-[10px] px-2.5 text-[14px] font-semibold tracking-[0.02em] transition-colors duration-200 ${
					open ? "text-white" : "text-[#98a2b3] hover:text-white"
				} ${block ? "w-full justify-center" : ""}`}
				style={{ transitionTimingFunction: EASE }}
			>
				<Globe
					className={`h-4 w-4 shrink-0 transition-opacity duration-200 ${open ? "opacity-90" : "opacity-60 group-hover:opacity-90"}`}
				/>
				<span className="min-w-[18px] text-left">{current.short}</span>
				<ChevronDown
					className={`h-[13px] w-[13px] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
					style={{ transitionTimingFunction: EASE }}
				/>
			</button>

			{open && (
				<div
					role="listbox"
					className={`absolute top-[calc(100%+12px)] z-[60] flex min-w-[188px] flex-col gap-[3px] rounded-[18px] border border-white/[0.08] p-[7px] backdrop-blur-[28px] backdrop-saturate-[1.65] ${block ? "inset-x-0 w-full origin-top" : "right-0 origin-top-right"}`}
					style={{
						background:
							"linear-gradient(180deg, rgba(22,25,32,.94), rgba(15,17,22,.94))",
						boxShadow:
							"0 30px 70px -28px rgba(0,0,0,.82), 0 0 0 1px rgba(255,255,255,.02), inset 0 1px 0 rgba(255,255,255,.08)",
						animation: `lang-in .22s ${EASE}`
					}}
				>
			
					{LANGS.map(l => {
						const active = l.code === currentLocale
						return (
							<button
								key={l.code}
								type="button"
								role="option"
								aria-selected={active}
								onClick={() => pick(l.code)}
								className={`group/item relative flex w-full items-center gap-3 rounded-xl border-0 px-2.5 py-[9px] text-left text-[14.5px] font-medium transition-all duration-150 ${
									active ? "text-white" : "text-[#98a2b3] hover:bg-white/[0.05] hover:text-white"
								}`}
								style={{
									transitionTimingFunction: EASE,
									...(active
										? {
												background:
													"linear-gradient(180deg, rgba(0,103,255,.2), rgba(0,103,255,.07))",
												boxShadow: "inset 0 0 0 1px rgba(0,103,255,.28)"
											}
										: {})
								}}
							>
					
								<span className="flex-1 text-[14.5px] font-semibold">{l.name}</span>
								<Check
									className={`h-4 w-4 shrink-0 text-[#79a8ff] transition-all duration-150 ${active ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}
									style={{ transitionTimingFunction: EASE }}
								/>
							</button>
						)
					})}
				</div>
			)}
		</div>
	)
}
