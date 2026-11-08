"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Check, Copy } from "lucide-react"
import { type FC, type FormEvent, useState } from "react"
import toast from "react-hot-toast"

import Button from "@/shared/components/ui/Button"
import Footnote from "@/shared/components/ui/Footnote"
import Input from "@/shared/components/ui/Input"
import Loader from "@/shared/components/ui/Loader/Loader"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"

import { marketingService } from "../services/marketing.service"
import type { Campaign } from "../types/marketing.types"
import { CAMPAIGN_SOURCES } from "../utils/format"

const fieldCls =
	"w-full rounded-xl border-2 border-body/25 bg-card/50 px-4 py-2 text-base font-medium text-body outline-none duration-200 placeholder:text-body/40 hover:border-[#0067FF] focus:border-[#0067FF]"

const OTHER = "__other__"

const CampaignForm: FC<{ campaign?: Campaign }> = ({ campaign }) => {
	const queryClient = useQueryClient()
	const { close } = useModalStore()
	const isEdit = Boolean(campaign)
	const knownSource = !campaign || CAMPAIGN_SOURCES.includes(campaign.source)
	const [name, setName] = useState(campaign?.name ?? "")
	const [sourceChoice, setSourceChoice] = useState(campaign ? (knownSource ? campaign.source : OTHER) : CAMPAIGN_SOURCES[0])
	const [customSource, setCustomSource] = useState(knownSource ? "" : campaign?.source ?? "")
	const [note, setNote] = useState("")
	const [created, setCreated] = useState<Campaign | null>(null)
	const [copied, setCopied] = useState(false)

	const source = sourceChoice === OTHER ? customSource.trim() : sourceChoice

	const save = useMutation({
		mutationFn: () =>
			campaign
				? marketingService.update(campaign.id, { name: name.trim(), source })
				: marketingService.create({ name: name.trim(), source, ...(note.trim() ? { note: note.trim() } : {}) }),
		onSuccess: result => {
			queryClient.invalidateQueries({ queryKey: ["admin-marketing"] })
			if (campaign) {
				toast.success("Кампания сохранена")
				close()
			} else {
				setCreated(result)
			}
		}
	})

	const onSubmit = (event: FormEvent) => {
		event.preventDefault()
		if (!name.trim() || !source) return
		save.mutate()
	}

	if (created) {
		return (
			<div className="flex w-full max-w-[560px] flex-col gap-4">
				<h2 className="text-body text-2xl font-semibold">Кампания создана</h2>
				<p className="text-body/60 text-sm">Используйте эту ссылку в рекламе — все регистрации по ней попадут в статистику «{created.name}».</p>
				<div className="flex w-full flex-col gap-1">
					<span className="text-body/50 text-base font-medium">UTM-ссылка</span>
					<code className="border-body/15 bg-card/50 text-body block rounded-xl border px-4 py-3 font-mono text-sm break-all">{created.link}</code>
				</div>
				<Button
					variant="fill"
					type="button"
					onClick={() => {
						navigator.clipboard.writeText(created.link)
						setCopied(true)
						toast.success("Ссылка скопирована")
					}}
				>
					{copied ? <Check className="size-4" /> : <Copy className="size-4" />}
					{copied ? "Скопировано" : "Скопировать ссылку"}
				</Button>
				<Button variant="outline" type="button" onClick={close}>Готово</Button>
			</div>
		)
	}

	return (
		<form className="flex w-full max-w-[560px] flex-col gap-4" onSubmit={onSubmit}>
			<h2 className="text-body text-2xl font-semibold">{isEdit ? "Редактирование кампании" : "Новая кампания"}</h2>

			<div className="flex w-full flex-col gap-1">
				<span className="text-body/50 text-base font-medium">Название кампании</span>
				<Input required maxLength={120} placeholder="Например: Telegram Ads — ноябрь" value={name} onChange={e => setName(e.target.value)} />
			</div>

			<div className="flex w-full flex-col gap-1">
				<span className="text-body/50 text-base font-medium">Источник рекламы</span>
				<select value={sourceChoice} onChange={e => setSourceChoice(e.target.value)} className={fieldCls}>
					{CAMPAIGN_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
					<option value={OTHER}>Другой источник…</option>
				</select>
				{sourceChoice === OTHER && (
					<Input required maxLength={60} placeholder="Название источника" value={customSource} onChange={e => setCustomSource(e.target.value)} className="mt-2" />
				)}
			</div>

			{!isEdit && (
				<div className="flex w-full flex-col gap-1">
					<span className="text-body/50 text-base font-medium">Примечание (опционально)</span>
					<textarea rows={3} maxLength={5000} className={fieldCls} placeholder="Креативы, аудитория, договорённости…" value={note} onChange={e => setNote(e.target.value)} />
				</div>
			)}

			{isEdit ? (
				<span className="text-body/40 text-xs">UTM-метка кампании ({campaign!.slug}) не меняется — уже размещённые ссылки продолжат работать.</span>
			) : (
				<span className="text-body/40 text-xs">Уникальная UTM-ссылка сгенерируется автоматически после создания.</span>
			)}

			{save.error && <Footnote variant="error">{save.error.message}</Footnote>}

			<Button variant="fill" type="submit" disabled={save.isPending || !name.trim() || !source}>
				{save.isPending ? <Loader /> : isEdit ? "Сохранить" : "Создать кампанию"}
			</Button>
		</form>
	)
}

export default CampaignForm
