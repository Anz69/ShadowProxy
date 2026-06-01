"use client"

import { ArrowDown, ArrowUp, Download, Trash2 } from "lucide-react"
import { type FC, useEffect, useState } from "react"

import { useDeleteKeys } from "@/features/keys/hooks/useDeleteKeys"
import type { Key } from "@/features/keys/types/keys.types"
import type { ProxiesSort } from "@/features/proxy/types/get-proxies.types"

import Button from "@/shared/components/ui/Button"
import Card from "@/shared/components/ui/Card"
import Checkbox from "@/shared/components/ui/Checkbox"
import Copy from "@/shared/components/ui/Copy"
import Loader from "@/shared/components/ui/Loader/Loader"
import Select from "@/shared/components/ui/Select"
import { downloadAsFile } from "@/shared/utils/download-as-file"
import { sortByCreatedAtDesc } from "@/shared/utils/sort-by-created-at-desc"

type KeyControlsProps = {
	keys: Key[]
}

const typeLabels: Record<string, string> = {
	RESIDENT: "Резидентских прокси",
	RESIDENT_PREMIUM: "Residential Proxy прокси",
	PREMIUM_RESIDENTIAL: "Premium Residential прокси",
	ISP: "ISP прокси",
	MOBILE: "Mobile прокси",
	MOBILE_GB: "Mobile GB прокси",
	IPV6_GB: "IPv6 прокси"
}

type Sort = "all" | "activated" | "new"

function pluralizeKeys(n: number): string {
	const abs = Math.abs(n) % 100
	const last = abs % 10

	if (abs > 10 && abs < 20) return `${n} ключей`
	if (last > 1 && last < 5) return `${n} ключа`
	if (last === 1) return `${n} ключ`
	return `${n} ключей`
}

const KeysList: FC<KeyControlsProps> = ({ keys }) => {
	const { deleteKeys, isLoading } = useDeleteKeys()
	const [selectedKeys, setSelectedKeys] = useState<string[]>([])
	const [sort, setSort] = useState<Sort>("all")
	console.log(keys, selectedKeys)

	useEffect(() => {
		setSelectedKeys([])
	}, [sort])

	return (
		<Card className="w-full">
			<h1 className="text-body w-full text-3xl font-semibold">
				Все ключи
			</h1>
			{!keys.length && (
				<span className="text-body/50 text-2xl font-semibold">
					Тут пока ничего нет
				</span>
			)}
			<div className="flex w-full flex-col">
				{!!keys.length && (
					<div className="flex w-full flex-row items-center justify-between px-3">
						<div className="flex flex-row items-center gap-4">
							<Checkbox
								checked={selectedKeys.length === keys.length}
								onChange={val => {
									if (val) {
										setSelectedKeys(keys.map(el => el.key))
									} else {
										setSelectedKeys([])
									}
								}}
							/>
							<Button
								variant="fill"
								type="button"
								disabled={!selectedKeys.length}
								className="!w-fit shrink-0"
								onClick={() => {
									setSelectedKeys([])
									downloadAsFile(
										selectedKeys.join("\n").toUpperCase(),
										`keys_${Date.now()}.txt`
									)
								}}
							>
								Скачать {pluralizeKeys(selectedKeys.length)}
								<Download className="text-body h-4 w-4" />
							</Button>
							<Button
								variant="error-outline"
								type="button"
								disabled={!selectedKeys.length}
								onClick={() => {
									setSelectedKeys([])
									deleteKeys(selectedKeys)
								}}
							>
								Удалить
							</Button>
						</div>
						<Select
							value={sort}
							onChange={val => {
								setSort(val as Sort)
							}}
							size="small"
							className="!w-30"
						>
							<Select.Option value="all">Все</Select.Option>
							<Select.Option value="activated">
								Актив.
							</Select.Option>
							<Select.Option value="new">Новые</Select.Option>
						</Select>
					</div>
				)}
				{keys
					.filter(el => {
						if (sort === "all") return true
						if (sort === "activated" && el.status === "ACTIVATED")
							return true
						if (sort === "new" && el.status === "NEW") return true
						return false
					})
					.sort(sortByCreatedAtDesc)
					.map((el, idx) => (
						<div
							className={`${idx < keys.length - 1 && "border-body/25 border-b-2"} flex w-full flex-col justify-between p-3 md:flex-row md:items-center`}
							key={el.id}
						>
							<span className="text-body flex flex-row items-center gap-2 font-medium">
								<Checkbox
									checked={selectedKeys.includes(el.key)}
									onChange={val => {
										if (val) {
											setSelectedKeys(prev => [
												...prev,
												el.key
											])
										} else {
											setSelectedKeys(prev =>
												prev.filter(
													key => key !== el.key
												)
											)
										}
									}}
								/>
								<span className="ml-2">
									{el.key.toUpperCase().split("-")[0]}-...-
									{el.key.toUpperCase().split("-").pop()}
								</span>
								<Copy value={el.key.toUpperCase()} />
							</span>
							<span className="text-body font-semibold">
								{el.contents} {(el.type as string) === "ISP" ? "IP" : "Гб"}{" "}
								{typeLabels[el.type]}
							</span>
							<span
								className={`${el.status === "ACTIVATED" ? "text-error" : "text-body/50"} text-body flex flex-row items-center gap-4 font-semibold`}
							>
								{el.status === "NEW" ? "Новый" : "Активирован"}
								<button
									type="button"
									onClick={() => {
										setSelectedKeys(prev =>
											prev.filter(key => key !== el.key)
										)
										deleteKeys([el.key])
									}}
									className="text-error cursor-pointer duration-200 hover:brightness-75"
								>
									{isLoading ? (
										<Loader color="#E84646" />
									) : (
										<Trash2 className="size-5" />
									)}
								</button>
							</span>
						</div>
					))}
				{!!keys.length && (
					<div className="w-full">
						<span className="text-body/50 text-lg font-medium">
							Всего: {keys.length}
						</span>
					</div>
				)}
			</div>
		</Card>
	)
}

export default KeysList
