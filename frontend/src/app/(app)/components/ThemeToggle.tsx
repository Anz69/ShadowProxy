"use client"

import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"

/**
 * Dark / light switch for the landing. Toggles the `light` class on <html>
 * (base = dark; Tailwind `light:` utilities apply when present). Persisted.
 */
export default function ThemeToggle() {
	const [light, setLight] = useState(false)

	useEffect(() => {
		const isLight = localStorage.getItem("sp-theme") === "light"
		setLight(isLight)
		document.documentElement.classList.toggle("light", isLight)
	}, [])

	const toggle = () => {
		const next = !light
		setLight(next)
		document.documentElement.classList.toggle("light", next)
		try {
			localStorage.setItem("sp-theme", next ? "light" : "dark")
		} catch {
			/* ignore */
		}
	}

	return (
		<button
			type="button"
			onClick={toggle}
			role="switch"
			aria-checked={light}
			aria-label="Переключить светлую и тёмную тему"
			className="relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full border border-white/15 bg-white/10 transition-colors light:border-[#e2e4ea] light:bg-[#eef0f4]"
		>
			<Sun className="absolute left-[7px] h-3.5 w-3.5 text-[#f5b942]" aria-hidden />
			<Moon className="absolute right-[7px] h-3.5 w-3.5 text-[#9fc0ff]" aria-hidden />
			<span className={`absolute left-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.4)] transition-transform duration-300 ${light ? "translate-x-0" : "translate-x-7"}`} />
		</button>
	)
}
