"use client"

import { Check, Sparkles, Star } from "lucide-react"
import { usePathname } from "next/navigation"
import { type FC, useState } from "react"
import toast from "react-hot-toast"

import { useCreateReview, useMyReview } from "@/features/reviews/hooks/useReview"
import Loader from "@/shared/components/ui/Loader/Loader"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"
import { getLocaleFromPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"

const STARS = [1, 2, 3, 4, 5]

const ReviewModal: FC = () => {
	const pathname = usePathname()
	const locale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, locale)
	const { close } = useModalStore()

	const { data: mine, isLoading } = useMyReview()
	const { mutate: createReview, isPending } = useCreateReview()

	const [rating, setRating] = useState(0)
	const [hover, setHover] = useState(0)
	const [text, setText] = useState("")

	if (isLoading) {
		return (
			<div className="flex w-full justify-center py-20 sm:min-w-[440px]">
				<Loader />
			</div>
		)
	}

	if (mine?.hasReview && mine.review) {
		return (
			<div className="flex w-full flex-col items-center gap-5 py-3 text-center sm:min-w-[440px]">
				<span
					className="flex h-14 w-14 items-center justify-center rounded-2xl"
					style={{
						background:
							"linear-gradient(135deg, rgba(0,103,255,0.35), rgba(58,95,253,0.12))",
						boxShadow: "0 8px 28px -6px rgba(0,103,255,0.55)"
					}}
				>
					<Star className="h-7 w-7 fill-white text-white" />
				</span>
				<h2 className="text-body text-2xl font-semibold">
					{T("reviews.thanksTitle")}
				</h2>
				<div className="flex gap-1.5">
					{STARS.map((i) => (
						<Star
							key={i}
							className={`h-6 w-6 ${
								i <= mine.review!.rating
									? "fill-[#0067FF] text-[#0067FF]"
									: "text-body/15"
							}`}
							style={
								i <= mine.review!.rating
									? { filter: "drop-shadow(0 0 6px rgba(0,103,255,0.55))" }
									: undefined
							}
						/>
					))}
				</div>
				<p className="text-body/55 max-w-sm text-sm leading-relaxed">
					{mine.review.text}
				</p>
				<button
					type="button"
					onClick={close}
					className="text-body/75 hover:text-body mt-1 cursor-pointer rounded-xl border border-white/12 px-7 py-2.5 text-sm font-medium transition-colors duration-200 hover:bg-white/[0.06]"
				>
					{T("reviews.close")}
				</button>
			</div>
		)
	}

	const active = hover || rating
	const len = text.trim().length
	const ready = rating >= 1 && len >= 20

	const onSubmit = () => {
		if (rating < 1) {
			toast.error(T("reviews.errorNoRating"))
			return
		}
		if (len < 20) {
			toast.error(T("reviews.errorShort"))
			return
		}
		createReview(
			{ rating, text: text.trim() },
			{
				onSuccess: () => {
					toast.success(T("reviews.submitted"))
					close()
				},
				onError: (e: Error) => toast.error(e.message)
			}
		)
	}

	return (
		<div className="flex w-full flex-col gap-5 sm:min-w-[420px] sm:gap-6">
			<div className="flex flex-col items-center gap-3 pr-6 text-center">
				<h2 className="text-body text-2xl leading-tight font-semibold sm:text-[27px]">
					{T("reviews.formTitle")}
				</h2>
				<span
					className="text-body/85 flex w-full items-start gap-2 rounded-2xl px-3.5 py-2.5 text-left text-[13px] leading-snug font-medium sm:w-auto sm:items-center sm:rounded-full sm:px-4 sm:py-1.5 sm:text-center"
					style={{
						background:
							"linear-gradient(135deg, rgba(0,103,255,0.22), rgba(58,95,253,0.08))",
						border: "1px solid rgba(0,103,255,0.35)",
						boxShadow: "0 6px 22px -10px rgba(0,103,255,0.55)"
					}}
				>
					<Sparkles className="mt-[1px] h-4 w-4 shrink-0 text-[#4d8bff] sm:mt-0" />
					<span>{T("reviews.formSubtitle")}</span>
				</span>
			</div>

			<div className="flex flex-col items-center gap-3 py-3">
				<div className="flex gap-3">
					{STARS.map((i) => {
						const on = i <= active
						return (
							<button
								key={i}
								type="button"
								onMouseEnter={() => setHover(i)}
								onMouseLeave={() => setHover(0)}
								onClick={() => setRating(i)}
								className="cursor-pointer transition-transform duration-150 hover:scale-110 active:scale-90"
								aria-label={`${i}`}
							>
								<Star
									className={`h-10 w-10 transition-colors duration-150 ${
										on
											? "fill-[#0067FF] text-[#0067FF]"
											: "text-body/15 hover:text-body/35"
									}`}
									style={
										on
											? {
													filter:
														"drop-shadow(0 0 9px rgba(0,103,255,0.6))"
												}
											: undefined
									}
								/>
							</button>
						)
					})}
				</div>
				<span className="text-body/40 text-xs font-medium tracking-wide">
					{T("reviews.ratingLabel")}
				</span>
			</div>

			<div className="flex flex-col gap-2">
				<span className="text-body/55 text-sm font-medium">
					{T("reviews.textLabel")}
				</span>
				<textarea
					value={text}
					onChange={(e) => setText(e.target.value)}
					rows={4}
					maxLength={2000}
					placeholder={T("reviews.textPlaceholder")}
					className="text-body placeholder:text-body/25 w-full resize-none rounded-xl px-4 py-3 text-sm leading-relaxed outline-none transition-colors"
					style={{
						background: "rgba(255,255,255,0.035)",
						border: "1px solid rgba(255,255,255,0.10)"
					}}
					onFocus={(e) =>
						(e.currentTarget.style.borderColor = "rgba(0,103,255,0.7)")
					}
					onBlur={(e) =>
						(e.currentTarget.style.borderColor =
							"rgba(255,255,255,0.10)")
					}
				/>
				<div className="flex h-5 items-center text-xs">
					{len >= 20 ? (
						<span
							key="ok"
							className="text-success inline-flex items-center gap-1.5 font-medium"
							style={{
								animation:
									"notif-pop .26s cubic-bezier(.16,1,.3,1) both"
							}}
						>
							<span className="bg-success/15 flex h-5 w-5 items-center justify-center rounded-full">
								<Check className="h-3.5 w-3.5" strokeWidth={3} />
							</span>
							{T("reviews.minOk")}
						</span>
					) : (
						<span key="count" className="text-body/30">
							{len}/20 {T("reviews.minChars")}
						</span>
					)}
				</div>
			</div>

			<button
				type="button"
				onClick={onSubmit}
				disabled={isPending}
				className="relative flex h-12 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl text-base font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
				style={{
					background:
						"linear-gradient(135deg, #0067FF 0%, #3a5ffd 100%)",
					boxShadow: ready
						? "0 12px 34px -10px rgba(0,103,255,0.7), 0 0 0 1px rgba(255,255,255,0.08) inset"
						: "0 8px 24px -12px rgba(0,103,255,0.45), 0 0 0 1px rgba(255,255,255,0.06) inset"
				}}
			>
				{isPending ? <Loader /> : T("reviews.submit")}
			</button>
		</div>
	)
}

export default ReviewModal
