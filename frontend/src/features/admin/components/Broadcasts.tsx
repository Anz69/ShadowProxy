"use client"

import { Plus } from "lucide-react"
import type { FC } from "react"

import AdminNav from "@/features/admin/components/AdminNav"
import { useBroadcasts } from "@/features/admin/hooks/useBroadcasts"
import { SEGMENT_LABELS, type BroadcastSegment } from "@/features/admin/types/broadcast.types"
import CreateBroadcast from "@/features/admin/components/modals/CreateBroadcast"

import Card from "@/shared/components/ui/Card"
import Loader from "@/shared/components/ui/Loader/Loader"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"

const Broadcasts: FC = () => {
	const { broadcasts, isLoading } = useBroadcasts()
	const { open } = useModalStore()

	return (
		<div className="relative z-[1] flex w-full flex-col gap-6">
			<h1 className="font-[TalosDisplay] text-4xl font-semibold text-white md:text-5xl">
				Рассылки
			</h1>

			<AdminNav active="/admin/broadcasts" />

			<Card className="!items-stretch">
				<div className="flex w-full flex-row items-center justify-between gap-4">
					<h2 className="font-[TalosDisplay] text-2xl font-semibold text-white">История рассылок</h2>
					<button
						type="button"
						onClick={() => open(<CreateBroadcast />)}
						className="lg-btn lg-btn--primary lg-btn--sm"
					>
						<span className="lg-sheen" />
						<Plus className="h-[18px] w-[18px]" />
						Создать рассылку
					</button>
				</div>

				{isLoading ? (
					<div className="flex w-full justify-center py-10">
						<Loader weight={5} size={64} />
					</div>
				) : broadcasts.length === 0 ? (
					<div className="w-full py-10 text-center text-sm text-white/45">Рассылок пока нет</div>
				) : (
					<div className="w-full overflow-x-auto">
						<table className="w-full border-collapse text-left">
							<thead>
								<tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-[0.06em] text-white/35">
									<th className="px-3 py-3 font-medium">Заголовок</th>
									<th className="px-3 py-3 font-medium">Аудитория</th>
									<th className="px-3 py-3 font-medium whitespace-nowrap">Получателей</th>
									<th className="px-3 py-3 font-medium whitespace-nowrap">Дата</th>
								</tr>
							</thead>
							<tbody className="text-[13px] text-white/75">
								{broadcasts.map(b => (
									<tr key={b.id} className="border-b border-white/[0.05] transition-colors hover:bg-white/[0.03]">
										<td className="px-3 py-3 font-medium text-white">{b.title}</td>
										<td className="px-3 py-3 text-white/60">{SEGMENT_LABELS[b.segment as BroadcastSegment] ?? b.segment}</td>
										<td className="px-3 py-3">{b.recipientsCount}</td>
										<td className="px-3 py-3 whitespace-nowrap text-white/60">
											{new Date(b.createdAt).toLocaleString("ru-RU")}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</Card>
		</div>
	)
}

export default Broadcasts
