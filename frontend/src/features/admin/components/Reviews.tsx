"use client"

import { Star, Trash2 } from "lucide-react"
import { type FC, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"

import AdminNav from "@/features/admin/components/AdminNav"
import { reviewService } from "@/features/reviews/services/review.service"
import Loader from "@/shared/components/ui/Loader/Loader"
import MultiSelect from "@/shared/components/ui/MultiSelect"
import Select from "@/shared/components/ui/Select"

const Reviews: FC = () => {
	const qc = useQueryClient()
	const [ratings, setRatings] = useState<number[]>([])
	const [sort, setSort] = useState<"new" | "old">("new")
	const [q, setQ] = useState("")
	const [page, setPage] = useState(1)

	const { data: stats } = useQuery({
		queryKey: ["admin-review-stats"],
		queryFn: () => reviewService.adminStats()
	})
	const { data, isLoading } = useQuery({
		queryKey: ["admin-reviews", ratings, sort, q, page],
		queryFn: () =>
			reviewService.adminList({
				ratings: ratings.length ? ratings : undefined,
				sort,
				q: q || undefined,
				page
			})
	})
	const del = useMutation({
		mutationFn: (id: string) => reviewService.adminDelete(id),
		onSuccess: () => {
			toast.success("Отзыв удалён")
			qc.invalidateQueries({ queryKey: ["admin-reviews"] })
			qc.invalidateQueries({ queryKey: ["admin-review-stats"] })
		},
		onError: (e: Error) => toast.error(e.message)
	})

	return (
		<div className="relative z-[1] flex w-full flex-col gap-6">
			<h1 className="font-[TalosDisplay] text-4xl font-semibold text-white md:text-5xl">
				Отзывы
			</h1>
			<AdminNav active="/admin/reviews" />

			{/* Статистика */}
			<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
				<div className="rounded-[18px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#0a1020)] p-4 shadow-[0_24px_60px_-44px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)]">
					<div className="text-sm text-white/45">Всего отзывов</div>
					<div className="font-[TalosDisplay] text-3xl font-bold text-white">{stats?.total ?? 0}</div>
				</div>
				<div className="rounded-[18px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#0a1020)] p-4 shadow-[0_24px_60px_-44px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)]">
					<div className="text-sm text-white/45">Средняя оценка</div>
					<div className="font-[TalosDisplay] text-3xl font-bold text-white">{stats?.avg ?? 0}</div>
				</div>
				<div className="col-span-2 rounded-[18px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#0a1020)] p-4 shadow-[0_24px_60px_-44px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)]">
					<div className="mb-2 text-sm text-white/45">Распределение</div>
					<div className="flex flex-col gap-1">
						{[5, 4, 3, 2, 1].map((s) => {
							const count = stats?.distribution?.[String(s)] ?? 0
							const total = stats?.total || 1
							return (
								<div key={s} className="flex items-center gap-2 text-sm">
									<span className="w-4 text-white/60">{s}</span>
									<div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
										<div
											className="h-full rounded-full bg-gradient-to-r from-[#4f8dff] to-[#2f6bff]"
											style={{ width: `${(count / total) * 100}%` }}
										/>
									</div>
									<span className="w-8 text-right text-white/60">{count}</span>
								</div>
							)
						})}
					</div>
				</div>
			</div>

			{/* Фильтры */}
			<div className="flex flex-wrap items-center gap-3">
				<MultiSelect
					size="small"
					placeholder="Все оценки"
					value={ratings.map(String)}
					onChange={(v) => {
						setRatings(v.map(Number))
						setPage(1)
					}}
					options={[5, 4, 3, 2, 1].map((s) => ({
						value: String(s),
						label: `${s} звёзд`
					}))}
				/>
				<Select
					size="small"
					value={sort}
					onChange={(v) => {
						setSort(v as "new" | "old")
						setPage(1)
					}}
				>
					<Select.Option value="new">Сначала новые</Select.Option>
					<Select.Option value="old">Сначала старые</Select.Option>
				</Select>
				<input
					value={q}
					onChange={(e) => {
						setQ(e.target.value)
						setPage(1)
					}}
					placeholder="Поиск по email / тексту"
					className="min-w-[240px] flex-1 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-2 text-white outline-none transition-colors placeholder:text-white/40 focus:border-[#4f8dff]/60 focus:ring-2 focus:ring-[#4f8dff]/20"
				/>
			</div>

			{/* Список */}
			{isLoading ? (
				<div className="flex justify-center py-16">
					<Loader />
				</div>
			) : (
				<div className="flex flex-col gap-3">
					{(data?.items ?? []).map((r) => (
						<div
							key={r.id}
							className="flex items-start justify-between gap-4 rounded-[18px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#0a1020)] p-4 shadow-[0_24px_60px_-44px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)]"
						>
							<div className="min-w-0">
								<div className="flex items-center gap-3">
									<span className="font-medium text-white">
										{r.user?.tgLogin || r.user?.email}
									</span>
									<span className="flex gap-0.5">
										{[1, 2, 3, 4, 5].map((i) => (
											<Star
												key={i}
												className={`h-4 w-4 ${
													i <= r.rating
														? "fill-[#6aa5ff] text-[#6aa5ff]"
														: "text-white/20"
												}`}
											/>
										))}
									</span>
									<span className="text-xs text-white/30">
										{new Date(r.createdAt).toLocaleDateString()}
									</span>
								</div>
								<p className="mt-2 text-sm text-white/70">{r.text}</p>
							</div>
							<button
								type="button"
								onClick={() => del.mutate(r.id)}
								className="rounded-[10px] p-2 text-[#ff6b6b]/80 transition-colors hover:bg-[#ff6b6b]/10 hover:text-[#ff6b6b]"
								aria-label="Удалить"
							>
								<Trash2 className="h-5 w-5" />
							</button>
						</div>
					))}
					{(data?.items?.length ?? 0) === 0 && (
						<div className="py-12 text-center text-white/45">Отзывов нет</div>
					)}
				</div>
			)}

			{/* Пагинация */}
			{data && data.total > data.limit && (
				<div className="flex items-center gap-3">
					<button
						type="button"
						disabled={page <= 1}
						onClick={() => setPage((p) => p - 1)}
						className="rounded-[10px] border border-white/10 bg-white/[0.04] px-4 py-2 text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
					>
						Назад
					</button>
					<span className="text-white/60">
						{page} / {Math.ceil(data.total / data.limit)}
					</span>
					<button
						type="button"
						disabled={page >= Math.ceil(data.total / data.limit)}
						onClick={() => setPage((p) => p + 1)}
						className="rounded-[10px] border border-white/10 bg-white/[0.04] px-4 py-2 text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
					>
						Вперёд
					</button>
				</div>
			)}
		</div>
	)
}

export default Reviews
