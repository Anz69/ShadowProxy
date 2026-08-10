"use client"

import { useState, useEffect } from "react"
import type { FC } from "react"

import AdminNav from "@/features/admin/components/AdminNav"
// Определяем LogType локально (копия из prisma schema)
type LogType = "USAGE" | "REPLENISH" | "SYSTEM" | "TRAFFIC" | "USER_ACTION" | "API"

type Log = {
	id: string
	type: LogType
	message: string
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	metadata?: Record<string, any>
	userId?: string | null
	createdAt: string
	user?: {
		id: string
		email: string
		name?: string | null
	} | null
}

type LogsResponse = {
	logs: Log[]
	total: number
	page: number
	limit: number
	totalPages: number
}

const Logs: FC = () => {
	const [logs, setLogs] = useState<Log[]>([])
	const [loading, setLoading] = useState(true)
	const [selectedLog, setSelectedLog] = useState<Log | null>(null)
	const [filters, setFilters] = useState({
		type: "" as LogType | "",
		userId: "",
		email: "",
		startDate: "",
		endDate: "",
		page: 1,
		limit: 50,
	})
	const [pagination, setPagination] = useState({
		total: 0,
		page: 1,
		limit: 50,
		totalPages: 0,
	})

		const fetchLogs = async () => {
		setLoading(true)
		try {
			const params = new URLSearchParams()
			if (filters.type) params.append("type", filters.type)
			if (filters.userId) params.append("userId", filters.userId)
			if (filters.email) params.append("email", filters.email)
			if (filters.startDate) params.append("startDate", filters.startDate)
			if (filters.endDate) params.append("endDate", filters.endDate)
			params.append("page", filters.page.toString())
			params.append("limit", filters.limit.toString())

			let backendUrl = process.env.NEXT_PUBLIC_BACKEND_URI || "http://localhost:8080"
			// Убираем /api из конца, если он есть, так как бэкенд сам добавляет префикс
			if (backendUrl.endsWith("/api")) {
				backendUrl = backendUrl.slice(0, -4)
			}
			const response = await fetch(`${backendUrl}/api/admin/logs?${params.toString()}`, {
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
				},
			})
			const data: LogsResponse = await response.json()
			setLogs(data.logs)
			setPagination({
				total: data.total,
				page: data.page,
				limit: data.limit,
				totalPages: data.totalPages,
			})
		} catch (error) {
			console.error("Ошибка загрузки логов:", error)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		fetchLogs()
	}, [filters.page, filters.type, filters.userId, filters.email, filters.startDate, filters.endDate])

	const handleFilterChange = (key: string, value: string) => {
		setFilters(prev => ({ ...prev, [key]: value, page: 1 }))
	}

	const handleLogClick = async (logId: string) => {
		try {
			let backendUrl = process.env.NEXT_PUBLIC_BACKEND_URI || "http://localhost:8080"
			// Убираем /api из конца, если он есть, так как бэкенд сам добавляет префикс
			if (backendUrl.endsWith("/api")) {
				backendUrl = backendUrl.slice(0, -4)
			}
			const response = await fetch(`${backendUrl}/api/admin/logs/${logId}`, {
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
				},
			})
			const log: Log = await response.json()
			setSelectedLog(log)
		} catch (error) {
			console.error("Ошибка загрузки деталей лога:", error)
		}
	}

	const getLogTypeLabel = (type: LogType) => {
		const labels: Record<LogType, string> = {
			USAGE: "Использование",
			REPLENISH: "Пополнение",
			SYSTEM: "Система",
			TRAFFIC: "Трафик",
			USER_ACTION: "Действие пользователя",
			API: "API",
		}
		return labels[type] || type
	}

	const formatDate = (date: string) => {
		// Используем фиксированное форматирование для избежания проблем с гидратацией
		const d = new Date(date)
		const year = d.getFullYear()
		const month = String(d.getMonth() + 1).padStart(2, "0")
		const day = String(d.getDate()).padStart(2, "0")
		const hours = String(d.getHours()).padStart(2, "0")
		const minutes = String(d.getMinutes()).padStart(2, "0")
		const seconds = String(d.getSeconds()).padStart(2, "0")
		return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`
	}

	return (
		<div className="relative z-[1] flex w-full min-w-0 max-w-full flex-col gap-6">
			<h1 className="font-[TalosDisplay] text-4xl font-semibold text-white md:text-5xl">
				Логи
			</h1>
			<AdminNav active="/admin/logs" />

			{/* Фильтры */}
			<div className="flex w-full flex-col gap-4 rounded-[18px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#0a1020)] p-4 shadow-[0_24px_60px_-44px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)]">
				<h2 className="font-[TalosDisplay] text-2xl font-semibold text-white">Фильтры</h2>
				<div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
					<div>
						<label className="mb-2 block text-sm font-medium text-white/60">Тип лога</label>
						<select
							value={filters.type}
							onChange={(e) => handleFilterChange("type", e.target.value)}
							className="w-full rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-2 text-white transition-colors focus:border-[#4f8dff]/60 focus:outline-none focus:ring-2 focus:ring-[#4f8dff]/20"
						>
							<option value="">Все типы</option>
							<option value="TRAFFIC">Трафик</option>
							<option value="USER_ACTION">Действия пользователя</option>
							<option value="API">API</option>
							<option value="USAGE">Использование</option>
							<option value="REPLENISH">Пополнение</option>
							<option value="SYSTEM">Система</option>
						</select>
					</div>
					<div>
						<label className="mb-2 block text-sm font-medium text-white/60">User ID</label>
						<input
							type="text"
							value={filters.userId}
							onChange={(e) => handleFilterChange("userId", e.target.value)}
							className="w-full rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-2 text-white transition-colors placeholder:text-white/40 focus:border-[#4f8dff]/60 focus:outline-none focus:ring-2 focus:ring-[#4f8dff]/20"
							placeholder="ID пользователя"
						/>
					</div>
					<div>
						<label className="mb-2 block text-sm font-medium text-white/60">Email</label>
						<input
							type="email"
							value={filters.email}
							onChange={(e) => handleFilterChange("email", e.target.value)}
							className="w-full rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-2 text-white transition-colors placeholder:text-white/40 focus:border-[#4f8dff]/60 focus:outline-none focus:ring-2 focus:ring-[#4f8dff]/20"
							placeholder="email@example.com"
						/>
					</div>
					<div>
						<label className="mb-2 block text-sm font-medium text-white/60">Начало периода</label>
						<input
							type="datetime-local"
							value={filters.startDate}
							onChange={(e) => handleFilterChange("startDate", e.target.value)}
							className="w-full rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-2 text-white transition-colors [color-scheme:dark] focus:border-[#4f8dff]/60 focus:outline-none focus:ring-2 focus:ring-[#4f8dff]/20"
						/>
					</div>
					<div>
						<label className="mb-2 block text-sm font-medium text-white/60">Конец периода</label>
						<input
							type="datetime-local"
							value={filters.endDate}
							onChange={(e) => handleFilterChange("endDate", e.target.value)}
							className="w-full rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-2 text-white transition-colors [color-scheme:dark] focus:border-[#4f8dff]/60 focus:outline-none focus:ring-2 focus:ring-[#4f8dff]/20"
						/>
					</div>
				</div>
			</div>

			{/* Таблица логов */}
			<div className="w-full min-w-0 max-w-full overflow-x-auto rounded-[18px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#0a1020)] p-4 shadow-[0_24px_60px_-44px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)]">
				{loading ? (
					<div className="py-8 text-center text-white/60">Загрузка...</div>
				) : logs.length === 0 ? (
					<div className="py-8 text-center text-white/60">Логи не найдены</div>
				) : (
					<>
						<table className="w-max min-w-full border-collapse text-left">
							<thead>
								<tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-[0.06em] text-white/35">
									<th className="px-6 py-3 font-medium">Дата</th>
									<th className="px-6 py-3 font-medium">Тип</th>
									<th className="px-6 py-3 font-medium">Пользователь</th>
									<th className="px-6 py-3 font-medium">Сообщение</th>
									<th className="px-6 py-3 font-medium">Детали</th>
								</tr>
							</thead>
							<tbody className="text-[13px] text-white/75">
								{logs.map((log) => (
									<tr
										key={log.id}
										className="border-b border-white/[0.05] transition-colors hover:bg-white/[0.03]"
									>
										<td className="whitespace-nowrap px-6 py-3">{formatDate(log.createdAt)}</td>
										<td className="px-6 py-3">{getLogTypeLabel(log.type)}</td>
										<td className="px-6 py-3">
											{log.user ? (
												<div>
													<div className="text-white">{log.user.email}</div>
													<div className="text-xs text-white/40">{log.userId}</div>
												</div>
											) : (
												log.userId || "-"
											)}
										</td>
										<td className="max-w-md truncate px-6 py-3">{log.message}</td>
										<td className="px-6 py-3">
											<button
												onClick={() => handleLogClick(log.id)}
												className="font-medium text-[#6aa5ff] hover:underline"
											>
												Подробнее
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>

						{/* Пагинация */}
						<div className="mt-4 flex items-center justify-between text-white/70">
							<div>
								Показано {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} из {pagination.total}
							</div>
							<div className="flex items-center gap-2">
								<button
									onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
									disabled={pagination.page === 1}
									className="rounded-[10px] border border-white/10 bg-white/[0.04] px-4 py-2 text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
								>
									Назад
								</button>
								<span className="px-4 py-2">
									Страница {pagination.page} из {pagination.totalPages}
								</span>
								<button
									onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
									disabled={pagination.page >= pagination.totalPages}
									className="rounded-[10px] border border-white/10 bg-white/[0.04] px-4 py-2 text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
								>
									Вперед
								</button>
							</div>
						</div>
					</>
				)}
			</div>

			{/* Модальное окно с деталями лога */}
			{selectedLog && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060d1e]/80 p-4 backdrop-blur-md">
					<div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[18px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#0a1020)] p-6 text-white/80 shadow-[0_40px_90px_-40px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]">
						<div className="mb-4 flex items-center justify-between">
							<h2 className="font-[TalosDisplay] text-2xl font-semibold text-white">Детали лога</h2>
							<button
								onClick={() => setSelectedLog(null)}
								className="text-white/50 transition-colors hover:text-white"
							>
								✕
							</button>
						</div>
						<div className="space-y-4">
							<div>
								<strong>ID:</strong> {selectedLog.id}
							</div>
							<div>
								<strong>Тип:</strong> {getLogTypeLabel(selectedLog.type)}
							</div>
							<div>
								<strong>Дата:</strong> {formatDate(selectedLog.createdAt)}
							</div>
							{selectedLog.user && (
								<div>
									<strong>Пользователь:</strong> {selectedLog.user.email} ({selectedLog.userId})
								</div>
							)}
							<div>
								<strong>Сообщение:</strong> {selectedLog.message}
							</div>
							{selectedLog.metadata && (
								<div>
									<strong>Детали:</strong>
									<pre className="mt-2 overflow-auto rounded-[10px] border border-white/[0.06] bg-black/30 p-3 text-sm text-white/80">
										{JSON.stringify(selectedLog.metadata, null, 2)}
									</pre>
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

export default Logs

