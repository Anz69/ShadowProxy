"use client"

import {
	Check,
	ChevronRight,
	ChevronsRight,
	Copy as CopyIcon,
	Download
} from "lucide-react"
import Link from "next/link"
import { type FC, useState } from "react"

import ModifyProxyForm from "@/features/proxy/components/ModifyProxyForm"
import { useGetMany } from "@/features/proxy/hooks/useGetMany"
import type {
	Locations,
	Proxy,
	ProxyType
} from "@/features/proxy/types/proxy.types"

import Button from "@/shared/components/ui/Button"
import Copy from "@/shared/components/ui/Copy"
import Select from "@/shared/components/ui/Select"
import { downloadAsFile } from "@/shared/utils/download-as-file"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"

type ModifyProxyModalProps = {
	proxyIds: string[]
	type: Exclude<ProxyType, "MOBILE">
	locations: Locations
	isNew?: boolean
}

type AvailableProxyFormatting =
	| "{host}:{port}:{username}:{password}"
	| "{username}:{password}:{host}:{port}"
	| "{username}:{password}@{host}:{port}"
	| "{host}:{port}@{username}:{password}"

const ModifyProxyModal: FC<ModifyProxyModalProps> = ({
	proxyIds,
	type,
	locations,
	isNew = false
}) => {
	const [format, setFormat] = useState<AvailableProxyFormatting>(
		"{host}:{port}:{username}:{password}"
	)
	const { proxies } = useGetMany(proxyIds)
	const formatProxy = (proxy: Proxy) =>
		format
			.replace("{host}", proxy.host)
			.replace("{port}", String(proxy.port))
			.replace("{username}", proxy.username)
			.replace("{password}", proxy.password)
	const [isCopying, setIsCopying] = useState(false)
	const {close} = useModalStore()

	const copyAll = async () => {
		setIsCopying(true)
		await window.navigator.clipboard.writeText(
			proxies.map(formatProxy).join("\n")
		)
		setTimeout(() => {
			setIsCopying(false)
		}, 1500)
	}

	return (
		<div className="flex min-h-[488px] min-w-full md:min-w-[1000px] flex-col items-start justify-start gap-2 md:gap-4">
			<div className="flex flex-col gap-1">
				<span className="text-body/50 text-base font-medium">
					Формат
				</span>
				<Select
					value={format}
					size="small"
					onChange={val => setFormat(val as AvailableProxyFormatting)}
				>
					<Select.Option value="{host}:{port}:{username}:{password}">
						hostname:port:username:password
					</Select.Option>
					<Select.Option value="{username}:{password}:{host}:{port}">
						username:password:hostname:port
					</Select.Option>
					<Select.Option value="{username}:{password}@{host}:{port}">
						username:password@hostname:port
					</Select.Option>
					<Select.Option value="{host}:{port}@{username}:{password}">
						hostname:port@username:password
					</Select.Option>
				</Select>
			</div>
			{!!proxies.length && type !== "IPV6_GB" && (
				<ModifyProxyForm
					type={type}
					locations={locations}
					proxies={proxies}
				/>
			)}
			<div
				className={`bg-body/2 max-h-80 w-full overflow-y-auto rounded-xl p-4`}
			>
				{proxies.map(el => {
					const formattedProxy = formatProxy(el)
					return (
						<span
							key={el.id}
							className="text-body flex flex-row items-start md:items-center gap-2 text-base leading-6 font-medium"
						>
							{formattedProxy}
							<Copy value={formattedProxy}/>
						</span>
					)
				})}
			</div>
			<div className="flex flex-row items-center gap-2 w-fit">
				{isNew && (
					<Link href="/dashboard" className="shrink-0">
						<Button
							variant="fill"
							type="button"
							className="!w-fit shrink-0"
							onClick={close}
						>
							В панель управления{" "}
							<ChevronRight className="size-4" />
						</Button>
					</Link>
				)}
				<Button variant="fill" type="button" onClick={copyAll}>
					Скопировать
					{isCopying ? (
						<Check className="text-body ml-1 h-4 w-4" />
					) : (
						<CopyIcon className="text-body/80 hover:text-body ml-1 h-4 w-4 shrink-0 cursor-pointer duration-200" />
					)}
				</Button>
				<Button
					variant="outline"
					type="button"
					onClick={() =>
						downloadAsFile(
							proxies.map(formatProxy).join("\n"),
							`proxy_dump_${Date.now()}.txt`
						)
					}
				>
					Скачать
					<Download className="text-body h-4 w-4" />
				</Button>
			</div>
		</div>
	)
}

export default ModifyProxyModal
