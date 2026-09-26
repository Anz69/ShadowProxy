"use client"

import { ArrowRight, Check, PackageOpen, Sparkles } from "lucide-react"
import type { FC } from "react"

import type { Package } from "@/features/packages/types/packages.types"
import { formatPrice } from "@/shared/utils/format-price"
import { t } from "@/shared/utils/i18n"
import type { SupportedLocale } from "@/shared/utils/i18n"

type Props = {
	packages: Package[]
	selectedPackageId: string | null
	onSelect: (packageId: string) => void
	locale?: SupportedLocale
}

const bytesToGb = (value: string): number => {
	try {
		return Number(BigInt(value)) / 1024 ** 3
	} catch {
		return 0
	}
}

const formatTraffic = (value: string, locale: SupportedLocale): { amount: string; unit: string } => {
	const trafficGb = bytesToGb(value)
	if (trafficGb < 1) {
		return {
			amount: Math.max(1, Math.round(trafficGb * 1024)).toString(),
			unit: t("payment.units.mb", locale)
		}
	}

	const amount = Number.isInteger(trafficGb)
		? trafficGb.toString()
		: trafficGb.toFixed(2).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")

	return { amount, unit: t("payment.units.gb", locale) }
}

const PackagePresetSelector: FC<Props> = ({
	packages,
	selectedPackageId,
	onSelect,
	locale = "ru"
}) => {
	const T = (key: string) => t(key, locale)

	return (
		<section
			className="package-presets flex flex-col gap-4 rounded-[18px] border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5 light:border-[#e6e8ef] light:bg-[#f8fafc]"
			aria-labelledby="package-presets-title"
		>
			<div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
				<div className="flex min-w-0 items-start gap-3">
					<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#6aa5ff]/25 bg-[#2f6bff]/10 text-[#8db8ff] light:border-[#2f6bff]/20 light:bg-[#2f6bff]/[0.08] light:text-[#2f6bff]">
						<PackageOpen className="h-5 w-5" aria-hidden="true" />
					</span>
					<div className="min-w-0">
						<h3 id="package-presets-title" className="font-[TalosDisplay] text-base font-semibold text-white light:text-[#0e1019]">
							{T("payment.packagePresets.title")}
						</h3>
						<p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/50 light:text-[#667085]">
							{T("payment.packagePresets.subtitle")}
						</p>
					</div>
				</div>
				<span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-white/50 light:border-[#e2e4ea] light:bg-white light:text-[#667085]">
					<Sparkles className="h-3.5 w-3.5 text-[#6aa5ff] light:text-[#2f6bff]" aria-hidden="true" />
					{packages.length} {T("payment.packagePresets.available")}
				</span>
			</div>

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{packages.map(pkg => {
					const isSelected = pkg.id === selectedPackageId
					const traffic = formatTraffic(pkg.traffic, locale)
					const packagePrice = Number(pkg.price)
					const hasFixedPrice = Number.isFinite(packagePrice) && packagePrice > 0

					return (
						<button
							key={pkg.id}
							type="button"
							aria-pressed={isSelected}
							onClick={() => onSelect(pkg.id)}
							className={[
								"group relative flex min-h-[148px] flex-col overflow-hidden rounded-[16px] border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa5ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1830] light:focus-visible:ring-[#2f6bff] light:focus-visible:ring-offset-[#f8fafc]",
								isSelected
									? "border-[#6aa5ff]/70 bg-[#2f6bff]/[0.14] ring-1 ring-[#6aa5ff]/35 shadow-[0_20px_45px_-28px_rgba(47,107,255,0.95)] light:border-[#2f6bff]/55 light:bg-[#2f6bff]/[0.08] light:ring-[#2f6bff]/20"
									: "border-white/[0.08] bg-white/[0.025] hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.055] light:border-[#e2e4ea] light:bg-white light:hover:border-[#cbd5e1] light:hover:bg-[#f8fafc] light:hover:shadow-[0_16px_34px_-24px_rgba(14,16,25,0.35)]"
							].join(" ")}
						>
							{isSelected && (
								<span aria-hidden="true" className="pointer-events-none absolute -right-12 -top-14 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(106,165,255,0.36),transparent_70%)] blur-xl light:bg-[radial-gradient(circle,rgba(47,107,255,0.18),transparent_70%)]" />
							)}

							<div className="relative z-[1] flex items-start justify-between gap-3">
								<div>
									<p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45 light:text-[#667085]">
										{T("payment.packagePresets.traffic")}
									</p>
									<p className="mt-1 font-[TalosDisplay] text-2xl font-bold text-white light:text-[#0e1019]">
										{traffic.amount} <span className="text-base font-semibold text-white/55 light:text-[#667085]">{traffic.unit}</span>
									</p>
								</div>
								<span className={[
									"flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors",
									isSelected
										? "border-[#6aa5ff] bg-[#4f8dff] text-white light:border-[#2f6bff] light:bg-[#2f6bff]"
										: "border-white/15 bg-white/[0.04] text-transparent group-hover:border-white/30 light:border-[#d6dbe5] light:bg-[#f4f6fa]"
								].join(" ")}>
									<Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
								</span>
							</div>

							<div className="relative z-[1] mt-auto flex items-end justify-between gap-3 pt-5">
								<div className="min-w-0">
									<p className="font-[TalosDisplay] text-lg font-bold text-white light:text-[#0e1019]">
										{hasFixedPrice ? `${formatPrice(packagePrice)}$` : T("payment.packagePresets.tariffPrice")}
									</p>
									<p className="mt-0.5 truncate text-xs text-white/45 light:text-[#667085]">
										{hasFixedPrice ? T("payment.packagePresets.fixedPrice") : T("payment.packagePresets.tariffPrice")}
									</p>
								</div>
								<span className={[
									"inline-flex shrink-0 items-center gap-1 text-sm font-semibold transition-colors",
									isSelected ? "text-[#9cc3ff] light:text-[#2f6bff]" : "text-white/55 group-hover:text-white/85 light:text-[#667085] light:group-hover:text-[#2f6bff]"
								].join(" ")}>
									{isSelected ? T("payment.packagePresets.selected") : T("payment.packagePresets.choose")}
									<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
								</span>
							</div>
						</button>
					)
				})}
			</div>
		</section>
	)
}

export default PackagePresetSelector
