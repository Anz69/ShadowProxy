"use client"

import type { FC } from "react"
import { useState, useEffect } from "react"

import type { SupportedLocale } from "@/shared/utils/i18n"
import { t } from "@/shared/utils/i18n"

type Unit = "MB" | "GB"

type Preset = { label: string; valueGb: number }

const PRESETS: Preset[] = [
	{ label: "100 MB", valueGb: 0.1 },
	{ label: "250 MB", valueGb: 0.25 },
	{ label: "500 MB", valueGb: 0.5 },
	{ label: "1 GB", valueGb: 1 },
	{ label: "5 GB", valueGb: 5 },
	{ label: "10 GB", valueGb: 10 }
]

const MIN_GB = 0.1
const MIN_MB = 100

type Props = {
	valueGb: number
	onChangeGb: (v: number) => void
	error?: string
	locale?: SupportedLocale
}

const fmtGb = (n: number): string => {
	if (Number.isInteger(n)) return n.toString()
	return n.toFixed(n < 1 ? 2 : 1).replace(/\.?0+$/, "")
}

const displayFor = (valueGb: number, unit: Unit): string => {
	const clamped = Math.max(MIN_GB, valueGb)
	if (unit === "MB") {
		// При полу (0.1 GB = 102.4 MB) показываем ровно "100" — чище для UI
		const mb = clamped <= MIN_GB + 1e-9 ? MIN_MB : Math.round(clamped * 1024)
		return Math.max(MIN_MB, mb).toString()
	}
	return fmtGb(clamped)
}

const TrafficInput: FC<Props> = ({ valueGb, onChangeGb, error, locale = "ru" }) => {
	const T = (key: string) => t(key, locale)
	const [unit, setUnit] = useState<Unit>(valueGb < 1 ? "MB" : "GB")
	const [draft, setDraft] = useState<string>(() => displayFor(valueGb, unit))
	const [clampFlash, setClampFlash] = useState(false)

	useEffect(() => {
		setDraft(displayFor(valueGb, unit))
	}, [valueGb, unit])

	const flashClamp = () => {
		setClampFlash(true)
		setTimeout(() => setClampFlash(false), 600)
	}

	const commit = (raw: string) => {
		const num = Number(raw.replace(",", "."))
		// invalid / empty / non-positive → snap to floor + flash
		if (!Number.isFinite(num) || num <= 0) {
			flashClamp()
			onChangeGb(MIN_GB)
			return
		}
		const gb = unit === "MB" ? num / 1024 : num
		// под полом — clamp + flash
		if (gb < MIN_GB - 1e-9) {
			flashClamp()
			onChangeGb(MIN_GB)
			return
		}
		onChangeGb(Math.round(gb * 1000) / 1000)
	}

	const cur = (): number => Number(draft.replace(",", ".")) || 0
	const isAtFloor = valueGb <= MIN_GB + 1e-9

	const stepDown = () => {
		const step = unit === "MB" ? 100 : 1
		const floor = unit === "MB" ? MIN_MB : MIN_GB
		const next = Math.max(floor, cur() - step)
		commit(next.toString())
	}
	const stepUp = () => {
		const step = unit === "MB" ? 100 : 1
		commit((cur() + step).toString())
	}
	const switchUnit = (next: Unit) => {
		if (next === unit) return
		setUnit(next)
	}

	const unitBtn = (active: boolean) =>
		`rounded-[8px] px-3 py-1 text-sm font-semibold transition-colors ${
			active ? "bg-[#2f6bff]/20 text-[#6aa5ff] light:text-[#2f6bff]" : "text-white/45 hover:text-white/70 light:text-[#8a93a3] light:hover:text-[#475467]"
		}`

	const fieldCls = [
		"flex items-center gap-2 rounded-2xl border bg-white/[0.04] light:bg-[#f7f8fb] px-2.5 py-2.5 transition-all focus-within:ring-4 focus-within:ring-[#4f8dff]/15",
		error ? "border-[#F44653]/60" : "border-white/10 focus-within:border-[#4f8dff]/60 light:border-[#e2e4ea]",
		clampFlash && "border-[#6aa5ff]/60"
	].filter(Boolean).join(" ")

	return (
		<div className="traffic-input-v2 flex flex-col gap-3">
			<div className="flex items-center justify-between">
				<span className="text-white/60 text-base font-medium light:text-[#5b6472]">{T("payment.traffic")}</span>
				<div className="flex items-center gap-1 rounded-[10px] border border-white/10 bg-white/[0.03] p-1 light:border-[#e2e4ea] light:bg-[#f4f6fa]" role="tablist">
					<button
						type="button"
						role="tab"
						aria-selected={unit === "MB"}
						className={unitBtn(unit === "MB")}
						onClick={() => switchUnit("MB")}
					>MB</button>
					<button
						type="button"
						role="tab"
						aria-selected={unit === "GB"}
						className={unitBtn(unit === "GB")}
						onClick={() => switchUnit("GB")}
					>GB</button>
				</div>
			</div>

			<div className={fieldCls}>
				<button
					type="button"
					className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 transition-colors hover:bg-white/[0.08] disabled:opacity-40 light:border-[#e2e4ea] light:bg-[#f4f6fa] light:text-[#475467] light:hover:bg-[#eef1f6]"
					onClick={stepDown}
					disabled={isAtFloor}
					aria-label="−"
				>
					<svg width="16" height="2" viewBox="0 0 16 2" fill="none"><path d="M1 1H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
				</button>
				<input
					type="text"
					inputMode="decimal"
					className="min-w-0 flex-1 bg-transparent text-center font-[TalosDisplay] text-white text-[30px] font-bold outline-none light:text-[#0e1019]"
					value={draft}
					min={unit === "MB" ? MIN_MB : MIN_GB}
					onChange={e => setDraft(e.target.value)}
					onBlur={() => commit(draft)}
					onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
				/>
				<span className="shrink-0 text-white/45 text-sm font-medium light:text-[#8a93a3]">{unit}</span>
				<button
					type="button"
					className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 transition-colors hover:bg-white/[0.08] light:border-[#e2e4ea] light:bg-[#f4f6fa] light:text-[#475467] light:hover:bg-[#eef1f6]"
					onClick={stepUp}
					aria-label="+"
				>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1V15M1 8H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
				</button>
			</div>

			<div className="text-white/45 text-sm light:text-[#8a93a3]">
				{unit === "MB" ? `Минимум ${MIN_MB} МБ` : `Минимум ${MIN_GB} ГБ`}
			</div>

			<div className="flex flex-wrap gap-2">
				{PRESETS.map(p => {
					const active = Math.abs(valueGb - p.valueGb) < 1e-6
					return (
						<button
							key={p.label}
							type="button"
							className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
								active
									? "border-[#6aa5ff]/50 bg-[#2f6bff]/10 text-[#6aa5ff] ring-1 ring-[#6aa5ff]/30 light:border-[#2f6bff]/30 light:text-[#2f6bff]"
									: "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white/80 light:border-[#e2e4ea] light:bg-[#f4f6fa] light:text-[#5b6472] light:hover:text-[#475467]"
							}`}
							onClick={() => onChangeGb(p.valueGb)}
						>
							{p.label}
						</button>
					)
				})}
			</div>

			{error && <span className="text-[#F44653] text-sm">{error}</span>}
		</div>
	)
}

export default TrafficInput
