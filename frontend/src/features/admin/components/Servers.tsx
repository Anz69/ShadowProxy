"use client"

import Link from "next/link"
import { type FC, useState, useEffect } from "react"
import toast from "react-hot-toast"
import { useProxyServers } from "../hooks/useProxyServers"
import { useCreateProxyServer } from "../hooks/useCreateProxyServer"
import { useDeleteProxyServer } from "../hooks/useDeleteProxyServer"
import { useToggleServerStatus } from "../hooks/useToggleServerStatus"
import { useGenerateServerToken } from "../hooks/useGenerateServerToken"
import ServerTokenModal from "./modals/ServerTokenModal"

import Loader from "@/shared/components/ui/Loader/Loader"
import Button from "@/shared/components/ui/Button"
import Input from "@/shared/components/ui/Input"
import Card from "@/shared/components/ui/Card"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"
import { Key } from "lucide-react"

const Servers: FC = () => {
	const { servers, isLoading, refetch } = useProxyServers()
	
	// Авто-обновление каждую минуту для мониторинга загрузки
	useEffect(() => {
		const interval = setInterval(() => {
			refetch()
		}, 60000) // 60 секунд

		return () => clearInterval(interval)
	}, [refetch])
	const { createServer, isLoading: isCreating } = useCreateProxyServer()
	const { deleteServer } = useDeleteProxyServer()
	const { toggleStatus } = useToggleServerStatus()
	const { generateToken, isPending: isGeneratingToken } = useGenerateServerToken()
	const { open } = useModalStore()

	const [showCreateForm, setShowCreateForm] = useState(false)
	const [serverTokens, setServerTokens] = useState<Record<string, string>>({})
	const [formData, setFormData] = useState({
		host: "",
	})

	const handleCreate = () => {
		createServer(formData, {
			onSuccess: () => {
				setShowCreateForm(false)
				setFormData({ host: "" })
			},
		})
	}

	const handleToggleStatus = (id: string) => {
		toggleStatus(id)
	}

	const handleDelete = (id: string, host: string) => {
		if (confirm(`Удалить сервер ${host}?`)) {
			deleteServer(id)
		}
	}

	const handleGenerateToken = (serverId: string, host: string) => {
		generateToken(serverId, {
			onSuccess: (data) => {
				const token = data.token
				setServerTokens(prev => ({ ...prev, [serverId]: token }))
				// Копируем токен в буфер обмена
				navigator.clipboard.writeText(token)
				// Показываем модалку с токеном
				open(<ServerTokenModal token={token} serverHost={data.serverId || host} />)
				toast.success("Токен сгенерирован и скопирован в буфер обмена")
			},
			onError: (error) => {
				toast.error(`Ошибка генерации токена: ${error.message}`)
			}
		})
	}

	if (isLoading)
		return (
			<div className="flex h-full w-full items-center justify-center">
				<Loader weight={5} size={80} />
			</div>
		)

	return (
		<div className="flex w-full flex-col gap-6">
			<h1 className="text-body text-5xl font-semibold">Серверы</h1>
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
				className="text-body flex w-60 cursor-pointer items-center justify-center rounded-md py-1 text-lg font-semibold"
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
					className="text-body bg-primary flex w-60 cursor-pointer items-center justify-center rounded-md py-1 text-lg font-semibold"
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

			<div className="flex justify-between items-center">
				<div>
					<h2 className="text-body text-2xl font-semibold">
						Всего серверов: {servers?.length || 0}
					</h2>
					<p className="text-body/50 text-sm mt-1">
						Статистика обновляется автоматически каждую минуту
					</p>
				</div>
				<Button
					variant="fill"
					type="button"
					onClick={() => setShowCreateForm(!showCreateForm)}
				>
					{showCreateForm ? "Отмена" : "Добавить сервер"}
				</Button>
			</div>

			{showCreateForm && (
				<Card className="p-6">
					<h3 className="text-body text-xl font-semibold mb-4">
						Создать новый сервер
					</h3>
					<div className="mb-4">
						<Input
							placeholder="IP адрес сервера"
							value={formData.host}
							onChange={(e) =>
								setFormData({ ...formData, host: e.target.value })
							}
						/>
					</div>
					<Button
						variant="fill"
						type="button"
						onClick={handleCreate}
						disabled={
							isCreating ||
							!formData.host
						}
					>
						{isCreating ? "Создание..." : "Создать"}
					</Button>
				</Card>
			)}

			<div className="grid grid-cols-1 gap-4">
				{servers?.map((server) => (
					<Card key={server.id} className="p-6">
						<div className="flex justify-between items-start">
							<div className="flex-1">
								<div className="flex items-center gap-4 mb-2">
									<h3 className="text-body text-xl font-semibold">
										{server.host}
									</h3>
									<span
										className={`px-3 py-1 rounded-full text-sm font-medium ${
											server.status === "ACTIVE"
												? "bg-green-500/20 text-green-500"
												: "bg-red-500/20 text-red-500"
										}`}
									>
										{server.status === "ACTIVE"
											? "Активен"
											: "Offline"}
									</span>
								</div>
								<div className="text-body/70 space-y-1">
									<p>
										<strong>IP:</strong> {server.host}
									</p>
									<p>
										<strong>Активных портов:</strong>{" "}
										<span className={server.currentLoad > 0 ? "text-green-500" : ""}>
											{server.currentLoad}
										</span>
									</p>
									<p className="text-body/50 text-sm">
										(обновляется каждую минуту)
									</p>
									<p>
										<strong>Создан:</strong>{" "}
										{new Date(server.createdAt).toLocaleString("ru")}
									</p>
								</div>
							</div>
							<div className="flex gap-2 flex-wrap">
								<Button
									variant={
										server.status === "ACTIVE"
											? "outline"
											: "fill"
									}
									type="button"
									onClick={() => handleToggleStatus(server.id)}
								>
									{server.status === "ACTIVE"
										? "Деактивировать"
										: "Активировать"}
								</Button>
								<Button
									variant="outline"
									type="button"
									onClick={() => handleGenerateToken(server.id, server.host)}
									disabled={isGeneratingToken}
								>
									<Key className="w-4 h-4 mr-2" />
									{serverTokens[server.id] ? "Перегенерировать токен" : "Сгенерировать токен"}
								</Button>
								<Button
									variant="error-outline"
									type="button"
									onClick={() =>
										handleDelete(server.id, server.host)
									}
									disabled={(server._count?.ports ?? server.currentLoad ?? 0) > 0}
								>
									Удалить
								</Button>
							</div>
						</div>
					</Card>
				))}
			</div>

			{!servers || servers.length === 0 ? (
				<Card className="p-6 text-center">
					<p className="text-body/50 text-lg">
						Серверов пока нет. Добавьте первый сервер.
					</p>
				</Card>
			) : null}
		</div>
	)
}

export default Servers

