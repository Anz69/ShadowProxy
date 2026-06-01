"use client"

import Link from "next/link"
import { Star, Trash2 } from "lucide-react"
import { type FC, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"

import { reviewService } from "@/features/reviews/services/review.service"
import Loader from "@/shared/components/ui/Loader/Loader"
import MultiSelect from "@/shared/components/ui/MultiSelect"
import Select from "@/shared/components/ui/Select"

const navLink =
	"text-body flex w-60 cursor-pointer items-center justify-center rounded-md py-1 text-lg font-semibold"

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
		<div className="flex w-full flex-col gap-6">
			<h1 className="text-body text-5xl font-semibold">Отзывы</h1>
			<nav className="border-body/25 bg-card/50 flex w-fit flex-row flex-wrap gap-2 rounded-xl border-2 p-1.5">
				<Link href="/admin/users" className={navLink}>Пользователи</Link>
				<Link href="/admin/stats" className={navLink}>Статистика</Link>
				<Link href="/admin/logs" className={navLink}>Логи</Link>
				<Link href="/admin/settings" className={navLink}>Настройки</Link>
				<Link href="/admin/keys" className={navLink}>Ключи</Link>
				<Link href="/admin/servers" className={navLink}>Серверы</Link>
				<Link href="/admin/reviews" className={`${navLink} bg-primary`}>Отзывы</Link>
			</nav>

			{/* Статистика */}
			<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
				<div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
					<div className="text-body/40 text-sm">Всего отзывов</div>
					<div className="text-body text-3xl font-bold">{stats?.total ?? 0}</div>
				</div>
				<div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
					<div className="text-body/40 text-sm">Средняя оценка</div>
					<div className="text-body text-3xl font-bold">{stats?.avg ?? 0}</div>
				</div>
				<div className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
					<div className="text-body/40 mb-2 text-sm">Распределение</div>
					<div className="flex flex-col gap-1">
						{[5, 4, 3, 2, 1].map((s) => {
							const count = stats?.distribution?.[String(s)] ?? 0
							const total = stats?.total || 1
							return (
								<div key={s} className="flex items-center gap-2 text-sm">
									<span className="text-body/60 w-4">{s}</span>
									<div className="bg-white/10 h-2 flex-1 overflow-hidden rounded">
										<div
											className="h-full bg-[#0067FF]"
											style={{ width: `${(count / total) * 100}%` }}
										/>
									</div>
									<span className="text-body/60 w-8 text-right">{count}</span>
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
					className="min-w-[240px] flex-1 rounded-lg border border-white/15 bg-card px-3 py-2 text-white outline-none focus:border-[#0067FF]"
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
							className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4"
						>
							<div className="min-w-0">
								<div className="flex items-center gap-3">
									<span className="text-body font-medium">
										{r.user?.tgLogin || r.user?.email}
									</span>
									<span className="flex gap-0.5">
										{[1, 2, 3, 4, 5].map((i) => (
											<Star
												key={i}
												className={`h-4 w-4 ${
													i <= r.rating
														? "fill-[#0067FF] text-[#0067FF]"
														: "text-white/20"
												}`}
											/>
										))}
									</span>
									<span className="text-body/30 text-xs">
										{new Date(r.createdAt).toLocaleDateString()}
									</span>
								</div>
								<p className="text-body/70 mt-2 text-sm">{r.text}</p>
							</div>
							<button
								type="button"
								onClick={() => del.mutate(r.id)}
								className="text-error/80 hover:text-error rounded-lg p-2 transition-colors hover:bg-white/5"
								aria-label="Удалить"
							>
								<Trash2 className="h-5 w-5" />
							</button>
						</div>
					))}
					{(data?.items?.length ?? 0) === 0 && (
						<div className="text-body/40 py-12 text-center">Отзывов нет</div>
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
						className="rounded-lg border border-white/15 px-4 py-2 text-white disabled:opacity-40"
					>
						Назад
					</button>
					<span className="text-body/60">
						{page} / {Math.ceil(data.total / data.limit)}
					</span>
					<button
						type="button"
						disabled={page >= Math.ceil(data.total / data.limit)}
						onClick={() => setPage((p) => p + 1)}
						className="rounded-lg border border-white/15 px-4 py-2 text-white disabled:opacity-40"
					>
						Вперёд
					</button>
				</div>
			)}
		</div>
	)
}

export default Reviews
