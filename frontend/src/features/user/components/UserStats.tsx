import type { FC } from "react"

import type { UserStats as UserStatsType } from "@/features/user/types/user.types"

import Card from "@/shared/components/ui/Card"
import { formatTraffic } from "@/shared/utils/format-traffic"

type UserTrafficProps = {
	stats: UserStatsType
}

const UserStats: FC<UserTrafficProps> = ({ stats }) => {
	return (
		<div className="flex h-full w-full flex-col items-stretch gap-2 md:gap-4">
			<div className="grid h-full w-full grid-cols-3 grid-rows-2 gap-2 md:gap-4">
				<Card className="w-full items-center justify-center !gap-1 !py-2 md:!gap-3 md:!py-5">
					<span className="text-body/50 text-base font-semibold md:text-2xl">
						Час
					</span>
					<span className="text-body text-base font-semibold md:text-3xl">
						{formatTraffic(stats.hour)}
					</span>
				</Card>
				<Card className="w-full items-center justify-center !gap-1 !py-2 md:!gap-3 md:!py-5">
					<span className="text-body/50 text-base font-semibold md:text-2xl">
						День
					</span>
					<span className="text-body text-base font-semibold md:text-3xl">
						{formatTraffic(stats.day)}
					</span>
				</Card>
				<Card className="w-full items-center justify-center !gap-1 !py-2 md:!gap-3 md:!py-5">
					<span className="text-body/50 text-base font-semibold md:text-2xl">
						Неделя
					</span>
					<span className="text-body text-base font-semibold md:text-3xl">
						{formatTraffic(stats.week)}
					</span>
				</Card>
				<Card className="col-span-3 w-full items-center justify-center !gap-1 !py-2 md:!gap-3 md:!py-5">
					<span className="text-body/50 text-base font-semibold md:text-2xl">
						Месяц
					</span>
					<span className="text-body text-base font-semibold md:text-3xl">
						{formatTraffic(stats.month)}
					</span>
				</Card>
			</div>
		</div>
	)
}

export default UserStats
