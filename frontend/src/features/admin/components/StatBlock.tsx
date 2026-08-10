import type { FC } from "react"

import type { ProxyTypeStats, TimeStats } from "@/features/admin/types/admin.types"

import Card from "@/shared/components/ui/Card"

type StatBlockProps = {
	stats: ProxyTypeStats
	label: string
	format: (val: string | number) => string
}

const Row: FC<{ title: string; data: TimeStats; format: (v: string | number) => string }> = ({ title, data, format }) => (
	<div className="flex w-full flex-col">
		<span className="text-body/50 text-xl font-medium">{title}</span>
		<div className="flex w-full flex-row items-start justify-between">
			<div className="flex flex-col items-start">
				<span className="text-body/50 text-xl font-semibold">Час</span>
				<span className="text-body text-2xl font-semibold">{format(data.hour)}</span>
			</div>
			<div className="flex flex-col items-start">
				<span className="text-body/50 text-xl font-semibold">День</span>
				<span className="text-body text-2xl font-semibold">{format(data.day)}</span>
			</div>
			<div className="flex flex-col items-start">
				<span className="text-body/50 text-xl font-semibold">Неделя</span>
				<span className="text-body text-2xl font-semibold">{format(data.week)}</span>
			</div>
			<div className="flex flex-col items-start">
				<span className="text-body/50 text-xl font-semibold">Месяц</span>
				<span className="text-body text-2xl font-semibold">{format(data.month)}</span>
			</div>
		</div>
	</div>
)

const StatBlock: FC<StatBlockProps> = ({ stats, label, format }) => {
	return (
		<Card>
			<h1 className="text-body w-full text-3xl font-semibold">{label}</h1>
			<Row title="Residential Proxy (Delvin23)" data={stats.premium} format={format} />
			<Row title="Premium Residential (ProxyEmpire)" data={stats.premiumResidential} format={format} />
			<Row title="Mobile" data={stats.mobile} format={format} />
			<Row title="Mobile GB" data={stats.mobileGb} format={format} />
			<Row title="IPv6" data={stats.ipv6} format={format} />
		</Card>
	)
}

export default StatBlock
