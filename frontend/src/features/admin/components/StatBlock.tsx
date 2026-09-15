import type { FC } from "react"

import type { ProxyTypeStats, TimeStats } from "@/features/admin/types/admin.types"

import Card from "@/shared/components/ui/Card"

type StatBlockProps = {
	stats: ProxyTypeStats
	label: string
	format: (val: string | number) => string
}

const Row: FC<{ title: string; data: TimeStats; format: (v: string | number) => string }> = ({ title, data, format }) => (
	<div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3.5">
		<span className="mb-3 block truncate text-sm font-medium text-white/65" title={title}>{title}</span>
		<div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-4 lg:grid-cols-2 2xl:grid-cols-4">
			{([['Час', data.hour], ['День', data.day], ['Неделя', data.week], ['Месяц', data.month]] as const).map(([period, value]) => (
				<div key={period} className="min-w-0">
					<span className="block text-[11px] font-medium uppercase tracking-[0.08em] text-white/35">{period}</span>
					<span className="mt-0.5 block truncate text-sm font-semibold text-white" title={format(value)}>{format(value)}</span>
				</div>
			))}
		</div>
	</div>
)

const StatBlock: FC<StatBlockProps> = ({ stats, label, format }) => {
	return (
		<Card className="!gap-3 !p-4 sm:!p-5">
			<h2 className="font-[TalosDisplay] text-xl font-semibold text-white">{label}</h2>
			<Row title="Residential Proxy (Delvin23)" data={stats.premium} format={format} />
			<Row title="Premium Residential (ProxyEmpire)" data={stats.premiumResidential} format={format} />
			<Row title="Premium Mobile" data={stats.mobile} format={format} />
			<Row title="Mobile GB" data={stats.mobileGb} format={format} />
			<Row title="ISP USA" data={stats.ispUsa} format={format} />
			<Row title="ISP Netherlands" data={stats.ispEu} format={format} />
			<Row title="Residential Lite" data={stats.residentialLite} format={format} />
			<Row title="IPv6" data={stats.ipv6} format={format} />
		</Card>
	)
}

export default StatBlock
