import type { Package } from "./packages.types"
import type { ProxyType } from "@/features/proxy/types/proxy.types"

export type Proxy = {
	id: string
	port: number
	login: string
	password: string
	serverHost: string
	createdAt: string
	lastActivityAt: string
}

export type UserPackage = {
	id: string
	type: ProxyType // Тип прокси (тариф) - используется для определения шаблона страницы
	planId?: string | null // ID плана для MOBILE пакетов
	activeProxies: Proxy[]
	proxiesCount: number
	createdAt: string
}

