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

	const fieldCls = [
		"traffic-input-v2__field",
		error && "traffic-input-v2__field--error",
		clampFlash && "traffic-input-v2__field--flash"
	].filter(Boolean).join(" ")

	return (
		<div className="traffic-input-v2">
			<div className="traffic-input-v2__head">
				<span className="traffic-input-v2__label">{T("payment.traffic")}</span>
				<div className="traffic-input-v2__unit-toggle" role="tablist">
					<button
						type="button"
						role="tab"
						aria-selected={unit === "MB"}
						className={`traffic-input-v2__unit ${unit === "MB" ? "traffic-input-v2__unit--active" : ""}`}
						onClick={() => switchUnit("MB")}
					>MB</button>
					<button
						type="button"
						role="tab"
						aria-selected={unit === "GB"}
						className={`traffic-input-v2__unit ${unit === "GB" ? "traffic-input-v2__unit--active" : ""}`}
						onClick={() => switchUnit("GB")}
					>GB</button>
				</div>
			</div>

			<div className={fieldCls}>
				<button
					type="button"
					className="traffic-input-v2__step"
					onClick={stepDown}
					disabled={isAtFloor}
					aria-label="−"
				>
					<svg width="16" height="2" viewBox="0 0 16 2" fill="none"><path d="M1 1H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
				</button>
				<input
					type="text"
					inputMode="decimal"
					className="traffic-input-v2__value"
					value={draft}
					min={unit === "MB" ? MIN_MB : MIN_GB}
					onChange={e => setDraft(e.target.value)}
					onBlur={() => commit(draft)}
					onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
				/>
				<span className="traffic-input-v2__unit-label">{unit}</span>
				<button type="button" className="traffic-input-v2__step" onClick={stepUp} aria-label="+">
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1V15M1 8H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
				</button>
			</div>

			<div className="traffic-input-v2__hint">
				{unit === "MB" ? `Минимум ${MIN_MB} МБ` : `Минимум ${MIN_GB} ГБ`}
			</div>

			<div className="traffic-input-v2__presets">
				{PRESETS.map(p => (
					<button
						key={p.label}
						type="button"
						className={`traffic-input-v2__preset ${Math.abs(valueGb - p.valueGb) < 1e-6 ? "traffic-input-v2__preset--active" : ""}`}
						onClick={() => onChangeGb(p.valueGb)}
					>
						{p.label}
					</button>
				))}
			</div>

			{error && <span className="traffic-input-v2__error">{error}</span>}
		</div>
	)
}

export default TrafficInput
