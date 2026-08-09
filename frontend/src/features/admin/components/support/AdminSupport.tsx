"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, ChevronLeft, ChevronRight, Paperclip, Search, Send, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import toast from "react-hot-toast"

import AdminNav from "@/features/admin/components/AdminNav"
import QuickActions from "@/features/admin/components/support/QuickActions"
import { adminSupportService, type AdminTicketFilter } from "@/features/support/services/admin-support.service"
import { supportFileUrl, type SupportAttachment, type SupportMessage, type SupportTicketStatus } from "@/features/support/types/support.types"

import Loader from "@/shared/components/ui/Loader/Loader"
import { formatDate } from "@/shared/utils/format-date"

const PAGE_SIZE = 30

const STATUS_META: Record<SupportTicketStatus, { label: string; cls: string }> = {
	NEW: { label: "Новое", cls: "bg-[#ffd964]/15 text-[#ffd964]" },
	IN_PROGRESS: { label: "В работе", cls: "bg-[#6aa5ff]/15 text-[#6aa5ff]" },
	ANSWERED: { label: "Отвечено", cls: "bg-[#4ade80]/15 text-[#4ade80]" },
	CLOSED: { label: "Закрыто", cls: "bg-white/10 text-white/50" }
}
const STATUS_FILTERS: { value: SupportTicketStatus | ""; label: string }[] = [
	{ value: "", label: "Все" },
	{ value: "NEW", label: "Новые" },
	{ value: "IN_PROGRESS", label: "В работе" },
	{ value: "ANSWERED", label: "Отвечено" },
	{ value: "CLOSED", label: "Закрыто" }
]

const inputCls =
	"h-10 rounded-xl border border-white/15 bg-white/[0.05] px-3 text-[14px] text-white placeholder:text-white/35 outline-none transition-colors focus:border-[#6aa5ff]/50"

const fmtTime = (iso: string) => {
	const d = new Date(iso)
	return `${d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })} ${d
		.getHours()
		.toString()
		.padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`
}

const AttachmentView = ({ att }: { att: SupportAttachment }) => {
	const url = supportFileUrl(att.url)
	if (att.mime.startsWith("image/"))
		return (
			<a href={url} target="_blank" rel="noopener noreferrer">
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img src={url} alt={att.name} className="max-h-[200px] max-w-full rounded-lg border border-white/10" />
			</a>
		)
	if (att.mime.startsWith("video/"))
		return <video src={url} controls preload="metadata" className="max-h-[240px] max-w-full rounded-lg border border-white/10" />
	return (
		<a href={url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#6aa5ff] underline">
			{att.name}
		</a>
	)
}

const Bubble = ({ msg }: { msg: SupportMessage }) => {
	const isAdmin = msg.authorRole === "ADMIN"
	return (
		<div className={`flex w-full ${isAdmin ? "justify-end" : "justify-start"}`}>
			<div
				className={`flex max-w-[80%] flex-col gap-2 rounded-[14px] px-4 py-2.5 ${
					isAdmin ? "rounded-br-[4px] bg-gradient-to-b from-[#4f8dff] to-[#2f6bff] text-white" : "rounded-bl-[4px] border border-white/[0.08] bg-white/[0.05] text-white"
				}`}
			>
				<span className={`text-[10px] font-semibold uppercase tracking-[0.06em] ${isAdmin ? "text-white/70" : "text-[#6aa5ff]"}`}>
					{isAdmin ? "Поддержка" : "Клиент"}
				</span>
				{msg.text && <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>}
				{msg.attachments?.map((a, i) => <AttachmentView key={i} att={a} />)}
				<span className={`text-[10px] ${isAdmin ? "text-white/55" : "text-white/35"}`}>{fmtTime(msg.createdAt)}</span>
			</div>
		</div>
	)
}

const AdminSupport = () => {
	const queryClient = useQueryClient()

	const [searchInput, setSearchInput] = useState("")
	const [search, setSearch] = useState("")
	const [status, setStatus] = useState<SupportTicketStatus | "">("")
	const [page, setPage] = useState(1)
	const [activeTicketId, setActiveTicketId] = useState<string | null>(null)

	const [text, setText] = useState("")
	const [files, setFiles] = useState<File[]>([])
	const scrollRef = useRef<HTMLDivElement>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		const id = setTimeout(() => {
			setSearch(searchInput)
			setPage(1)
		}, 400)
		return () => clearTimeout(id)
	}, [searchInput])

	const filter: AdminTicketFilter = useMemo(
		() => ({ page, limit: PAGE_SIZE, status, search: search || undefined }),
		[page, status, search]
	)

	const { data: list, isLoading: listLoading } = useQuery({
		queryKey: ["admin-support-tickets", filter],
		queryFn: () => adminSupportService.listTickets(filter),
		placeholderData: keepPreviousData,
		refetchInterval: 15_000
	})

	const { data: detail, isLoading: detailLoading } = useQuery({
		queryKey: ["admin-support-ticket", activeTicketId],
		queryFn: () => adminSupportService.getTicket(activeTicketId!),
		enabled: !!activeTicketId,
		refetchInterval: 8000
	})

	const messages = detail?.messages ?? []

	useEffect(() => {
		const el = scrollRef.current
		if (el) el.scrollTop = el.scrollHeight
	}, [messages.length])

	// Открыли диалог — отметить сообщения юзера прочитанными
	useEffect(() => {
		if (!activeTicketId) return
		void adminSupportService.markRead(activeTicketId).then(() => {
			queryClient.invalidateQueries({ queryKey: ["admin-support-unread"] })
			queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] })
		})
	}, [activeTicketId, messages.length, queryClient])

	const { mutate: reply, isPending: replying } = useMutation({
		mutationKey: ["admin-support-reply", activeTicketId],
		mutationFn: () => adminSupportService.reply(activeTicketId!, text, files),
		onSuccess: () => {
			setText("")
			setFiles([])
			queryClient.invalidateQueries({ queryKey: ["admin-support-ticket", activeTicketId] })
			queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] })
		},
		onError: (e: Error) => toast.error(e.message)
	})

	const { mutate: changeStatus } = useMutation({
		mutationFn: (s: SupportTicketStatus) => adminSupportService.setStatus(activeTicketId!, s),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["admin-support-ticket", activeTicketId] })
			queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] })
		},
		onError: (e: Error) => toast.error(e.message)
	})

	const addFiles = (fl: FileList | null) => {
		if (!fl) return
		const allowed = new Set(["image/png", "image/jpeg", "image/webp", "video/mp4", "video/quicktime", "video/webm"])
		const next = [...files]
		for (const f of Array.from(fl)) {
			if (next.length >= 5) break
			if (!allowed.has(f.type)) {
				toast.error(`${f.name}: недопустимый тип`)
				continue
			}
			if (f.size > 50 * 1024 * 1024) {
				toast.error(`${f.name}: больше 50 МБ`)
				continue
			}
			next.push(f)
		}
		setFiles(next)
		if (fileInputRef.current) fileInputRef.current.value = ""
	}

	const totalPages = Math.max(1, Math.ceil((list?.total ?? 0) / PAGE_SIZE))

	return (
		<div className="relative z-[1] flex w-full min-w-0 max-w-full flex-col gap-6">
			<h1 className="font-[TalosDisplay] text-4xl font-semibold text-white md:text-5xl">Поддержка</h1>
			<AdminNav active="/admin/support" />

			<div className="grid min-h-[70vh] grid-cols-1 gap-5 lg:grid-cols-[minmax(280px,340px)_1fr]">
				{/* Список тикетов */}
				<div className={`flex flex-col gap-3 ${activeTicketId ? "hidden lg:flex" : "flex"}`}>
					<div className="relative">
						<Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/35" />
						<input
							className={`${inputCls} w-full pl-9`}
							placeholder="Поиск: email, ID, telegram"
							value={searchInput}
							onChange={e => setSearchInput(e.target.value)}
						/>
					</div>
					<div className="flex flex-wrap gap-1.5">
						{STATUS_FILTERS.map(f => (
							<button
								key={f.value}
								type="button"
								onClick={() => {
									setStatus(f.value)
									setPage(1)
								}}
								className={`rounded-lg px-3 py-1 text-[12px] font-semibold transition-colors ${
									status === f.value ? "bg-[#2f6bff]/15 text-white ring-1 ring-[#6aa5ff]/25" : "text-white/50 hover:bg-white/[0.05]"
								}`}
							>
								{f.label}
							</button>
						))}
					</div>

					<div className="flex flex-1 flex-col gap-2 overflow-y-auto rounded-[16px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#0a1020)] p-2">
						{listLoading && !list ? (
							<div className="flex flex-1 items-center justify-center py-8">
								<Loader weight={4} size={40} />
							</div>
						) : !list?.tickets.length ? (
							<p className="py-6 text-center text-[13px] text-white/40">Обращений нет</p>
						) : (
							list.tickets.map(tk => (
								<button
									key={tk.id}
									type="button"
									onClick={() => setActiveTicketId(tk.id)}
									className={`flex flex-col gap-1 rounded-[12px] border p-3 text-left transition-colors ${
										activeTicketId === tk.id
											? "border-[#6aa5ff]/40 bg-[#6aa5ff]/10"
											: "border-transparent bg-white/[0.02] hover:bg-white/[0.05]"
									}`}
								>
									<div className="flex items-center justify-between gap-2">
										<span className="truncate text-[13px] font-semibold text-white">{tk.user.email}</span>
										{tk.unreadFromUser > 0 && (
											<span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ff5c5c] px-1 text-[11px] font-bold text-white">
												{tk.unreadFromUser}
											</span>
										)}
									</div>
									<div className="flex items-center gap-2">
										<span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_META[tk.status].cls}`}>
											{STATUS_META[tk.status].label}
										</span>
										<span className="text-[11px] text-white/35">{fmtTime(tk.lastMessageAt)}</span>
									</div>
									{tk.lastMessage && (
										<span className="truncate text-[12px] text-white/45">
											{tk.lastMessage.authorRole === "ADMIN" ? "Вы: " : ""}
											{tk.lastMessage.text || (tk.lastMessage.attachments.length ? "📎 вложение" : "")}
										</span>
									)}
								</button>
							))
						)}
					</div>

					<div className="flex items-center justify-between">
						<button
							type="button"
							disabled={page <= 1}
							onClick={() => setPage(p => Math.max(1, p - 1))}
							className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/[0.05] text-white transition-colors hover:bg-white/10 disabled:opacity-40"
						>
							<ChevronLeft className="h-4 w-4" />
						</button>
						<span className="text-[12px] text-white/50">
							{page} / {totalPages}
						</span>
						<button
							type="button"
							disabled={page >= totalPages}
							onClick={() => setPage(p => Math.min(totalPages, p + 1))}
							className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/[0.05] text-white transition-colors hover:bg-white/10 disabled:opacity-40"
						>
							<ChevronRight className="h-4 w-4" />
						</button>
					</div>
				</div>

				{/* Диалог + быстрые действия */}
				<div className={`${activeTicketId ? "flex" : "hidden lg:flex"} min-w-0 flex-col`}>
					{!activeTicketId ? (
						<div className="flex flex-1 items-center justify-center rounded-[16px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#0a1020)] text-[14px] text-white/40">
							Выберите обращение слева
						</div>
					) : detailLoading && !detail ? (
						<div className="flex flex-1 items-center justify-center">
							<Loader weight={4} size={48} />
						</div>
					) : detail ? (
						<div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
							{/* Чат */}
							<div className="flex min-w-0 flex-col overflow-hidden rounded-[16px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#0a1020)]">
								{/* Хедер диалога */}
								<div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] p-3">
									<div className="flex items-center gap-2">
										<button
											type="button"
											onClick={() => setActiveTicketId(null)}
											className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 text-white/60 hover:bg-white/10 lg:hidden"
										>
											<ArrowLeft className="h-4 w-4" />
										</button>
										<span className="text-[14px] font-semibold text-white">{detail.ticket.user.email}</span>
									</div>
									<select
										value={detail.ticket.status}
										onChange={e => changeStatus(e.target.value as SupportTicketStatus)}
										className="h-8 cursor-pointer rounded-lg border border-white/15 bg-white/[0.05] px-2 text-[12px] font-semibold text-white [&>option]:bg-[#0e1830]"
									>
										{(Object.keys(STATUS_META) as SupportTicketStatus[]).map(s => (
											<option key={s} value={s}>
												{STATUS_META[s].label}
											</option>
										))}
									</select>
								</div>

								{/* Сообщения */}
								<div ref={scrollRef} className="flex min-h-[320px] flex-1 flex-col gap-3 overflow-y-auto p-4">
									{messages.length === 0 ? (
										<div className="flex flex-1 items-center justify-center text-[13px] text-white/40">Сообщений нет</div>
									) : (
										messages.map(m => <Bubble key={m.id} msg={m} />)
									)}
								</div>

								{/* Композер */}
								<div className="border-t border-white/[0.08] p-3">
									{files.length > 0 && (
										<div className="mb-2 flex flex-wrap gap-2">
											{files.map((f, i) => (
												<span key={`${f.name}-${i}`} className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[11px] text-white/75">
													<Paperclip className="h-3 w-3 text-[#6aa5ff]" />
													<span className="max-w-[120px] truncate">{f.name}</span>
													<button type="button" onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="text-white/40 hover:text-white">
														<X className="h-3 w-3" />
													</button>
												</span>
											))}
										</div>
									)}
									<div className="flex items-end gap-2">
										<label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] text-white/60 hover:bg-white/10">
											<Paperclip className="h-5 w-5" />
											<input
												ref={fileInputRef}
												type="file"
												multiple
												accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm"
												className="hidden"
												onChange={e => addFiles(e.target.files)}
											/>
										</label>
										<textarea
											value={text}
											onChange={e => setText(e.target.value)}
											onKeyDown={e => {
												if (e.key === "Enter" && !e.shiftKey) {
													e.preventDefault()
													if (!replying && (text.trim() || files.length)) reply()
												}
											}}
											placeholder="Ответ клиенту…"
											rows={1}
											className="max-h-[120px] min-h-[40px] flex-1 resize-y rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-[14px] text-white placeholder:text-white/35 outline-none focus:border-[#6aa5ff]/50"
										/>
										<button
											type="button"
											onClick={() => reply()}
											disabled={replying || (!text.trim() && files.length === 0)}
											className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-[#4f8dff] to-[#2f6bff] text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
										>
											{replying ? <Loader weight={3} size={18} /> : <Send className="h-5 w-5" />}
										</button>
									</div>
								</div>
							</div>

							{/* Быстрые действия */}
							<div className="overflow-y-auto">
								<QuickActions user={detail.ticket.user} />
							</div>
						</div>
					) : null}
				</div>
			</div>
		</div>
	)
}

export default AdminSupport
