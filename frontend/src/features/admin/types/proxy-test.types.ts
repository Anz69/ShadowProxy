export type ProxyTestType =
	| "RESIDENT"
	| "RESIDENT_PREMIUM"
	| "MOBILE"
	| "MOBILE_GB"
	| "IPV6_GB"
	| "PREMIUM_RESIDENTIAL"
	| "ISP_USA"
	| "ISP_EU"
	| "RESIDENTIAL_LITE"

export type ProxyTestTarget = ProxyTestType | "ALL"

export type ProxyTestCatalogItem = {
	type: ProxyTestType
	label: string
	activeProxyCount: number
	safeQaAvailable: boolean
}

export type ProxyTestCatalog = {
	balanceImpact: "none"
	defaultSizeMb: number
	maxSizeMb: number
	types: ProxyTestCatalogItem[]
}

export type CreateProxyTestDto = {
	target: ProxyTestTarget
	country?: string
	samplesPerTariff: number
	sizeMb: number
	concurrency: number
}

export type ProxyTestResult = {
	id: string
	type: ProxyTestType
	label: string
	country: string
	source: "provider" | "database"
	status: "pending" | "running" | "ok" | "failed" | "unavailable"
	latencyMs: number | null
	downloadedBytes: number
	gatewayInBytes: number
	gatewayOutBytes: number
	gatewayReportedBytes: number
	mbps: number | null
	exitIp: string
	error: string
	startedAt: string | null
	finishedAt: string | null
}

export type ProxyTestRun = {
	id: string
	status: "queued" | "running" | "completed" | "failed"
	createdAt: string
	startedAt: string | null
	finishedAt: string | null
	target: ProxyTestTarget
	country: string | null
	sizeMb: number
	samplesPerTariff: number
	concurrency: number
	gatewayHost: string
	results: ProxyTestResult[]
	error: string
}
