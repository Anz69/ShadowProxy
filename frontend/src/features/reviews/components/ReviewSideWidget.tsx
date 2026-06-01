"use client"

import { Sparkles, X } from "lucide-react"
import { usePathname } from "next/navigation"
import { type FC, useEffect, useState } from "react"

import ReviewModal from "@/features/reviews/components/ReviewModal"
import { useMyReview } from "@/features/reviews/hooks/useReview"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"
import { getLocaleFromPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"

const ReviewSideWidget: FC = () => {
	const pathname = usePathname()
	const locale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, locale)
	const { open } = useModalStore()

	const { data: mine } = useMyReview()
	const [closed, setClosed] = useState(false)
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		const id = setTimeout(() => setMounted(true), 60)
		return () => clearTimeout(id)
	}, [])

	const canLeave =
		!!mine?.eligible && !mine?.hasReview && !mine?.reviewDiscountGranted

	// Закрытие — только на текущую сессию страницы: пока отзыв не оставлен,
	// при перезагрузке виджет появится снова (намеренно, по требованию).
	if (!canLeave || closed) return null

	return (
		<div
			className={`fixed bottom-24 left-4 z-[60] transition-all duration-500 ease-out ${
				mounted
					? "translate-x-0 opacity-100"
					: "-translate-x-6 opacity-0"
			}`}
		>
			<div
				role="button"
				tabIndex={0}
				onClick={() => open(<ReviewModal />)}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") open(<ReviewModal />)
				}}
				className="group relative flex w-[124px] cursor-pointer flex-col items-center gap-3 rounded-2xl px-4 pt-9 pb-5 transition-[filter,transform] duration-200 hover:scale-[1.03] hover:brightness-110"
				style={{
					background:
						"linear-gradient(155deg, #0067FF 0%, #3a5ffd 100%)",
					border: "1px solid rgba(255,255,255,0.16)",
					boxShadow:
						"0 14px 38px -12px rgba(0,103,255,0.7), 0 0 0 1px rgba(255,255,255,0.05) inset"
				}}
				aria-label={`${T("dashboard.reviewBanner.cta")} −30%`}
			>
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation()
						setClosed(true)
					}}
					aria-label="close"
					className="absolute top-2.5 right-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-white/80 transition-colors duration-200 hover:bg-white/25 hover:text-white"
				>
					<X className="h-3.5 w-3.5" strokeWidth={2.5} />
				</button>

				<Sparkles className="h-7 w-7 shrink-0 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.55)]" />

				<span className="text-[22px] leading-none font-extrabold text-white">
					−30%
				</span>

				<span className="text-center text-[13px] leading-snug font-semibold whitespace-pre-line text-white/90">
					{T("reviews.widgetPhrase")}
				</span>
			</div>
		</div>
	)
}

export default ReviewSideWidget
