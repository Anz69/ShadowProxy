"use client"

import {
	ArrowDown,
	ArrowUp,
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
	Pencil
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { type FC, useEffect, useState } from "react"

import ModifyProxyModal from "@/features/proxy/components/ModifyProxyModal"
import SkeletonRow from "@/features/proxy/components/SkeletonRow"
import { useGetProxies } from "@/features/proxy/hooks/useGetProxies"
import type { ProxiesSort } from "@/features/proxy/types/get-proxies.types"
import type {
	Locations,
	Proxy,
	ProxyStaticLocations,
	ProxyType
} from "@/features/proxy/types/proxy.types"

import Button from "@/shared/components/ui/Button"
import Checkbox from "@/shared/components/ui/Checkbox"
import Copy from "@/shared/components/ui/Copy"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"
import SegmentedControl from "@/shared/components/ui/SegmentedControl"
import Select from "@/shared/components/ui/Select"
import { formatTimeLeft } from "@/shared/utils/format-time-left"

const proxyTypeLabel = {
	RESIDENT: "Резидентские",
	RESIDENT_PREMIUM: "Премиум",
	MOBILE: "Мобильные",
	MOBILE_GB: "Мобильные ГБ",
	IPV6_GB: "IPv6 ГБ",
	PREMIUM_RESIDENTIAL: "Premium Residential"
}

const regionLabels = {
	GLOBAL: "Весь мир",
	ASIA: "Азия",
	EUROPE: "Европа",
	NORTH_AMERICA: "Северная Америка",
	SOUTH_AMERICA: "Южная Америка",
	AFRICA: "Африка"
}

const proxyTypeMapping: Map<ProxyTypeLabel, ProxyType> = new Map()
	.set("Residental", "RESIDENT")
	.set("Premium", "RESIDENT_PREMIUM")
	.set("PremiumResidential", "PREMIUM_RESIDENTIAL")
	.set("Mobile", "MOBILE")
	.set("MobileGb", "MOBILE_GB")
	.set("Ipv6Gb", "IPV6_GB")

type ProxyTypeLabel = "Residental" | "Premium" | "PremiumResidential" | "Mobile" | "MobileGb" | "Ipv6Gb"

type ProxyTableProps = {
	locations: Locations
}

const ProxyTable: FC<ProxyTableProps> = ({ locations }) => {
	const regionNames = new Intl.DisplayNames(["ru"], { type: "region" })
	const [origin, setOrigin] = useState("")
	const [type, setType] = useState<ProxyTypeLabel>(
		(localStorage?.getItem("proxy_type") as ProxyTypeLabel) ?? "Residental"
	)
	const [sort, setSort] = useState<ProxiesSort>(
		(localStorage.getItem("proxy_sort") as ProxiesSort) ?? "created_at_desc"
	)
	const [selectAll, setSelectAll] = useState(false)
	const [limit, setLimit] = useState(
		Number(localStorage.getItem("proxy_limit")) || 10
	)
	const [page, setPage] = useState(1)
	const [selectedProxies, setSelectedProxies] = useState<string[]>([])
	const { paginatedProxies, isLoading } = useGetProxies({
		type: proxyTypeMapping.get(type)!,
		sort,
		limit,
		page
	})
	const { open } = useModalStore()

	useEffect(() => {
		setOrigin(window.location.origin)
	}, [])

	useEffect(() => {
		if (!paginatedProxies.data.length) {
			setSelectAll(false)
			setSelectedProxies([])
			return
		}

		if (selectAll) {
			setSelectedProxies(paginatedProxies.data.map(el => el.id))
		} else {
			setSelectedProxies([])
		}
	}, [selectAll, paginatedProxies.data])

	useEffect(() => {
		setPage(1)
	}, [limit, type])

	return (
		<div className="flex w-full flex-col gap-4">
			<div className="mx-auto w-full md:w-[900px]">
				<SegmentedControl
					options={["Residental", "Premium", "PremiumResidential", "ISP", "Mobile"]}
					value={type}
					onChange={val => {
						localStorage.setItem("proxy_type", val)
						setType(val as ProxyTypeLabel)
					}}
				/>
			</div>
			<div className="bg-card/25 w-full overflow-x-auto rounded-xl p-4">
				<div className="mb-2 flex w-full flex-col md:flex-row items-start gap-2 md:gap-0 md:items-center justify-between">
					<div className="flex flex-row items-center gap-4">
						<Button
							variant="fill"
							type="button"
							onClick={() => {
								open(
									<ModifyProxyModal
										locations={locations}
										proxyIds={selectedProxies}
										type={
											proxyTypeMapping.get(
												type
											) as Exclude<ProxyType, "MOBILE">
										}
									/>
								)
								setSelectedProxies([])
								setSelectAll(false)
							}}
							disabled={!selectedProxies.length}
						>
							Редактировать
							<Pencil className="ml-1 h-4 w-4" />
						</Button>
						<span className="text-body/50 text-lg leading-4.5 font-medium whitespace-nowrap">
							Выбрано: {selectedProxies.length}
						</span>
					</div>
					<div className="flex flex-row w-full md:w-fit items-center gap-2">
						<Select
							value={limit.toString()}
							onChange={val => {
								localStorage.setItem("proxy_limit", val)
								setLimit(Number(val))
							}}
						>
							{[10, 25, 50, 100, 250, 500].map(el => (
								<Select.Option value={el.toString()} key={el}>
									{el}
								</Select.Option>
							))}
						</Select>
						<Select
							value={sort}
							onChange={val => {
								localStorage.setItem("proxy_sort", val)
								setSort(val as ProxiesSort)
							}}
						>
							<Select.Option value="created_at_desc">
								<ArrowUp className="h-5 w-5" /> По дате создания
							</Select.Option>
							<Select.Option value="created_at_asc">
								<ArrowDown className="h-5 w-5" /> По дате
								создания
							</Select.Option>
						</Select>
					</div>
				</div>
				<div className="w-full overflow-x-auto">
					<table className="text-body w-full border-collapse overflow-hidden rounded-xl text-left">
						<thead className="bg-card/50 text-base md:text-lg">
							<tr>
								<th className="w-12 px-4">
									<Checkbox
										checked={selectAll}
										disabled={type === "Mobile"}
										onChange={checked =>
											setSelectAll(checked)
										}
									/>
								</th>
								<th className="w-40 py-3 pr-6 pl-0">Тип</th>
								<th className="w-50 px-6 py-3">Протокол</th>
								<th className="w-68 px-6 py-3">Адрес</th>
								<th className="w-86 px-6 py-3 md:w-78">
									Данные
								</th>
								<th className="w-45 px-6 py-3">Истекает</th>
								<th className="px-6 py-3">Ротация</th>
								<th className="px-6 py-3">Гео</th>
							</tr>
						</thead>
						{paginatedProxies.data && !isLoading ? (
							<tbody className="text-base font-medium md:text-lg">
								{paginatedProxies.data.map((row, i) => (
									<tr
										key={i}
										className={`${
											row.status === "SUSPENDED"
												? "opacity-50"
												: i % 2 === 0
													? "bg-transparent"
													: "bg-card/50"
										} h-12 md:h-auto`}
									>
										<td className="px-4">
											<Checkbox
												checked={selectedProxies.includes(
													row.id
												)}
												disabled={type === "Mobile"}
												onChange={checked =>
													checked
														? setSelectedProxies([
																...selectedProxies,
																row.id
															])
														: setSelectedProxies(
																prev =>
																	prev.filter(
																		id =>
																			id !==
																			row.id
																	)
															)
												}
											/>
										</td>
										<td className="py-3 pr-6 pl-0">
											{proxyTypeLabel[row.type]}
										</td>
										<td className="px-6 py-3">
											HTTP / SOCKS5
										</td>
										<td className="px-6 py-3">
											<span className="flex w-full flex-row items-center justify-between gap-2 md:gap-0">
												{row.host}:{row.port}
												<Copy
													value={`${row.host}:${row.port}`}
												/>
											</span>
										</td>
										<td className="px-6 py-3 text-base leading-5">
											<div className="flex w-full flex-row items-center justify-between gap-2 whitespace-nowrap md:gap-0 md:whitespace-normal">
												<div className="flex flex-col">
													Логин:{" "}
													{row.username.slice(0, 17)}
													{row.username.length > 14
														? "..."
														: ""}{" "}
													<br />
													Пароль: {row.password}
												</div>
												<Copy
													value={`${row.username}:${row.password}`}
												/>
											</div>
										</td>
										<td className="px-6 py-3">
											{row.type === "MOBILE"
												? formatTimeLeft(
														row.createdAt,
														row.rentTime!
													)
												: row.type === "IPV6_GB" &&
													  row.rentTime
													? formatTimeLeft(
															row.updatedAt,
															row.rentTime
														)
													: ""}
										</td>
										{row.rotation === "BY_REQUEST" ? (
											<td className={`px-6 py-3`}>
												<span className="flex flex-row items-center gap-2">
													<Link
														target="_blank"
														href={`/proxy/refresh/${row.id}`}
														className="text-primary underline"
													>
														По ссылке
													</Link>
													<Copy
														value={`${origin}/proxy/refresh/${row.id}`}
													/>
												</span>
											</td>
										) : (
											<td className={`px-6 py-3`}>
												{row.rotation === "AUTO"
													? row.type === "IPV6_GB"
														? ""
														: "При запросе"
													: `Каждые ${row.rotationInterval!} мин`}
											</td>
										)}
										<td className="px-10 py-3 pl-6 md:px-6">
											<div className="flex items-center gap-2">
												{row.country.length === 2 ? (
													<>
														{regionNames.of(
															row.country.toUpperCase()
														)}
														<Image
															src={`https://flagsapi.com/${row.country.toUpperCase()}/flat/64.png`}
															alt={
																regionNames.of(
																	row.country.toUpperCase()
																) as string
															}
															width={20}
															height={14}
															className="rounded-sm"
														/>
													</>
												) : (
													regionLabels[
														row.country as ProxyStaticLocations
													]
												)}
											</div>
										</td>
									</tr>
								))}
							</tbody>
						) : (
							<tbody className="text-base font-medium md:text-lg">
								{new Array(limit <= 100 ? limit : 100)
									.fill(null)
									.map((_, idx) => (
										<SkeletonRow key={idx} />
									))}
							</tbody>
						)}
					</table>
				</div>
				{!paginatedProxies.data.length && !isLoading && (
					<div className="flex w-full items-center justify-center py-4">
						<span className="text-body text-xl font-semibold">
							У вас пока нет ни одного прокси этого типа
						</span>
					</div>
				)}
				<div className="mt-2 flex w-full flex-row items-center justify-between">
					<span className="text-body/50 text-lg leading-4.5 font-medium">
						Всего: {paginatedProxies.totalItems}
					</span>
					<div className="flex flex-row items-center gap-2">
						<button
							disabled={!paginatedProxies.prev}
							onClick={() => setPage(1)}
							className="bg-body/2 text-body/75 disabled:text-body/85 disabled:bg-body/2 hover:bg-4 hover:text-body flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl duration-100 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
						>
							<ChevronsLeft className="h-6 w-6" />
						</button>
						<button
							disabled={!paginatedProxies.prev}
							onClick={() => setPage(prev => prev - 1)}
							className="bg-body/2 text-body/75 disabled:text-body/85 disabled:bg-body/2 hover:bg-4 hover:text-body flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl duration-100 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
						>
							<ChevronLeft className="h-6 w-6" />
						</button>
						<span className="text-body mx-1 text-lg leading-4.5 font-medium">
							{page} из {paginatedProxies.totalPages}
						</span>
						<button
							disabled={!paginatedProxies.next}
							onClick={() => setPage(prev => prev + 1)}
							className="bg-body/2 text-body/75 disabled:text-body/85 disabled:bg-body/2 hover:bg-4 hover:text-body flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl duration-100 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
						>
							<ChevronRight className="h-6 w-6" />
						</button>
						<button
							disabled={!paginatedProxies.next}
							onClick={() => setPage(paginatedProxies.totalPages)}
							className="bg-body/2 text-body/75 disabled:text-body/85 disabled:bg-body/2 hover:bg-4 hover:text-body flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl duration-100 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
						>
							<ChevronsRight className="h-6 w-6" />
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}

export default ProxyTable
