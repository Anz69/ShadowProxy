import type { FC } from "react"

const SkeletonRow: FC = () => {
	return (
		<tr className="h-12 md:h-auto">
			<td className="px-4"></td>
			<td className="py-3 pr-6 pl-0">
				<div className="bg-body/5 animate-pulse-fast h-6 w-35 rounded-md" />
			</td>
			<td className="px-6 py-3">
				<div className="bg-body/5 animate-pulse-fast h-6 w-35 rounded-md" />
			</td>
			<td className="px-6 py-3">
				<div className="bg-body/5 animate-pulse-fast h-6 w-50 rounded-md" />
			</td>
			<td className="px-6 py-3 text-base leading-5">
				<div className="flex w-full flex-row items-center justify-between gap-2 whitespace-nowrap md:gap-0 md:whitespace-normal">
					<div className="flex flex-col gap-1">
						<div className="bg-body/5 animate-pulse-fast h-5 w-60 rounded-md" />
						<div className="bg-body/5 animate-pulse-fast h-5 w-60 rounded-md" />
					</div>
				</div>
			</td>
			<td className="px-6 py-3">
				<div className="bg-body/5 animate-pulse-fast h-6 w-20 rounded-md" />
			</td>
			<td className={`px-6 py-3`}>
				<div className="bg-body/5 animate-pulse-fast h-6 w-45 rounded-md" />
			</td>
			<td className="px-10 py-3 pl-6 md:px-6">
				<div className="flex items-center gap-2">
					<div className="bg-body/5 animate-pulse-fast h-6 w-25 rounded-md" />
				</div>
			</td>
		</tr>
	)
}

export default SkeletonRow
