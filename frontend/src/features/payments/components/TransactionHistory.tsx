import type { FC } from "react"
import { useState } from "react"
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
						<path d="M8.00065 1.33334V4.00001M10.8007 5.20001L12.734 3.26668M12.0007 8.00001H14.6673M10.8007 10.8L12.734 12.7333M8.00065 12V14.6667M3.26732 12.7333L5.20065 10.8M1.33398 8.00001H4.00065M3.26732 3.26668L5.20065 5.20001" stroke="white" strokeOpacity="0.4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
					<path d="M12 4L4 12M4 4L12 12" stroke="#F44653" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			)
		}
		if (status === "PAID") {
			return (
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M13.3327 4L5.99935 11.3333L2.66602 8" stroke="#00FF88" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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

	const getStatusColor = (status: string) => {
		if (status === "PAID") return "text-success"
		if (status === "WAITING") return "text-white/50"
		if (status === "CANCELLED") return "text-error"
		return "text-body/50"
	}

	return (
		<div className="pay-shell flex flex-col gap-4 h-full w-full overflow-y-auto md:w-[532px] md:flex-shrink-0">
			<h2 className="text-body text-3xl font-semibold">
				{T("payment.history")}
			</h2>
			<div className="flex h-full w-full flex-col">
				{payments.sort(sortByCreatedAtDesc).filter((el) => {
					const firstContent = el.metadata.contents[0]
					// Скрываем платежи по ISP
					if (firstContent.type === "isp") {
						return false
					}
					// Скрываем пакеты с типом IPV6_GB (ISP)
					if (firstContent.type === "package") {
						const metadataPackage = packages.find(
							el => el.id === firstContent.packageId
						)
						if (metadataPackage?.type === "IPV6_GB") {
							return false
						}
					}
					return true
				}).map((el, idx, filteredPayments) => {
					const metadata = parseMetadata(el.metadata.contents[0])
					return (
						<div
							className={`${idx < filteredPayments.length - 1 && "border-body/25 border-b-2"} flex w-full flex-col md:flex-row items-center justify-between p-3 gap-2`}
							key={el.id}
						>
							{/* ID - слева на ПК */}
							<span
								className="hidden md:inline text-white/50 text-base font-medium cursor-pointer hover:text-white/70 transition-colors"
								onClick={() => copyToClipboard(el.id)}
								title={copiedId === el.id ? T("payment.copied") : T("payment.copyId")}
							>
								{el.id.substring(0, 6)}
							</span>

							{/* Тип тарифа и объем - первая строка на мобильных, по центру на ПК */}
							<div className="flex flex-row items-center gap-2 w-full md:w-auto md:flex-1 md:justify-center order-1 md:order-none">
								<span className="text-white text-base font-medium">
									{metadata.type}
								</span>
								<div className="w-[1px] h-4 bg-white/50" />
								<span className="text-white text-base font-medium">
									{metadata.volume}
								</span>
							</div>

							{/* ID и статус - вторая строка на мобильных (по краям) */}
							<div className="flex flex-row items-center justify-between w-full md:hidden order-2 gap-4">
								<span
									className="text-white/50 text-base font-medium cursor-pointer hover:text-white/70 transition-colors"
									onClick={() => copyToClipboard(el.id)}
									title={copiedId === el.id ? T("payment.copied") : T("payment.copyId")}
								>
									{el.id.substring(0, 8)}
								</span>
								<div className={`flex flex-row items-center gap-2 ${getStatusColor(el.status)}`}>
									{getStatusIcon(el.status)}
									<span className="text-base font-medium">
										{getStatusText(el.status)}
									</span>
								</div>
							</div>

							{/* Статус - справа на ПК */}
							<div className={`hidden md:flex flex-row items-center gap-2 ${getStatusColor(el.status)}`}>
								{getStatusIcon(el.status)}
								<span className="text-base font-medium">
									{getStatusText(el.status)}
								</span>
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
}

export default TransactionHistory
