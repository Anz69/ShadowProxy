import Link from "next/link"
import type { FC } from "react"

import Packages from "@/features/admin/components/Packages"
import ProxyPricesModifier from "@/features/admin/components/ProxyPricesModifier"
import type { Prices } from "@/features/proxy/types/proxy.types"

type SettingsProps = {
	prices: Prices
}

const Settings: FC<SettingsProps> = ({ prices }) => {
	return (
		<div className="flex w-full flex-col gap-6">
			<h1 className="text-body text-5xl font-semibold">Настройки</h1>
			<nav className="border-body/25 bg-card/50 flex w-fit flex-row gap-2 rounded-xl border-2 p-1.5">
				<Link
					href="/admin/users"
					className="text-body flex w-60 cursor-pointer items-center justify-center rounded-md py-1 text-lg font-semibold"
				>
					Пользователи
				</Link>
			<Link
				href="/admin/stats"
				className="text-body flex w-60 cursor-pointer items-center justify-center rounded-md py-1 text-lg font-semibold"
			>
				Статистика
			</Link>
			<Link
				href="/admin/logs"
				className="text-body flex w-60 cursor-pointer items-center justify-center rounded-md py-1 text-lg font-semibold"
			>
				Логи
			</Link>
			<Link
				href="/admin/settings"
				className="text-body bg-primary flex w-60 cursor-pointer items-center justify-center rounded-md py-1 text-lg font-semibold"
			>
				Настройки
			</Link>
			<Link
				href="/admin/keys"
				className="text-body flex w-60 cursor-pointer items-center justify-center rounded-md py-1 text-lg font-semibold"
			>
				Ключи
			</Link>
			<Link
				href="/admin/servers"
				className="text-body flex w-60 cursor-pointer items-center justify-center rounded-md py-1 text-lg font-semibold"
			>
				Серверы
			</Link>
			<Link
				href="/admin/reviews"
				className="text-body flex w-60 cursor-pointer items-center justify-center rounded-md py-1 text-lg font-semibold"
			>
				Отзывы
			</Link>
		</nav>
			<div className="grid w-full grid-cols-2 gap-8">
				<ProxyPricesModifier prices={prices} />
				<Packages />
			</div>
		</div>
	)
}

export default Settings
