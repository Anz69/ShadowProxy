import { useQuery } from "@tanstack/react-query"
import type { FC } from "react"

import { userService } from "@/features/user/services/user.service"

import Loader from "@/shared/components/ui/Loader/Loader"
import { formatTraffic } from "@/shared/utils/format-traffic"

/**
 * Статистика трафика юзера грузится ЛЕНИВО по клику (GET /users/:id/stats) —
 * раньше она считалась для КАЖДОГО юзера при загрузке списка (N+1) и лагала админку.
 */
type StatisticsProps = {
	userId: string
}

const Statistics: FC<StatisticsProps> = ({ userId }) => {
	const { data: stats, isLoading, isError, refetch } = useQuery({
		queryKey: ["admin-user-stats", userId],
		queryFn: () => userService.getUserStatsAdmin(userId)
	})

	return (
		<div className="flex w-full flex-col items-center gap-4">
			<h2 className="font-[TalosDisplay] text-2xl font-semibold text-white">Статистика</h2>
			{isError ? (
				<div className="flex w-full flex-col items-center gap-2 py-8">
					<span className="text-[14px] text-white/60">Не удалось загрузить статистику</span>
					<button type="button" onClick={() => refetch()} className="text-[13px] text-white underline">
						Повторить
					</button>
				</div>
			) : isLoading || !stats ? (
				<div className="flex w-full items-center justify-center py-8">
					<Loader weight={4} size={44} />
				</div>
			) : (
			<div className="flex w-full flex-col gap-4">
				<div className="grid w-full grid-cols-3 gap-4">
					<div className="flex w-full flex-col items-center rounded-[14px] border border-white/[0.08] bg-white/[0.04] py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
						<span className="text-body text-2xl leading-6 font-semibold">
							{formatTraffic(stats.hour)}
						</span>
						<span className="text-body/50 text-xl font-medium">
							Час
						</span>
					</div>
					<div className="flex w-full flex-col items-center rounded-[14px] border border-white/[0.08] bg-white/[0.04] py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
						<span className="text-body text-2xl leading-6 font-semibold">
							{formatTraffic(stats.day)}
						</span>
						<span className="text-body/50 text-xl font-medium">
							День
						</span>
					</div>
					<div className="flex w-full flex-col items-center rounded-[14px] border border-white/[0.08] bg-white/[0.04] py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
						<span className="text-body text-2xl leading-6 font-semibold">
							{formatTraffic(stats.week)}
						</span>
						<span className="text-body/50 text-xl font-medium">
							Неделя
						</span>
					</div>
				</div>
				<div className="flex w-full flex-col items-center rounded-[14px] border border-white/[0.08] bg-white/[0.04] py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
					<span className="text-body text-2xl leading-6 font-semibold">
						{formatTraffic(stats.month)}
					</span>
					<span className="text-body/50 text-xl font-medium">
						Месяц
					</span>
				</div>
			</div>
			)}
		</div>
	)
}

export default Statistics
