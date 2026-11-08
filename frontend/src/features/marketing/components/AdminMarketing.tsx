"use client"

import { useQuery } from "@tanstack/react-query"
import { ChevronRight, Copy, Megaphone, Plus, TrendingUp, Users, Wallet } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"
import toast from "react-hot-toast"

import AdminNav from "@/features/admin/components/AdminNav"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"

import { marketingService } from "../services/marketing.service"
import type { Campaign } from "../types/marketing.types"
import { int, usd } from "../utils/format"
import CampaignForm from "./CampaignForm"

const cardClass = "rounded-[18px] border border-white/[0.08] bg-[linear-gradient(145deg,#101d38,#091124)] p-5"

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
	return (
		<div className="min-w-0 rounded-[12px] border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
			<span className="block truncate text-[11px] font-medium text-white/45" title={hint}>{label}</span>
			<strong className="mt-1 block truncate font-[TalosDisplay] text-lg text-white">{value}</strong>
		</div>
	)
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
	const s = campaign.stats
	return (
		<Link href={`/admin/marketing/${campaign.id}`} className="group flex flex-col gap-4 rounded-[20px] border border-white/[0.08] bg-[linear-gradient(145deg,#101d38,#080f1f)] p-5 transition hover:border-[#6aa5ff]/35">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<h3 className="truncate font-[TalosDisplay] text-xl font-semibold text-white">{campaign.name}</h3>
					<div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-white/45">
						<span className="rounded-full border border-[#6aa5ff]/20 bg-[#2f6bff]/10 px-2.5 py-0.5 font-medium text-[#9bc2ff]">{campaign.source}</span>
						<span>с {new Date(campaign.createdAt).toLocaleDateString("ru-RU")}</span>
					</div>
				</div>
				<ChevronRight className="mt-1 size-5 shrink-0 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white/70" />
			</div>

			<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
				<Metric label="Цена регистрации" value={usd(s.cpa)} hint="Расходы / регистрации" />
				<Metric label="Средний LTV" value={usd(s.avgLtv)} hint="Выручка / регистрации" />
				<Metric label="Регистрации" value={int(s.registrations)} />
				<Metric label="Триалы" value={int(s.trials)} />
				<Metric label="Пополнили сами" value={int(s.payers)} hint="Клиенты с реальной оплатой, без промокодов" />
				<Metric label="Рефералы" value={int(s.referrals)} hint="Приглашены зарегистрированными пользователями" />
			</div>

			<div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-sm">
				<span className="text-white/55">Расходы <strong className="text-white">{usd(s.spend)}</strong> · Выручка <strong className="text-emerald-300">{usd(s.revenue)}</strong></span>
				<button
					type="button"
					onClick={event => {
						event.preventDefault()
						navigator.clipboard.writeText(campaign.link)
						toast.success("UTM-ссылка скопирована")
					}}
					className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-xs text-white/65 hover:bg-white/5"
				>
					<Copy className="size-3.5" />Ссылка
				</button>
			</div>
		</Link>
	)
}

export default function AdminMarketing() {
	const { open } = useModalStore()
	const { data: campaigns = [], isLoading } = useQuery({ queryKey: ["admin-marketing"], queryFn: marketingService.list, refetchInterval: 60_000 })

	const totals = useMemo(() => {
		const spend = campaigns.reduce((a, c) => a + c.stats.spend, 0)
		const registrations = campaigns.reduce((a, c) => a + c.stats.registrations, 0)
		const revenue = campaigns.reduce((a, c) => a + c.stats.revenue, 0)
		return { spend, registrations, revenue, cpa: registrations > 0 ? spend / registrations : null }
	}, [campaigns])

	return (
		<div className="relative z-[1] flex w-full flex-col gap-6 text-white">
			<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
				<div><h1 className="font-[TalosDisplay] text-4xl font-semibold md:text-5xl">UTM-аналитика</h1><p className="mt-2 text-sm text-white/45">Marketing / UTM Analytics — рекламные кампании, расходы и окупаемость</p></div>
				<button type="button" onClick={() => open(<CampaignForm />)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#5595ff] to-[#2f6bff] px-6 font-semibold shadow-[0_14px_34px_-14px_rgba(59,130,246,.85)] sm:w-auto"><Plus className="size-4" />Создать кампанию</button>
			</div>
			<AdminNav active="/admin/marketing" />

			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<div className={cardClass}><span className="text-sm text-white/45">Кампаний</span><div className="mt-3 flex items-center gap-3"><Megaphone className="size-5 text-[#6aa5ff]" /><strong className="font-[TalosDisplay] text-3xl">{campaigns.length}</strong></div></div>
				<div className={cardClass}><span className="text-sm text-white/45">Регистраций по UTM</span><div className="mt-3 flex items-center gap-3"><Users className="size-5 text-[#66e0ac]" /><strong className="font-[TalosDisplay] text-3xl">{int(totals.registrations)}</strong></div></div>
				<div className={cardClass}><span className="text-sm text-white/45">Расходы · средний CPA</span><div className="mt-3 flex items-center gap-3"><Wallet className="size-5 text-amber-300" /><strong className="font-[TalosDisplay] text-3xl">{usd(totals.spend)}</strong><span className="text-sm text-white/45">{usd(totals.cpa)}</span></div></div>
				<div className={cardClass}><span className="text-sm text-white/45">Выручка</span><div className="mt-3 flex items-center gap-3"><TrendingUp className="size-5 text-emerald-300" /><strong className="font-[TalosDisplay] text-3xl">{usd(totals.revenue)}</strong></div></div>
			</div>

			{isLoading ? (
				<div className="rounded-[20px] border border-white/[0.08] p-8 text-center text-white/40">Загрузка…</div>
			) : campaigns.length === 0 ? (
				<div className="rounded-[20px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#091124)] p-10 text-center text-white/45">Кампаний пока нет — создайте первую, чтобы получить UTM-ссылку</div>
			) : (
				<div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
					{campaigns.map(campaign => <CampaignCard key={campaign.id} campaign={campaign} />)}
				</div>
			)}
		</div>
	)
}
