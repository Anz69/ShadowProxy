"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarDays, Copy, Gift, Plus, Power, Sparkles, Trash2, Users } from "lucide-react"
import toast from "react-hot-toast"
import AdminNav from "@/features/admin/components/AdminNav"
import { promoService } from "../services/promo.service"
import type { PromoCode, PromoMode } from "../types/promo.types"

const inputClass = "min-h-11 w-full rounded-[12px] border border-white/10 bg-white/[0.04] px-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#6aa5ff]/50 focus:ring-4 focus:ring-[#2f6bff]/10"

function statusOf(promo: PromoCode) {
	if (new Date(promo.expiresAt).getTime() <= Date.now()) return { label: "Истёк", cls: "border-amber-400/20 bg-amber-400/10 text-amber-300" }
	if (!promo.active && promo.mode === "ONE_TIME" && promo.activationCount > 0) return { label: "Использован", cls: "border-violet-400/20 bg-violet-400/10 text-violet-300" }
	if (!promo.active) return { label: "Отключён", cls: "border-white/10 bg-white/5 text-white/45" }
	return { label: "Активен", cls: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" }
}

export default function AdminPromos() {
	const queryClient = useQueryClient()
	const [code, setCode] = useState("")
	const [amount, setAmount] = useState(10)
	const [expiresAt, setExpiresAt] = useState(() => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
	const [mode, setMode] = useState<PromoMode>("MULTI_USE")
	const [expanded, setExpanded] = useState<string | null>(null)
	const { data: promos = [], isLoading } = useQuery({ queryKey: ["admin-promos"], queryFn: promoService.list })
	const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-promos"] })
	const create = useMutation({
		mutationFn: promoService.create,
		onSuccess: promo => { toast.success(`Промокод ${promo.code} создан`); setCode(""); refresh() },
		onError: (error: Error) => toast.error(error.message)
	})
	const deactivate = useMutation({ mutationFn: promoService.deactivate, onSuccess: () => { toast.success("Промокод отключён"); refresh() }, onError: (e: Error) => toast.error(e.message) })
	const remove = useMutation({ mutationFn: promoService.remove, onSuccess: () => { toast.success("Промокод удалён"); refresh() }, onError: (e: Error) => toast.error(e.message) })
	const totals = useMemo(() => ({ active: promos.filter(p => p.active && new Date(p.expiresAt) > new Date()).length, activations: promos.reduce((sum, p) => sum + p.activationCount, 0) }), [promos])

	return (
		<div className="relative z-[1] flex w-full flex-col gap-6 text-white">
			<div><h1 className="font-[TalosDisplay] text-4xl font-semibold md:text-5xl">Промокоды</h1><p className="mt-2 text-sm text-white/45">Создание, статусы и история активаций</p></div>
			<AdminNav active="/admin/promos" />
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="rounded-[18px] border border-white/[0.08] bg-[linear-gradient(145deg,#101d38,#091124)] p-5"><span className="text-sm text-white/45">Активных кодов</span><div className="mt-3 flex items-center gap-3"><Gift className="size-5 text-[#6aa5ff]" /><strong className="font-[TalosDisplay] text-3xl">{totals.active}</strong></div></div>
				<div className="rounded-[18px] border border-white/[0.08] bg-[linear-gradient(145deg,#101d38,#091124)] p-5"><span className="text-sm text-white/45">Всего активаций</span><div className="mt-3 flex items-center gap-3"><Users className="size-5 text-[#66e0ac]" /><strong className="font-[TalosDisplay] text-3xl">{totals.activations}</strong></div></div>
			</div>

			<form onSubmit={event => { event.preventDefault(); create.mutate({ ...(code.trim() ? { code } : {}), amount, expiresAt: new Date(`${expiresAt}T23:59:59`).toISOString(), mode }) }} className="rounded-[20px] border border-white/[0.08] bg-[linear-gradient(145deg,#101d38,#080f1f)] p-5 sm:p-6">
				<div className="mb-5 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-[12px] bg-[#2f6bff]/15 text-[#78adff]"><Plus className="size-5" /></span><div><h2 className="font-[TalosDisplay] text-xl font-semibold">Новый промокод</h2><p className="text-xs text-white/40">Оставьте код пустым для безопасной автогенерации</p></div></div>
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
					<label><span className="mb-2 block text-xs font-medium text-white/50">Код</span><input value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} placeholder="AUTO" className={`${inputClass} font-mono tracking-wide`} /></label>
					<label><span className="mb-2 block text-xs font-medium text-white/50">Сумма, $</span><input required min="0.01" step="0.01" type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} className={inputClass} /></label>
					<label><span className="mb-2 block text-xs font-medium text-white/50">Действует до</span><input required type="date" min={new Date().toISOString().slice(0, 10)} value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className={inputClass} /></label>
					<label><span className="mb-2 block text-xs font-medium text-white/50">Режим</span><select value={mode} onChange={e => setMode(e.target.value as PromoMode)} className={inputClass}><option value="MULTI_USE">Многоразовый</option><option value="ONE_TIME">Одноразовый</option></select></label>
				</div>
				<button disabled={create.isPending || !amount || !expiresAt} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#5595ff] to-[#2f6bff] px-6 font-semibold shadow-[0_14px_34px_-14px_rgba(59,130,246,.85)] sm:w-auto"><Sparkles className="size-4" />{create.isPending ? "Создание…" : "Создать промокод"}</button>
			</form>

			<div className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#091124)]">
				<div className="border-b border-white/[0.07] px-5 py-4"><h2 className="font-[TalosDisplay] text-xl font-semibold">Все промокоды</h2></div>
				{isLoading ? <div className="p-8 text-center text-white/40">Загрузка…</div> : promos.length === 0 ? <div className="p-8 text-center text-white/40">Промокодов пока нет</div> : (
					<div className="divide-y divide-white/[0.06]">
						{promos.map(promo => { const status = statusOf(promo); return (
							<div key={promo.id} className="p-4 sm:p-5">
								<div className="grid items-center gap-4 md:grid-cols-[minmax(170px,1.2fr)_100px_140px_110px_auto]">
									<button type="button" onClick={() => { navigator.clipboard.writeText(promo.code); toast.success("Код скопирован") }} className="flex min-w-0 items-center gap-2 text-left"><code className="truncate font-mono text-[15px] font-semibold text-[#9bc2ff]">{promo.code}</code><Copy className="size-3.5 shrink-0 text-white/35" /></button>
									<strong className="font-[TalosDisplay] text-lg">${Number(promo.amount).toFixed(2)}</strong>
									<span className="inline-flex items-center gap-1.5 text-sm text-white/55"><CalendarDays className="size-4" />{new Date(promo.expiresAt).toLocaleDateString("ru-RU")}</span>
									<span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-medium ${status.cls}`}>{status.label}</span>
									<div className="flex justify-start gap-2 md:justify-end"><button type="button" onClick={() => setExpanded(expanded === promo.id ? null : promo.id)} className="min-h-9 rounded-lg border border-white/10 px-3 text-xs text-white/65 hover:bg-white/5">{promo.activationCount} активаций</button>{promo.active && <button title="Отключить" type="button" onClick={() => deactivate.mutate(promo.id)} className="grid size-9 place-items-center rounded-lg border border-amber-400/15 text-amber-300 hover:bg-amber-400/10"><Power className="size-4" /></button>}<button title="Удалить" type="button" onClick={() => { if (window.confirm(`Удалить промокод ${promo.code}?`)) remove.mutate(promo.id) }} className="grid size-9 place-items-center rounded-lg border border-red-400/15 text-red-300 hover:bg-red-400/10"><Trash2 className="size-4" /></button></div>
								</div>
								{expanded === promo.id && <div className="mt-4 rounded-[14px] border border-white/[0.07] bg-black/10 p-3">{promo.redemptions.length ? <div className="space-y-2">{promo.redemptions.map(item => <div key={item.id} className="flex flex-col justify-between gap-1 text-sm sm:flex-row"><span className="text-white/75">{item.user.email}{item.user.tgLogin ? ` · @${item.user.tgLogin}` : ""}</span><span className="text-white/40">+${Number(item.amount).toFixed(2)} · {new Date(item.createdAt).toLocaleString("ru-RU")}</span></div>)}</div> : <span className="text-sm text-white/35">Активаций ещё не было</span>}</div>}
							</div>
						)})}
					</div>
				)}
			</div>
		</div>
	)
}
