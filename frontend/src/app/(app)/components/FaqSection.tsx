"use client"

import { useState } from "react"

import { t } from "@/shared/utils/i18n"
import type { SupportedLocale } from "@/shared/utils/i18n"

const COUNT = 6

const Arrow = () => (
	<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
		<path d="M4.5 11.5L11.5 4.5M11.5 4.5H5.5M11.5 4.5V10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

const eyebrow =
	"inline-flex w-max items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-[13px] font-semibold text-white/70 light:border-[#2f6bff]/25 light:bg-[#2f6bff]/10 light:text-[#2f6bff]"

export default function FaqSection({ locale }: { locale: SupportedLocale }) {
	const T = (key: string) => t(key, locale)
	const [open, setOpen] = useState(0)

	const items = Array.from({ length: COUNT }, (_, i) => ({
		q: T(`main.faq.items.q${i + 1}`),
		a: T(`main.faq.items.a${i + 1}`)
	}))

	return (
		<section className="mx-auto grid w-full max-w-[1180px] grid-cols-1 items-start gap-[clamp(32px,5vw,88px)] px-5 sm:px-6 md:px-10 lg:grid-cols-[0.82fr_1.18fr]">
			<div className="flex flex-col items-start gap-4 lg:sticky lg:top-[100px]">
				<span className={eyebrow}>
					<span className="inline-block h-2 w-2 rounded-full bg-gradient-to-br from-[#6aa5ff] to-[#34d3ee]" />
					{T("main.faq.eyebrow")}
				</span>
				<h2 className="font-[TalosDisplay] text-[clamp(32px,4.2vw,50px)] font-semibold leading-[1.06] tracking-[-0.03em] text-white light:text-[#0e1019]">{T("main.faq.title")}</h2>
				<p className="max-w-[380px] text-[16px] leading-[1.5] text-white/55 light:text-[#667085]">{T("main.faq.subtitle")}</p>
			</div>

			<div className="flex flex-col gap-[13px]">
				{items.map((it, i) => {
					const isOpen = open === i
					return (
						<div
							key={i}
							className={`rounded-[18px] border bg-gradient-to-b from-white/[0.04] to-white/[0.012] transition-all duration-200 light:bg-none light:bg-white ${
								isOpen
									? "border-[#6aa5ff]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_50px_-34px_rgba(59,130,246,0.5)] light:border-[#2f6bff]/40"
									: "border-white/[0.08] light:border-[#ececf1]"
							}`}
						>
							<button
								type="button"
								aria-expanded={isOpen}
								onClick={() => setOpen(isOpen ? -1 : i)}
								className="flex w-full items-center justify-between gap-4 px-[22px] py-[21px] text-left text-[16.5px] font-semibold text-white light:text-[#0e1019]"
							>
								<span>{it.q}</span>
								<span
									className={`flex h-[33px] w-[33px] shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
										isOpen
											? "rotate-90 border-[#2f6bff] bg-[#2f6bff] text-white shadow-[0_6px_16px_-6px_rgba(59,130,246,0.9)]"
											: "border-white/15 text-white/55 light:border-[#ececf1] light:text-[#667085]"
									}`}
								>
									<Arrow />
								</span>
							</button>
							<div className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-[360px] opacity-100" : "max-h-0 opacity-0"}`}>
								<p className="px-[22px] pb-[22px] pt-0.5 text-[15px] leading-[1.65] text-white/55 light:text-[#667085]">{it.a}</p>
							</div>
						</div>
					)
				})}
			</div>
		</section>
	)
}
