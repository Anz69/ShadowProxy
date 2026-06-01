import type { FC } from "react"

import type { UserStats } from "@/features/user/types/user.types"

import { formatTraffic } from "@/shared/utils/format-traffic"

type StatisticsProps = {
	stats: UserStats
}

const Statistics: FC<StatisticsProps> = ({ stats }) => {

	return (
		<div className="flex w-full flex-col items-center gap-4">
			<h2 className="text-body text-2xl font-semibold">Статистика</h2>
			<div className="flex w-full flex-col gap-4">
				<div className="grid w-full grid-cols-3 gap-4">
					<div className="bg-card/25 border-body/25 flex w-full flex-col items-center rounded-xl border-2 py-5">
						<span className="text-body text-2xl leading-6 font-semibold">
							{formatTraffic(stats.hour)}
						</span>
						<span className="text-body/50 text-xl font-medium">
							Час
						</span>
					</div>
					<div className="bg-card/25 border-body/25 flex w-full flex-col items-center rounded-xl border-2 py-5">
						<span className="text-body text-2xl leading-6 font-semibold">
							{formatTraffic(stats.day)}
						</span>
						<span className="text-body/50 text-xl font-medium">
							День
						</span>
					</div>
					<div className="bg-card/25 border-body/25 flex w-full flex-col items-center rounded-xl border-2 py-5">
						<span className="text-body text-2xl leading-6 font-semibold">
							{formatTraffic(stats.week)}
						</span>
						<span className="text-body/50 text-xl font-medium">
							Неделя
						</span>
					</div>
				</div>
				<div className="bg-card/25 border-body/25 flex w-full flex-col items-center rounded-xl border-2 py-5">
					<span className="text-body text-2xl leading-6 font-semibold">
						{formatTraffic(stats.month)}
					</span>
					<span className="text-body/50 text-xl font-medium">
						Месяц
					</span>
				</div>
			</div>
		</div>
	)
}

export default Statistics
