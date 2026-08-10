import type { FC } from "react"
import { useState } from "react"
import { Receipt, ChevronDown } from "lucide-react"
import type { SupportedLocale } from "@/shared/utils/i18n"

import type { Package } from "@/features/packages/types/packages.types"
import type {
	Invoice,
	InvoiceMetadata
} from "@/features/payments/types/payment.types"

import { formatTraffic } from "@/shared/utils/format-traffic"
import { sortByCreatedAtDesc } from "@/shared/utils/sort-by-created-at-desc"
import { t } from "@/shared/utils/i18n"

type TransactionHistoryProps = {
	payments: Invoice[]
	packages: Package[]
	locale?: SupportedLocale
}

const TransactionHistory: FC<TransactionHistoryProps> = ({
	payments,
	packages,
	locale = "ru"
}) => {
	const T = (key: string) => t(key, locale)
	const [copiedId, setCopiedId] = useState<string | null>(null)
	const [open, setOpen] = useState(false)

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text)
		setCopiedId(text)
		setTimeout(() => setCopiedId(null), 2000)
	}

	const parseMetadata = (
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		metadata: any
	): { type: string; volume: string } => {
		if (metadata.type === "package") {
			const metadataPackage = packages.find(
				el => el.id === metadata.packageId
			)
			if (!metadataPackage) {
				return { type: T("payment.unknownPackage"), volume: "" }
			}
			// Получаем тариф из пакета для корректного отображения
			if (metadataPackage.type === "IPV6_GB") {
				return { type: "ISP", volume: `${metadataPackage.traffic} ${T("payment.units.ip")}` }
			}
			if (metadataPackage.type === "MOBILE_GB") {
				return { type: T("payment.tariffTypes.mobile"), volume: formatTraffic(metadataPackage.traffic) }
			}
			if (metadataPackage.type === "RESIDENT" || metadataPackage.type === "RESIDENT_PREMIUM") {
				return { type: T("payment.tariffTypes.resident"), volume: formatTraffic(metadataPackage.traffic) }
			}
			return { type: T("payment.unknownPackage"), volume: "" }
		}
		if (metadata.type === "resident") {
			const typeName = T("payment.tariffTypes.resident")
			return { type: typeName, volume: `${metadata.traffic} ${T("payment.units.gb")}` }
		}
		if (metadata.type === "isp") {
			return { type: "ISP", volume: `${metadata.quantity} ${T("payment.units.ip")}` }
		}
		if (metadata.type === "mobile") {
			return { type: T("payment.tariffTypes.mobile"), volume: `${metadata.rentTime} ${T("payment.units.sec")}` }
		}
		if (metadata.type === "balance") {
			return { type: T("payment.balance"), volume: `${metadata.amount}$` }
		}
		return { type: T("payment.unknown"), volume: "" }
	}

	const getStatusIcon = (status: string) => {
		if (status === "WAITING") {
			return (
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
					<g clipPath="url(#clip0_338_12493)">
						<path d="M8.00065 1.33334V4.00001M10.8007 5.20001L12.734 3.26668M12.0007 8.00001H14.6673M10.8007 10.8L12.734 12.7333M8.00065 12V14.6667M3.26732 12.7333L5.20065 10.8M1.33398 8.00001H4.00065M3.26732 3.26668L5.20065 5.20001" stroke="currentColor" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
					</g>
					<defs>
						<clipPath id="clip0_338_12493">
							<rect width="16" height="16" fill="white"/>
						</clipPath>
					</defs>
				</svg>
			)
		}
		if (status === "CANCELLED") {
			return (
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			)
		}
		if (status === "PAID") {
			return (
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M13.3327 4L5.99935 11.3333L2.66602 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			)
		}
		return null
	}

	const getStatusText = (status: string) => {
		if (status === "PAID") return T("payment.statuses.paid")
		if (status === "WAITING") return T("payment.statuses.waiting")
		if (status === "CANCELLED") return T("payment.statuses.cancelled")
		return status
	}

	const getStatusPill = (status: string) => {
		if (status === "PAID") return "bg-[#34d399]/[0.14] text-[#34d399] light:bg-[#16a34a]/10 light:text-[#16a34a]"
		if (status === "WAITING") return "bg-[#fbbf24]/[0.14] text-[#fbbf24] light:bg-[#f59e0b]/[0.14] light:text-[#d97706]"
		if (status === "CANCELLED") return "bg-[#f87171]/[0.14] text-[#f87171] light:bg-[#ef4444]/10 light:text-[#dc2626]"
		return "bg-white/[0.06] text-white/60 light:bg-black/[0.05] light:text-[#5b6472]"
	}

	const visiblePayments = [...payments].sort(sortByCreatedAtDesc).filter((el) => {
		const firstContent = el.metadata.contents[0]
		if (firstContent.type === "isp") return false
		if (firstContent.type === "package") {
			const metadataPackage = packages.find(p => p.id === firstContent.packageId)
			if (metadataPackage?.type === "IPV6_GB") return false
		}
		return true
	})

	return (
		<div className="flex w-full flex-col rounded-[20px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#0a1020)] p-5 sm:p-6 shadow-[0_30px_70px_-44px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)] light:border-[#e6e8ef] light:bg-none light:bg-white light:shadow-[0_24px_60px_-44px_rgba(14,16,25,0.14)]">
			{/* collapsible header */}
			<button
				type="button"
				onClick={() => setOpen(o => !o)}
				className="flex w-full items-center justify-between gap-3"
				aria-expanded={open}
			>
				<span className="flex items-center gap-2.5">
					<h2 className="font-[TalosDisplay] text-white text-xl font-bold light:text-[#0e1019]">
						{T("payment.history")}
					</h2>
					<span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[12px] font-semibold tabular-nums text-white/55 light:bg-[#2f6bff]/[0.08] light:text-[#2f6bff]">
						{visiblePayments.length}
					</span>
				</span>
				<ChevronDown className={`h-5 w-5 flex-shrink-0 text-white/40 transition-transform duration-300 light:text-[#8a93a3] ${open ? "rotate-180" : ""}`} />
			</button>

			{/* collapsible body (grid-rows trick for smooth height animation) */}
			<div className={`grid transition-[grid-template-rows,margin] duration-300 ease-out ${open ? "mt-4 grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
				<div className="overflow-hidden">
					{visiblePayments.length === 0 ? (
						<div className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-3 py-6 text-center text-[14px] text-white/45 light:border-[#eef0f4] light:bg-[#f8f9fc] light:text-[#8a93a3]">
							{T("payment.history")}: 0
						</div>
					) : (
						<div className="flex max-h-[340px] flex-col gap-1.5 overflow-y-auto pr-1 [mask-image:linear-gradient(to_bottom,#000_90%,transparent)]">
							{visiblePayments.map((el) => {
					const metadata = parseMetadata(el.metadata.contents[0])
					return (
						<div
							key={el.id}
							className="flex w-full items-center gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-3 py-3 transition-colors hover:border-white/[0.12] hover:bg-white/[0.04] light:border-[#eef0f4] light:bg-[#f8f9fc] light:hover:border-[#e2e4ea] light:hover:bg-[#f1f4f9]"
						>
							{/* type icon chip */}
							<span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-[#6aa5ff] light:bg-[#2f6bff]/[0.08] light:text-[#2f6bff]">
								<Receipt className="h-[19px] w-[19px]" />
							</span>

							{/* type + volume·id */}
							<div className="flex min-w-0 flex-1 flex-col gap-0.5">
								<span className="truncate text-[15px] font-semibold leading-tight text-white light:text-[#0e1019]">
									{metadata.type}
								</span>
								<span className="flex items-center gap-1.5 text-[12.5px] leading-tight text-white/45 light:text-[#8a93a3]">
									{metadata.volume && <span>{metadata.volume}</span>}
									{metadata.volume && <span className="text-white/20 light:text-black/15">·</span>}
									<button
										type="button"
										onClick={() => copyToClipboard(el.id)}
										title={copiedId === el.id ? T("payment.copied") : T("payment.copyId")}
										className="font-mono tracking-tight transition-colors hover:text-white/75 light:hover:text-[#475467]"
									>
										#{el.id.substring(0, 6)}
									</button>
								</span>
							</div>

							{/* status pill */}
							<span className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold ${getStatusPill(el.status)}`}>
								{getStatusIcon(el.status)}
								{getStatusText(el.status)}
							</span>
						</div>
					)
				})}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

export default TransactionHistory
