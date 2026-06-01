"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import type { FC } from "react"
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
		<div className="flex w-full min-w-0 max-w-full flex-col gap-6">
			<h1 className="text-body text-5xl font-semibold">Логи</h1>
			<nav className="border-body/25 bg-card/50 flex w-fit flex-row gap-2 rounded-xl border-2 p-1.5">
				<Link
					href="/admin/users"
					className="text-body flex w-60 cursor-pointer items-center justify-center rounded-md py-1 text-lg font-semibold"
				>
					Пользователи
				</Link>
				<Link
					href="/admin/stats"
					className="text-body flex w-60 cursor-pointer items-center justify-center rounded-md py-1 text-lg font-semibold"
				>
					Статистика
				</Link>
				<Link
					href="/admin/logs"
					className="text-body bg-primary flex w-60 cursor-pointer items-center justify-center rounded-md py-1 text-lg font-semibold"
				>
					Логи
				</Link>
				<Link
					href="/admin/settings"
					className="text-body flex w-60 cursor-pointer items-center justify-center rounded-md py-1 text-lg font-semibold"
				>
					Настройки
				</Link>
				<Link
					href="/admin/keys"
					className="text-body flex w-60 cursor-pointer items-center justify-center rounded-md py-1 text-lg font-semibold"
				>
					Ключи
				</Link>
				<Link
					href="/admin/servers"
					className="text-body flex w-60 cursor-pointer items-center justify-center rounded-md py-1 text-lg font-semibold"
				>
					Серверы
				</Link>
				<Link
					href="/admin/reviews"
					className="text-body flex w-60 cursor-pointer items-center justify-center rounded-md py-1 text-lg font-semibold"
				>
					Отзывы
				</Link>
			</nav>

			{/* Фильтры */}
			<div className="bg-card/25 flex w-full flex-col gap-4 rounded-xl p-4">
				<h2 className="text-body text-2xl font-semibold">Фильтры</h2>
				<div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
					<div>
						<label className="text-body mb-2 block text-sm font-medium">Тип лога</label>
						<select
							value={filters.type}
							onChange={(e) => handleFilterChange("type", e.target.value)}
							className="bg-card text-body w-full rounded-md border border-gray-600 px-3 py-2 transition-colors hover:border-[#0067FF] focus:border-[#0067FF] focus:outline-none"
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
						<label className="text-body mb-2 block text-sm font-medium">User ID</label>
						<input
							type="text"
							value={filters.userId}
							onChange={(e) => handleFilterChange("userId", e.target.value)}
							className="bg-card text-body w-full rounded-md border border-gray-600 px-3 py-2 transition-colors hover:border-[#0067FF] focus:border-[#0067FF] focus:outline-none"
							placeholder="ID пользователя"
						/>
					</div>
					<div>
						<label className="text-body mb-2 block text-sm font-medium">Email</label>
						<input
							type="email"
							value={filters.email}
							onChange={(e) => handleFilterChange("email", e.target.value)}
							className="bg-card text-body w-full rounded-md border border-gray-600 px-3 py-2 transition-colors hover:border-[#0067FF] focus:border-[#0067FF] focus:outline-none"
							placeholder="email@example.com"
						/>
					</div>
					<div>
						<label className="text-body mb-2 block text-sm font-medium">Начало периода</label>
						<input
							type="datetime-local"
							value={filters.startDate}
							onChange={(e) => handleFilterChange("startDate", e.target.value)}
							className="bg-card text-body w-full rounded-md border border-gray-600 px-3 py-2 transition-colors hover:border-[#0067FF] focus:border-[#0067FF] focus:outline-none"
						/>
					</div>
					<div>
						<label className="text-body mb-2 block text-sm font-medium">Конец периода</label>
						<input
							type="datetime-local"
							value={filters.endDate}
							onChange={(e) => handleFilterChange("endDate", e.target.value)}
							className="bg-card text-body w-full rounded-md border border-gray-600 px-3 py-2 transition-colors hover:border-[#0067FF] focus:border-[#0067FF] focus:outline-none"
						/>
					</div>
				</div>
			</div>

			{/* Таблица логов */}
			<div className="bg-card/25 w-full min-w-0 max-w-full overflow-x-auto rounded-xl p-4">
				{loading ? (
					<div className="text-body text-center py-8">Загрузка...</div>
				) : logs.length === 0 ? (
					<div className="text-body text-center py-8">Логи не найдены</div>
				) : (
					<>
						<table className="text-body w-max min-w-full border-collapse overflow-hidden rounded-xl text-left">
							<thead className="bg-card/50 text-lg">
								<tr>
									<th className="px-6 py-3">Дата</th>
									<th className="px-6 py-3">Тип</th>
									<th className="px-6 py-3">Пользователь</th>
									<th className="px-6 py-3">Сообщение</th>
									<th className="px-6 py-3">Детали</th>
								</tr>
							</thead>
							<tbody className="text-lg font-medium">
								{logs.map((log, i) => (
									<tr
										key={log.id}
										className={i % 2 === 0 ? "bg-transparent" : "bg-card/50"}
									>
										<td className="px-6 py-3">{formatDate(log.createdAt)}</td>
										<td className="px-6 py-3">{getLogTypeLabel(log.type)}</td>
										<td className="px-6 py-3">
											{log.user ? (
												<div>
													<div>{log.user.email}</div>
													<div className="text-sm text-gray-400">{log.userId}</div>
												</div>
											) : (
												log.userId || "-"
											)}
										</td>
										<td className="px-6 py-3 max-w-md truncate">{log.message}</td>
										<td className="px-6 py-3">
											<button
												onClick={() => handleLogClick(log.id)}
												className="text-primary hover:underline"
											>
												Подробнее
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>

						{/* Пагинация */}
						<div className="text-body mt-4 flex items-center justify-between">
							<div>
								Показано {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} из {pagination.total}
							</div>
							<div className="flex gap-2">
								<button
									onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
									disabled={pagination.page === 1}
									className="bg-card text-body rounded-md px-4 py-2 disabled:opacity-50"
								>
									Назад
								</button>
								<span className="px-4 py-2">
									Страница {pagination.page} из {pagination.totalPages}
								</span>
								<button
									onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
									disabled={pagination.page >= pagination.totalPages}
									className="bg-card text-body rounded-md px-4 py-2 disabled:opacity-50"
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
				<div className="bg-card/90 fixed inset-0 z-50 flex items-center justify-center p-4">
					<div className="bg-card text-body max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl p-6">
						<div className="mb-4 flex items-center justify-between">
							<h2 className="text-2xl font-semibold">Детали лога</h2>
							<button
								onClick={() => setSelectedLog(null)}
								className="text-body hover:text-gray-400"
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
									<pre className="bg-card/50 mt-2 overflow-auto rounded p-2 text-sm">
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

