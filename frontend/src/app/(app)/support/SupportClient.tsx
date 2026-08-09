"use client"

import { LifeBuoy, Paperclip, Send, X } from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import toast from "react-hot-toast"

import { useSendSupportMessage, useSupportThread } from "@/features/support/hooks/useSupport"
import { supportService } from "@/features/support/services/support.service"
import {
	supportFileUrl,
	type SupportAttachment,
	type SupportMessage,
	type SupportTicketStatus
} from "@/features/support/types/support.types"

import Loader from "@/shared/components/ui/Loader/Loader"
import { getLocaleFromPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"

const MAX_FILE_SIZE = 50 * 1024 * 1024
const MAX_FILES = 5
const ALLOWED_MIME = new Set([
	"image/png",
	"image/jpeg",
	"image/webp",
	"video/mp4",
	"video/quicktime",
	"video/webm"
])

const fmtSize = (bytes: number): string =>
	bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`

const fmtTime = (iso: string, locale: string): string => {
	const bcp = locale === "ru" ? "ru-RU" : locale === "zh-CN" ? "zh-CN" : "en-US"
	const d = new Date(iso)
	return `${d.toLocaleDateString(bcp, { day: "2-digit", month: "2-digit" })} ${d
		.getHours()
		.toString()
		.padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`
}

const AttachmentView = ({ att }: { att: SupportAttachment }) => {
	const url = supportFileUrl(att.url)
	if (att.mime.startsWith("image/")) {
		return (
			<a href={url} target="_blank" rel="noopener noreferrer" className="block">
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img
					src={url}
					alt={att.name}
					className="max-h-[220px] max-w-full rounded-xl border border-white/10 object-cover light:border-[#e2e4ea]"
				/>
			</a>
		)
	}
	if (att.mime.startsWith("video/")) {
		return (
			<video
				src={url}
				controls
				preload="metadata"
				className="max-h-[260px] max-w-full rounded-xl border border-white/10 light:border-[#e2e4ea]"
			/>
		)
	}
	return (
		<a href={url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#6aa5ff] underline">
			{att.name} ({fmtSize(att.size)})
		</a>
	)
}

const MessageBubble = ({ msg, youLabel, supportLabel, locale }: { msg: SupportMessage; youLabel: string; supportLabel: string; locale: string }) => {
	const isUser = msg.authorRole === "USER"
	return (
		<div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
			<div
				className={`flex max-w-[85%] flex-col gap-2 rounded-[16px] px-4 py-3 md:max-w-[70%] ${
					isUser
						? "rounded-br-[4px] bg-gradient-to-b from-[#4f8dff] to-[#2f6bff] text-white"
						: "rounded-bl-[4px] border border-white/[0.08] bg-white/[0.05] text-white light:border-[#e2e4ea] light:bg-white light:text-[#0e1019]"
				}`}
			>
				<span className={`text-[11px] font-semibold uppercase tracking-[0.06em] ${isUser ? "text-white/70" : "text-[#6aa5ff]"}`}>
					{isUser ? youLabel : supportLabel}
				</span>
				{msg.text && <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>}
				{msg.attachments?.length > 0 && (
					<div className="flex flex-col gap-2">
						{msg.attachments.map((att, i) => (
							<AttachmentView key={i} att={att} />
						))}
					</div>
				)}
				<span className={`text-[11px] ${isUser ? "text-white/55" : "text-white/35 light:text-[#8a93a3]"}`}>
					{fmtTime(msg.createdAt, locale)}
				</span>
			</div>
		</div>
	)
}

const SupportClient = () => {
	const pathname = usePathname()
	const locale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, locale)

	const { thread, isLoading } = useSupportThread()
	const { send, isSending } = useSendSupportMessage()

	const [text, setText] = useState("")
	const [files, setFiles] = useState<File[]>([])
	const scrollRef = useRef<HTMLDivElement>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)

	const messages = useMemo(() => thread?.messages ?? [], [thread])
	const adminUnread = useMemo(
		() => messages.filter(m => m.authorRole === "ADMIN" && !m.readAt).length,
		[messages]
	)

	// Автоскролл вниз при новых сообщениях
	useEffect(() => {
		const el = scrollRef.current
		if (el) el.scrollTop = el.scrollHeight
	}, [messages.length])

	// Открыли чат / пришли новые ответы — отмечаем прочитанными
	useEffect(() => {
		if (adminUnread > 0) void supportService.markRead()
	}, [adminUnread])

	const statusBadge = (status: SupportTicketStatus | undefined) => {
		if (!status || messages.length === 0) return null
		const map: Record<SupportTicketStatus, { label: string; cls: string }> = {
			NEW: { label: T("support.statusWaiting"), cls: "bg-[#ffd964]/15 text-[#ffd964] border-[#ffd964]/30" },
			IN_PROGRESS: { label: T("support.statusWaiting"), cls: "bg-[#ffd964]/15 text-[#ffd964] border-[#ffd964]/30" },
			ANSWERED: { label: T("support.statusAnswered"), cls: "bg-[#4ade80]/15 text-[#4ade80] border-[#4ade80]/30" },
			CLOSED: { label: T("support.statusClosed"), cls: "bg-white/10 text-white/60 border-white/20" }
		}
		const s = map[status]
		return (
			<span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-semibold ${s.cls}`}>
				<span className="h-[7px] w-[7px] rounded-full bg-current" aria-hidden />
				{s.label}
			</span>
		)
	}

	const addFiles = (list: FileList | null) => {
		if (!list) return
		const next = [...files]
		for (const f of Array.from(list)) {
			if (next.length >= MAX_FILES) {
				toast.error(T("support.tooManyFiles"))
				break
			}
			if (!ALLOWED_MIME.has(f.type)) {
				toast.error(`${f.name}: ${T("support.fileTypeBad")}`)
				continue
			}
			if (f.size > MAX_FILE_SIZE) {
				toast.error(`${f.name}: ${T("support.fileTooBig")}`)
				continue
			}
			next.push(f)
		}
		setFiles(next)
		if (fileInputRef.current) fileInputRef.current.value = ""
	}

	const handleSend = () => {
		if (isSending) return
		if (!text.trim() && files.length === 0) return
		send(
			{ text, files },
			{
				onSuccess: () => {
					setText("")
					setFiles([])
				},
				onError: (e: Error) => toast.error(e.message)
			}
		)
	}

	return (
		<main className="w-full py-6">
			<div className="mx-auto flex w-full max-w-[900px] flex-col gap-5 px-4">
				{/* Заголовок */}
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex items-center gap-3">
						<span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#6aa5ff]/30 bg-gradient-to-b from-[#6aa5ff]/20 to-[#3b82f6]/[0.08] text-[#6aa5ff]">
							<LifeBuoy className="h-6 w-6" />
						</span>
						<div className="flex flex-col">
							<h1 className="font-[TalosDisplay] text-[clamp(22px,3vw,30px)] font-semibold leading-tight text-white light:text-[#0e1019]">
								{T("support.title")}
							</h1>
							<span className="text-[13px] text-white/45 light:text-[#8a93a3]">{T("support.subtitle")}</span>
						</div>
					</div>
					{statusBadge(thread?.ticket?.status)}
				</div>

				{/* Чат */}
				<div className="flex flex-col overflow-hidden rounded-[20px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#0a1020)] shadow-[0_30px_70px_-44px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)] light:border-[#e6e8ef] light:bg-none light:bg-white">
					<div
						ref={scrollRef}
						className="flex h-[52vh] min-h-[320px] flex-col gap-4 overflow-y-auto p-5"
					>
						{isLoading ? (
							<div className="flex flex-1 items-center justify-center">
								<Loader weight={4} size={48} />
							</div>
						) : messages.length === 0 ? (
							<div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
								<span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#6aa5ff]/25 bg-[#6aa5ff]/10 text-[#6aa5ff]">
									<LifeBuoy className="h-7 w-7" />
								</span>
								<p className="max-w-[420px] text-[14px] text-white/50 light:text-[#8a93a3]">{T("support.empty")}</p>
							</div>
						) : (
							messages.map(m => (
								<MessageBubble key={m.id} msg={m} youLabel={T("support.you")} supportLabel={T("support.supportLabel")} locale={locale} />
							))
						)}
					</div>

					{/* Композер */}
					<div className="border-t border-white/[0.08] p-4 light:border-[#e6e8ef]">
						{files.length > 0 && (
							<div className="mb-3 flex flex-wrap gap-2">
								{files.map((f, i) => (
									<span
										key={`${f.name}-${i}`}
										className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-[12px] text-white/75 light:border-[#e2e4ea] light:bg-[#f4f6fa] light:text-[#475467]"
									>
										<Paperclip className="h-3.5 w-3.5 text-[#6aa5ff]" />
										<span className="max-w-[160px] truncate">{f.name}</span>
										<span className="text-white/40">{fmtSize(f.size)}</span>
										<button
											type="button"
											aria-label="remove file"
											onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
											className="text-white/40 transition-colors hover:text-white"
										>
											<X className="h-3.5 w-3.5" />
										</button>
									</span>
								))}
							</div>
						)}
						<div className="flex items-end gap-2">
							<label
								className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] text-white/60 transition-colors hover:bg-white/10 hover:text-white light:border-[#e2e4ea] light:bg-[#f4f6fa] light:text-[#475467]"
								title={T("support.attach")}
							>
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
										handleSend()
									}
								}}
								placeholder={T("support.inputPlaceholder")}
								rows={1}
								className="max-h-[140px] min-h-[44px] flex-1 resize-y rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-[14px] text-white placeholder:text-white/35 outline-none transition-colors focus:border-[#6aa5ff]/50 light:border-[#e2e4ea] light:bg-white light:text-[#0e1019]"
							/>
							<button
								type="button"
								onClick={handleSend}
								disabled={isSending || (!text.trim() && files.length === 0)}
								className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-[#4f8dff] to-[#2f6bff] text-white shadow-[0_14px_40px_-12px_rgba(59,130,246,0.8)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
								aria-label={T("support.send")}
							>
								{isSending ? <Loader weight={3} size={20} /> : <Send className="h-5 w-5" />}
							</button>
						</div>
					</div>
				</div>
			</div>
		</main>
	)
}

export default SupportClient
