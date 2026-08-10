import type { FC } from "react"
import Image from "next/image"
import type { SupportedLocale } from "@/shared/utils/i18n"

type ProxyTypeCardProps = {
	isActive: boolean
	onSelect: () => void
	label: string
	description: string
	price: string
	icon?: string
	tier?: "standard" | "premium"
	comingSoon?: boolean
	locale?: SupportedLocale
}

const ProxyTypeCard: FC<ProxyTypeCardProps> = ({
	isActive,
	onSelect,
	label,
	description,
	price,
	icon,
	tier = "standard",
	comingSoon = false
}) => {
	const resolvedIcon =
		icon ?? (tier === "premium" ? "/tariff-premium.svg" : label.toLowerCase().includes("mobile") ? "/tariff-mobile-gb.svg" : "/tariff-resident.svg")
	const isPremium = tier === "premium"

	const cls = [
		"group relative flex w-full flex-col gap-3 overflow-hidden rounded-[16px] border p-5 text-left transition-all duration-200 hover:-translate-y-0.5",
		isActive
			? "border-[#6aa5ff]/55 bg-[#2f6bff]/[0.10] ring-1 ring-[#6aa5ff]/30 shadow-[0_24px_60px_-36px_rgba(47,107,255,0.9)] light:border-[#2f6bff]/45 light:bg-[#2f6bff]/[0.06] light:ring-[#2f6bff]/15 light:shadow-[0_22px_50px_-28px_rgba(47,107,255,0.35)]"
			: "border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.02] hover:border-white/20 hover:from-white/[0.08] hover:to-white/[0.03] light:border-[#e4e7ee] light:from-white light:to-white light:shadow-[0_14px_34px_-22px_rgba(14,16,25,0.20)] light:hover:border-[#cfd6e4] light:hover:from-[#f8fafc] light:hover:to-[#f8fafc]",
		comingSoon && "cursor-not-allowed opacity-55 hover:translate-y-0 hover:border-white/[0.08] light:hover:border-[#e4e7ee]"
	].filter(Boolean).join(" ")

	return (
		<button
			type="button"
			disabled={comingSoon}
			className={cls}
			onClick={() => { if (!comingSoon) onSelect() }}
			aria-pressed={isActive}
		>
			{/* soft accent glow on active */}
			{isActive && (
				<span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(106,165,255,0.35),transparent_70%)] blur-xl light:bg-[radial-gradient(circle,rgba(47,107,255,0.18),transparent_70%)]" />
			)}

			{isPremium && (
				<span className="absolute right-4 top-4 z-[1] rounded-full border border-[#6aa5ff]/30 bg-[#2f6bff]/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#6aa5ff] light:border-[#2f6bff]/30 light:bg-[#2f6bff]/[0.07] light:text-[#2f6bff]">PREMIUM</span>
			)}

			<div className="relative z-[1] flex items-center gap-3">
				{/* branded blue chip — white-stroke icons stay visible in BOTH themes */}
				<span className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[13px] bg-gradient-to-br from-[#5f9bff] to-[#2f6bff] shadow-[0_10px_22px_-10px_rgba(47,107,255,0.85)] ring-1 ring-inset ring-white/20">
					<Image src={resolvedIcon} alt="" width={22} height={22} />
					{isActive && (
						<span className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#2f6bff] text-white ring-[2.5px] ring-[#0e1830] light:ring-white">
							<svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
								<path d="M3 8L7 12L13 5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
							</svg>
						</span>
					)}
				</span>
				<h3 className="font-[TalosDisplay] text-white text-base font-semibold light:text-[#0e1019]">{label}</h3>
			</div>

			<p className="relative z-[1] text-white/60 text-sm leading-relaxed light:text-[#5b6472]">{description}</p>

			<div className="relative z-[1] mt-auto flex items-baseline gap-1 font-[TalosDisplay]">
				<span className={`text-lg font-bold ${comingSoon ? "text-white/45 light:text-[#8a93a3]" : "text-white light:text-[#0e1019]"}`}>{price}</span>
			</div>
		</button>
	)
}

export default ProxyTypeCard
