"use client"

import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import { useEffect, useMemo, useState, type FC } from "react"

import AdminNav from "@/features/admin/components/AdminNav"
import UsersTable from "@/features/admin/components/UsersTable"
import { useGetAllUsers } from "@/features/user/hooks/useGetAllUsers"
import type { AdminUsersSortField } from "@/features/user/types/user.types"

import Loader from "@/shared/components/ui/Loader/Loader"

const PAGE_SIZE = 50

const SORT_OPTIONS: { value: AdminUsersSortField; label: string }[] = [
	{ value: "createdAt", label: "Дата регистрации" },
	{ value: "balance", label: "Баланс" },
	{ value: "premiumTrafficLeft", label: "Трафик: Residential" },
	{ value: "premiumResidentialTrafficLeft", label: "Трафик: Premium Res" },
	{ value: "ispUsaTrafficLeft", label: "Трафик: ISP USA" },
	{ value: "ispEuTrafficLeft", label: "Трафик: ISP EU" },
	{ value: "residentialLiteTrafficLeft", label: "Трафик: Res. Lite" },
	{ value: "mobileGbTrafficLeft", label: "Трафик: Mobile GB" },
	{ value: "mobileTrafficLeft", label: "Трафик: Mobile" },
	{ value: "ipv6GbTrafficLeft", label: "Трафик: IPv6" }
]

const inputCls =
	"h-10 rounded-xl border border-white/15 bg-white/[0.05] px-3 text-[14px] text-white placeholder:text-white/35 outline-none transition-colors focus:border-[#6aa5ff]/50"

const Dashboard: FC = () => {
	const [searchInput, setSearchInput] = useState("")
	const [search, setSearch] = useState("")
	const [page, setPage] = useState(1)
	const [sortBy, setSortBy] = useState<AdminUsersSortField>("createdAt")
	const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

	// Debounce поиска: не дёргаем бэк на каждый символ.
	useEffect(() => {
		const id = setTimeout(() => {
			setSearch(searchInput)
			setPage(1)
		}, 400)
		return () => clearTimeout(id)
	}, [searchInput])

	const params = useMemo(
		() => ({ page, limit: PAGE_SIZE, search: search || undefined, sortBy, sortDir }),
		[page, search, sortBy, sortDir]
	)
	const { users, total, isLoading, isFetching } = useGetAllUsers(params)

	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

	if (isLoading && !users)
		return (
			<div className="flex h-full w-full items-center justify-center">
				<Loader weight={5} size={80} />
			</div>
		)

	return (
		<div className="relative z-[1] flex w-full min-w-0 max-w-full flex-col gap-6">
			<h1 className="font-[TalosDisplay] text-4xl font-semibold text-white md:text-5xl">
				Пользователи
				<span className="ml-3 align-middle text-[15px] font-medium text-white/40">
					{total ? `${total} всего` : ""}
				</span>
			</h1>
			<AdminNav active="/admin/users" />

			{/* Тулбар: поиск + сортировка */}
			<div className="flex flex-wrap items-center gap-3">
				<div className="relative min-w-[260px] flex-1 md:max-w-[380px]">
					<Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/35" />
					<input
						className={`${inputCls} w-full pl-9`}
						placeholder="Поиск: email, ID, telegram"
						value={searchInput}
						onChange={e => setSearchInput(e.target.value)}
					/>
				</div>
				<select
					className={`${inputCls} cursor-pointer [&>option]:bg-[#0e1830]`}
					value={sortBy}
					onChange={e => {
						setSortBy(e.target.value as AdminUsersSortField)
						setPage(1)
					}}
				>
					{SORT_OPTIONS.map(o => (
						<option key={o.value} value={o.value}>
							{o.label}
						</option>
					))}
				</select>
				<button
					type="button"
					className={`${inputCls} cursor-pointer px-4 hover:bg-white/10`}
					title="Направление сортировки"
					onClick={() => {
						setSortDir(d => (d === "desc" ? "asc" : "desc"))
						setPage(1)
					}}
				>
					{sortDir === "desc" ? "По убыванию ↓" : "По возрастанию ↑"}
				</button>
				{isFetching && <Loader weight={3} size={22} />}
			</div>

			<UsersTable users={users ?? []} />

			{/* Пагинация */}
			<div className="flex items-center justify-between gap-3">
				<button
					type="button"
					disabled={page <= 1}
					onClick={() => setPage(p => Math.max(1, p - 1))}
					className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
					aria-label="prev page"
				>
					<ChevronLeft className="h-5 w-5" />
				</button>
				<span className="text-[14px] text-white/60">
					Страница {page} из {totalPages}
				</span>
				<button
					type="button"
					disabled={page >= totalPages}
					onClick={() => setPage(p => Math.min(totalPages, p + 1))}
					className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
					aria-label="next page"
				>
					<ChevronRight className="h-5 w-5" />
				</button>
			</div>
		</div>
	)
}

export default Dashboard
