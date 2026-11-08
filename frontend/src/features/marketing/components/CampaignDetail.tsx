"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Copy, MessageSquarePlus, Pencil, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { type FormEvent, useMemo, useState } from "react"
import toast from "react-hot-toast"
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import AdminNav from "@/features/admin/components/AdminNav"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"

import { marketingService } from "../services/marketing.service"
import type { CampaignPoint, CampaignStats } from "../types/marketing.types"
import { int, pct, toDateInput, usd } from "../utils/format"
import CampaignForm from "./CampaignForm"

const inputClass = "min-h-11 w-full rounded-[12px] border border-white/10 bg-white/[0.04] px-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#6aa5ff]/50 focus:ring-4 focus:ring-[#2f6bff]/10"
const panelClass = "rounded-[20px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#091124)]"

const PRESETS = [
	{ key: "7", label: "7 дней", days: 7 },
	{ key: "30", label: "30 дней", days: 30 },
	{ key: "90", label: "90 дней", days: 90 },
	{ key: "all", label: "Всё время", days: 0 }
] as const

type PresetKey = (typeof PRESETS)[number]["key"] | "custom"

const tooltipStyle = { backgroundColor: "#0e1830", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, color: "#fff" }
const shortDate = (v: string) => `${v.slice(8, 10)}.${v.slice(5, 7)}`

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
	return (
		<div className="min-w-0 rounded-[16px] border border-white/[0.08] bg-[linear-gradient(145deg,#101d38,#091124)] p-4">
			<span className="block truncate text-xs font-medium text-white/45">{label}</span>
			<strong className={`mt-2 block truncate font-[TalosDisplay] text-2xl ${accent ?? "text-white"}`}>{value}</strong>
			{sub && <span className="mt-0.5 block truncate text-xs text-white/40">{sub}</span>}
		</div>
	)
}

function KpiGrid({ s }: { s: CampaignStats }) {
	return (
		<div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
			<Kpi label="Цена регистрации (CPA)" value={usd(s.cpa)} sub="расходы / регистрации" />
			<Kpi label="Средний LTV" value={usd(s.avgLtv)} sub="выручка / регистрации" />
			<Kpi label="Регистрации" value={int(s.registrations)} />
			<Kpi label="Активировали триал" value={int(s.trials)} sub={`конверсия ${pct(s.trialRate)}`} />
			<Kpi label="Пополнили сами" value={int(s.payers)} sub={`конверсия ${pct(s.payerRate)}`} />
			<Kpi label="Рефералы" value={int(s.referrals)} sub="привели пользователи" />
			<Kpi label="Расходы" value={usd(s.spend)} accent="text-amber-300" />
			<Kpi label="Выручка" value={usd(s.revenue)} accent="text-emerald-300" sub={`${int(s.payments)} оплат`} />
			<Kpi label="ROMI" value={pct(s.romi)} accent={s.romi !== null && s.romi < 0 ? "text-rose-300" : "text-emerald-300"} sub="(выручка − расходы) / расходы" />
			<Kpi label="Цена клиента (CAC)" value={usd(s.cac)} sub="расходы / платящие" />
			<Kpi label="ARPPU" value={usd(s.arppu)} sub="выручка / платящие" />
			<Kpi label="Прибыль" value={usd(s.revenue - s.spend)} accent={s.revenue - s.spend < 0 ? "text-rose-300" : "text-emerald-300"} />
		</div>
	)
}

function ChartCard({ title, data, lines, money }: { title: string; data: CampaignPoint[]; lines: Array<{ key: keyof CampaignPoint; name: string; color: string }>; money?: boolean }) {
	return (
		<div className={`${panelClass} p-5`}>
			<h3 className="mb-4 font-[TalosDisplay] text-xl font-semibold">{title}</h3>
			<div className="h-60 w-full">
				<ResponsiveContainer width="100%" height="100%">
					<LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
						<CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
						<XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" fontSize={12} tickFormatter={shortDate} minTickGap={16} />
						<YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} allowDecimals={Boolean(money)} tickFormatter={v => (money ? `${v}$` : String(v))} width={48} />
						<Tooltip
							contentStyle={tooltipStyle}
							labelFormatter={label => `Дата: ${String(label).split("-").reverse().join(".")}`}
							formatter={(value: number | undefined, name) => [money ? `${Number(value ?? 0).toFixed(2)} $` : Number(value ?? 0), name]}
						/>
						{lines.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
						{lines.map(l => <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />)}
					</LineChart>
				</ResponsiveContainer>
			</div>
		</div>
	)
}

export default function CampaignDetail({ id }: { id: string }) {
	const queryClient = useQueryClient()
	const { open } = useModalStore()
	const [preset, setPreset] = useState<PresetKey>("all")
	const [custom, setCustom] = useState(() => ({ from: toDateInput(new Date(Date.now() - 29 * 86400000)), to: toDateInput(new Date()) }))
	const [expense, setExpense] = useState(() => ({ amount: "", spentAt: toDateInput(new Date()), comment: "" }))
	const [note, setNote] = useState("")

	const period = useMemo(() => {
		if (preset === "custom") return custom
		const p = PRESETS.find(x => x.key === preset)!
		if (!p.days) return {}
		return { from: toDateInput(new Date(Date.now() - (p.days - 1) * 86400000)), to: toDateInput(new Date()) }
	}, [preset, custom])

	const { data, isLoading, error } = useQuery({
		queryKey: ["admin-marketing", id, period],
		queryFn: () => marketingService.detail(id, period),
		placeholderData: keepPreviousData,
		refetchInterval: 60_000
	})
	const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-marketing"] })

	const addExpense = useMutation({
		mutationFn: () => marketingService.addExpense(id, { amount: Number(expense.amount), spentAt: new Date(`${expense.spentAt}T12:00:00Z`).toISOString(), ...(expense.comment.trim() ? { comment: expense.comment.trim() } : {}) }),
		onSuccess: () => { toast.success("Расход добавлен, показатели пересчитаны"); setExpense(e => ({ ...e, amount: "", comment: "" })); refresh() },
		onError: (e: Error) => toast.error(e.message)
	})
	const removeExpense = useMutation({ mutationFn: (expenseId: string) => marketingService.removeExpense(id, expenseId), onSuccess: () => { toast.success("Расход удалён"); refresh() }, onError: (e: Error) => toast.error(e.message) })
	const addNote = useMutation({ mutationFn: () => marketingService.addNote(id, note.trim()), onSuccess: () => { toast.success("Примечание добавлено"); setNote(""); refresh() }, onError: (e: Error) => toast.error(e.message) })
	const removeNote = useMutation({ mutationFn: (noteId: string) => marketingService.removeNote(id, noteId), onSuccess: () => { toast.success("Примечание удалено"); refresh() }, onError: (e: Error) => toast.error(e.message) })

	if (isLoading) return <div className="relative z-[1] flex w-full flex-col gap-6 text-white"><AdminNav active="/admin/marketing" /><div className="p-8 text-center text-white/40">Загрузка…</div></div>
	if (!data) return <div className="relative z-[1] flex w-full flex-col gap-6 text-white"><AdminNav active="/admin/marketing" /><div className="p-8 text-center text-white/40">{error?.message ?? "Кампания не найдена"}</div></div>

	const totalSpend = data.expenses.reduce((a, x) => a + x.amount, 0)

	return (
		<div className="relative z-[1] flex w-full flex-col gap-6 text-white">
			<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
				<div className="min-w-0">
					<Link href="/admin/marketing" className="mb-3 inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white"><ArrowLeft className="size-4" />Все кампании</Link>
					<h1 className="truncate font-[TalosDisplay] text-4xl font-semibold md:text-5xl">{data.name}</h1>
					<div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/45">
						<span className="rounded-full border border-[#6aa5ff]/20 bg-[#2f6bff]/10 px-2.5 py-0.5 text-xs font-medium text-[#9bc2ff]">{data.source}</span>
						<span>создана {new Date(data.createdAt).toLocaleDateString("ru-RU")}</span>
					</div>
				</div>
				<button type="button" onClick={() => open(<CampaignForm campaign={data} />)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-white/10 px-5 font-semibold text-white/80 hover:bg-white/5 sm:w-auto"><Pencil className="size-4" />Редактировать</button>
			</div>
			<AdminNav active="/admin/marketing" />

			<div className={`${panelClass} flex flex-col gap-3 p-5 md:flex-row md:items-center`}>
				<div className="min-w-0 flex-1">
					<span className="text-xs font-medium text-white/45">UTM-ссылка · utm_campaign = <code className="text-[#9bc2ff]">{data.slug}</code></span>
					<code className="mt-1.5 block font-mono text-sm break-all text-white/85">{data.link}</code>
				</div>
				<button type="button" onClick={() => { navigator.clipboard.writeText(data.link); toast.success("UTM-ссылка скопирована") }} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#5595ff] to-[#2f6bff] px-5 text-sm font-semibold"><Copy className="size-4" />Скопировать</button>
			</div>

			<section className="flex flex-col gap-3">
				<h2 className="font-[TalosDisplay] text-2xl font-semibold">За всё время</h2>
				<KpiGrid s={data.stats} />
			</section>

			<section className="flex flex-col gap-4">
				<div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
					<h2 className="font-[TalosDisplay] text-2xl font-semibold">За период <span className="text-base font-normal text-white/40">{data.period.from.split("-").reverse().join(".")} — {data.period.to.split("-").reverse().join(".")}</span></h2>
					<div className="flex flex-wrap items-center gap-2">
						<div className="inline-flex flex-wrap gap-1 rounded-[12px] border border-white/[0.08] bg-white/[0.03] p-1">
							{PRESETS.map(p => (
								<button key={p.key} type="button" onClick={() => setPreset(p.key)} className={`rounded-[8px] px-3 py-1.5 text-sm font-medium ${preset === p.key ? "bg-[#2f6bff]/15 text-white ring-1 ring-[#6aa5ff]/25" : "text-white/55 hover:bg-white/[0.05] hover:text-white"}`}>{p.label}</button>
							))}
							<button type="button" onClick={() => setPreset("custom")} className={`rounded-[8px] px-3 py-1.5 text-sm font-medium ${preset === "custom" ? "bg-[#2f6bff]/15 text-white ring-1 ring-[#6aa5ff]/25" : "text-white/55 hover:bg-white/[0.05] hover:text-white"}`}>Свой период</button>
						</div>
						{preset === "custom" && (
							<div className="flex items-center gap-2">
								<input type="date" value={custom.from} max={custom.to} onChange={e => e.target.value && setCustom(c => ({ ...c, from: e.target.value }))} className={`${inputClass} min-h-9 w-auto`} />
								<span className="text-white/40">—</span>
								<input type="date" value={custom.to} min={custom.from} max={toDateInput(new Date())} onChange={e => e.target.value && setCustom(c => ({ ...c, to: e.target.value }))} className={`${inputClass} min-h-9 w-auto`} />
							</div>
						)}
					</div>
				</div>
				<KpiGrid s={data.period.stats} />
				{data.period.bucket === "week" && <span className="text-xs text-white/40">Период длиннее 120 дней — точки графиков по неделям.</span>}
				<div className="grid gap-4 xl:grid-cols-2">
					<ChartCard title="Регистрации" data={data.series} lines={[{ key: "registrations", name: "Регистрации", color: "#6aa5ff" }]} />
					<ChartCard title="Триалы" data={data.series} lines={[{ key: "trials", name: "Триалы", color: "#a78bfa" }]} />
					<ChartCard title="Пополнения" data={data.series} lines={[{ key: "payments", name: "Оплаты", color: "#66e0ac" }, { key: "payers", name: "Клиенты", color: "#fbbf24" }]} />
					<ChartCard title="Выручка и расходы" money data={data.series} lines={[{ key: "revenue", name: "Выручка", color: "#34d399" }, { key: "spend", name: "Расходы", color: "#f87171" }]} />
				</div>
			</section>

			<div className="grid gap-4 xl:grid-cols-2">
				<section className={`${panelClass} overflow-hidden`}>
					<div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4"><h2 className="font-[TalosDisplay] text-xl font-semibold">Рекламный бюджет</h2><span className="text-sm text-white/50">Итого <strong className="text-amber-300">{usd(totalSpend)}</strong></span></div>
					<form onSubmit={(e: FormEvent) => { e.preventDefault(); if (Number(expense.amount) > 0) addExpense.mutate() }} className="grid gap-3 border-b border-white/[0.07] p-5 sm:grid-cols-[120px_150px_1fr_auto]">
						<input required type="number" min="0.01" step="0.01" placeholder="Сумма, $" value={expense.amount} onChange={e => setExpense(x => ({ ...x, amount: e.target.value }))} className={inputClass} />
						<input required type="date" max={toDateInput(new Date())} value={expense.spentAt} onChange={e => setExpense(x => ({ ...x, spentAt: e.target.value }))} className={inputClass} />
						<input maxLength={500} placeholder="Комментарий (опционально)" value={expense.comment} onChange={e => setExpense(x => ({ ...x, comment: e.target.value }))} className={inputClass} />
						<button disabled={addExpense.isPending || !(Number(expense.amount) > 0)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#5595ff] to-[#2f6bff] px-5 text-sm font-semibold disabled:opacity-60"><Plus className="size-4" />Добавить</button>
					</form>
					{data.expenses.length === 0 ? <div className="p-6 text-center text-sm text-white/35">Расходов пока нет</div> : (
						<div className="max-h-[360px] divide-y divide-white/[0.06] overflow-y-auto">
							{data.expenses.map(x => (
								<div key={x.id} className="flex items-center gap-3 px-5 py-3">
									<strong className="w-24 shrink-0 font-[TalosDisplay] text-base">{usd(x.amount)}</strong>
									<span className="w-24 shrink-0 text-sm text-white/55">{new Date(x.spentAt).toLocaleDateString("ru-RU")}</span>
									<span className="min-w-0 flex-1 truncate text-sm text-white/45" title={x.comment ?? undefined}>{x.comment ?? "—"}</span>
									<button title="Удалить" type="button" onClick={() => { if (window.confirm(`Удалить расход ${usd(x.amount)}?`)) removeExpense.mutate(x.id) }} className="grid size-8 shrink-0 place-items-center rounded-lg border border-red-400/15 text-red-300 hover:bg-red-400/10"><Trash2 className="size-3.5" /></button>
								</div>
							))}
						</div>
					)}
				</section>

				<section className={`${panelClass} overflow-hidden`}>
					<div className="border-b border-white/[0.07] px-5 py-4"><h2 className="font-[TalosDisplay] text-xl font-semibold">Примечания</h2></div>
					<form onSubmit={(e: FormEvent) => { e.preventDefault(); if (note.trim()) addNote.mutate() }} className="flex flex-col gap-3 border-b border-white/[0.07] p-5">
						<textarea rows={3} maxLength={5000} placeholder="Что изменили, результаты тестов, договорённости…" value={note} onChange={e => setNote(e.target.value)} className={`${inputClass} py-2.5`} />
						<button disabled={addNote.isPending || !note.trim()} className="inline-flex min-h-10 w-full items-center justify-center gap-2 self-end rounded-full border border-white/10 px-5 text-sm font-semibold text-white/80 hover:bg-white/5 disabled:opacity-60 sm:w-auto"><MessageSquarePlus className="size-4" />Добавить примечание</button>
					</form>
					{data.notes.length === 0 ? <div className="p-6 text-center text-sm text-white/35">Примечаний пока нет</div> : (
						<div className="max-h-[360px] divide-y divide-white/[0.06] overflow-y-auto">
							{data.notes.map(n => (
								<div key={n.id} className="flex items-start gap-3 px-5 py-3">
									<div className="min-w-0 flex-1">
										<p className="text-sm whitespace-pre-wrap break-words text-white/80">{n.text}</p>
										<span className="mt-1 block text-xs text-white/35">{new Date(n.createdAt).toLocaleString("ru-RU")}</span>
									</div>
									<button title="Удалить" type="button" onClick={() => { if (window.confirm("Удалить примечание?")) removeNote.mutate(n.id) }} className="grid size-8 shrink-0 place-items-center rounded-lg border border-red-400/15 text-red-300 hover:bg-red-400/10"><Trash2 className="size-3.5" /></button>
								</div>
							))}
						</div>
					)}
				</section>
			</div>

			<section className={`${panelClass} overflow-hidden`}>
				<div className="border-b border-white/[0.07] px-5 py-4"><h2 className="font-[TalosDisplay] text-xl font-semibold">Пользователи за период</h2><p className="text-xs text-white/40">Последние 50 регистраций по этой UTM-ссылке</p></div>
				{data.users.length === 0 ? <div className="p-6 text-center text-sm text-white/35">Регистраций за период нет</div> : (
					<div className="overflow-x-auto">
						<table className="w-full min-w-[640px] text-left text-sm">
							<thead className="text-xs text-white/40"><tr><th className="px-5 py-3 font-medium">Пользователь</th><th className="px-5 py-3 font-medium">Регистрация</th><th className="px-5 py-3 font-medium">Триал</th><th className="px-5 py-3 font-medium">Оплатил</th><th className="px-5 py-3 font-medium">Рефералы</th></tr></thead>
							<tbody className="divide-y divide-white/[0.06]">
								{data.users.map(u => (
									<tr key={u.id}>
										<td className="max-w-[260px] truncate px-5 py-3 text-white/80">{u.email}{u.tgLogin ? <span className="text-white/40"> · @{u.tgLogin}</span> : null}</td>
										<td className="px-5 py-3 text-white/55">{new Date(u.createdAt).toLocaleString("ru-RU")}</td>
										<td className="px-5 py-3 text-white/55">{u.trial ? new Date(u.trial).toLocaleDateString("ru-RU") : "—"}</td>
										<td className={`px-5 py-3 ${u.revenue > 0 ? "text-emerald-300" : "text-white/40"}`}>{u.revenue > 0 ? usd(u.revenue) : "—"}</td>
										<td className="px-5 py-3 text-white/55">{u.referrals || "—"}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>
		</div>
	)
}
