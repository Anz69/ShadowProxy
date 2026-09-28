"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import {
	Activity,
	AlertTriangle,
	CheckCircle2,
	CircleDot,
	Clock3,
	Database,
	Gauge,
	Globe2,
	LoaderCircle,
	Play,
	RefreshCw,
	Server,
	ShieldCheck,
	Timer,
	XCircle,
	Zap
} from "lucide-react"
import { type FC, useEffect, useMemo, useState } from "react"
import toast from "react-hot-toast"

import AdminNav from "@/features/admin/components/AdminNav"
import { adminService } from "@/features/admin/serices/admin.service"
import type {
	CreateProxyTestDto,
	ProxyTestResult,
	ProxyTestTarget,
	ProxyTestType
} from "@/features/admin/types/proxy-test.types"

import Button from "@/shared/components/ui/Button"
import Card from "@/shared/components/ui/Card"
import Input from "@/shared/components/ui/Input"
import Loader from "@/shared/components/ui/Loader/Loader"
import Select from "@/shared/components/ui/Select"

const FALLBACK_LABELS: Record<ProxyTestType, string> = {
	RESIDENT: "Residential (legacy)",
	RESIDENT_PREMIUM: "Residential Proxy",
	MOBILE: "Premium Mobile",
	MOBILE_GB: "Mobile GB",
	IPV6_GB: "IPv6",
	PREMIUM_RESIDENTIAL: "Premium Residential",
	ISP_USA: "ISP USA",
	ISP_EU: "ISP Netherlands",
	RESIDENTIAL_LITE: "Residential Lite"
}

const ALL_TARGET = "ALL" as const
const EMPTY_RESULTS: ProxyTestResult[] = []
const CURRENT_PROXY_TEST_TYPES = new Set<ProxyTestType>([
	"RESIDENT_PREMIUM",
	"MOBILE",
	"PREMIUM_RESIDENTIAL",
	"ISP_USA",
	"ISP_EU",
	"RESIDENTIAL_LITE"
])

function formatBytes(bytes: number) {
	if (!bytes) return "0 B"
	const units = ["B", "KB", "MB", "GB"]
	const index = Math.min(
		Math.floor(Math.log(bytes) / Math.log(1024)),
		units.length - 1
	)
	return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 2)} ${units[index]}`
}

function formatLatency(ms: number | null) {
	return ms === null ? "—" : `${ms} ms`
}

function statusLabel(status: ProxyTestResult["status"]) {
	if (status === "ok") return "Работает"
	if (status === "running") return "Проверяется"
	if (status === "failed") return "Ошибка"
	if (status === "unavailable") return "Нет образца"
	return "В очереди"
}

function statusClass(status: ProxyTestResult["status"]) {
	if (status === "ok")
		return "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20"
	if (status === "running")
		return "bg-[#6aa5ff]/10 text-[#9cc3ff] ring-[#6aa5ff]/20"
	if (status === "failed")
		return "bg-rose-400/10 text-rose-300 ring-rose-400/20"
	if (status === "unavailable")
		return "bg-amber-400/10 text-amber-200 ring-amber-400/20"
	return "bg-white/[0.06] text-white/50 ring-white/10"
}

function ResultIcon({ status }: { status: ProxyTestResult["status"] }) {
	if (status === "ok")
		return <CheckCircle2 className="h-5 w-5 text-emerald-300" />
	if (status === "failed")
		return <XCircle className="h-5 w-5 text-rose-300" />
	if (status === "unavailable")
		return <AlertTriangle className="h-5 w-5 text-amber-200" />
	if (status === "running")
		return <LoaderCircle className="h-5 w-5 animate-spin text-[#9cc3ff]" />
	return <CircleDot className="h-5 w-5 text-white/35" />
}

const ProxyTests: FC = () => {
	const [runId, setRunId] = useState<string | null>(null)
	const [polling, setPolling] = useState(false)
	const [form, setForm] = useState<CreateProxyTestDto>({
		target: ALL_TARGET,
		country: "",
		samplesPerTariff: 1,
		sizeMb: 1,
		concurrency: 2
	})

	const catalogQuery = useQuery({
		queryKey: ["admin-proxy-test-catalog"],
		queryFn: () => adminService.getProxyTestCatalog(),
		staleTime: 30_000
	})

	const currentRunQuery = useQuery({
		queryKey: ["admin-proxy-test-current"],
		queryFn: () => adminService.getCurrentProxyTest(),
		staleTime: 0,
		refetchOnWindowFocus: true
	})

	const runQuery = useQuery({
		queryKey: ["admin-proxy-test-run", runId],
		queryFn: () => adminService.getProxyTestRun(runId as string),
		enabled: Boolean(runId),
		refetchInterval: polling ? 1_500 : false
	})

	useEffect(() => {
		if (!runId && currentRunQuery.data?.id) {
			setRunId(currentRunQuery.data.id)
			setPolling(
				currentRunQuery.data.status === "queued" ||
					currentRunQuery.data.status === "running"
			)
		}
	}, [currentRunQuery.data, runId])

	const startMutation = useMutation({
		mutationFn: (dto: CreateProxyTestDto) =>
			adminService.createProxyTest(dto),
		onSuccess: run => {
			setRunId(run.id)
			setPolling(true)
			toast.success("Проверка запущена через gateway")
		},
		onError: async error => {
			if (error.message.includes("Проверка уже выполняется")) {
				const current = await currentRunQuery.refetch()
				if (current.data?.id) {
					setRunId(current.data.id)
					setPolling(
						current.data.status === "queued" ||
							current.data.status === "running"
					)
				}
				return
			}
			toast.error(error.message)
		}
	})

	const run = runQuery.data ?? currentRunQuery.data ?? undefined
	const isRunning =
		startMutation.isPending ||
		polling ||
		run?.status === "queued" ||
		run?.status === "running"

	useEffect(() => {
		if (!run) return
		setPolling(run.status === "queued" || run.status === "running")
	}, [run])

	const allResults = run?.results ?? EMPTY_RESULTS
	const results = allResults.filter(result =>
		CURRENT_PROXY_TEST_TYPES.has(result.type)
	)
	const hiddenLegacyResults = allResults.length - results.length
	const summary = useMemo(() => {
		const passed = results.filter(item => item.status === "ok").length
		const failed = results.filter(item => item.status === "failed").length
		const measured = results.filter(item => item.latencyMs !== null)
		const latency = measured.length
			? Math.round(
					measured.reduce(
						(total, item) => total + (item.latencyMs ?? 0),
						0
					) / measured.length
				)
			: null
		const gatewayBytes = results.reduce(
			(total, item) => total + item.gatewayInBytes + item.gatewayOutBytes,
			0
		)
		const reportedBytes = results.reduce(
			(total, item) => total + item.gatewayReportedBytes,
			0
		)
		return { passed, failed, latency, gatewayBytes, reportedBytes }
	}, [results])
	const finishedResults = results.filter(item =>
		["ok", "failed", "unavailable"].includes(item.status)
	).length
	const progress = results.length
		? Math.round((finishedResults / results.length) * 100)
		: 0
	const runStatusText =
		run?.status === "completed"
			? "Проверка завершена"
			: run?.status === "failed"
				? "Проверка завершилась с ошибкой"
				: run?.status === "queued"
					? "Проверка в очереди"
					: "Проверка выполняется"

	const catalog = catalogQuery.data?.types ?? []
	const typeLabel = (type: ProxyTestType) =>
		catalog.find(item => item.type === type)?.label ?? FALLBACK_LABELS[type]

	const submit = () => {
		if (isRunning) return
		startMutation.mutate({
			...form,
			country: form.country?.trim().toUpperCase() || undefined
		})
	}

	return (
		<div className="relative z-[1] flex w-full flex-col gap-6">
			<div className="flex flex-col gap-2">
				<p className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-[#6aa5ff] uppercase">
					<Zap className="h-4 w-4" />
					Gateway QA console
				</p>
				<div className="flex flex-wrap items-end justify-between gap-4">
					<div>
						<h1 className="font-[TalosDisplay] text-4xl font-semibold text-white md:text-5xl">
							Проверка прокси
						</h1>
						<p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
							Проверяйте тарифы реальным запросом через активный
							gateway: задержка, скорость, внешний IP и
							фактический расход байтов.
						</p>
					</div>
					{run ? (
						<span className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-2 text-xs text-white/55 ring-1 ring-white/10">
							<Server className="h-3.5 w-3.5 text-[#6aa5ff]" />
							Gateway {run.gatewayHost}
						</span>
					) : null}
				</div>
			</div>

			<AdminNav active="/admin/proxy-tests" />

			{run ? (
				<div
					className={`rounded-2xl border px-4 py-3.5 shadow-[0_18px_50px_rgba(0,0,0,0.14)] md:px-5 ${
						isRunning
							? "border-[#6aa5ff]/25 bg-[#102552]/70"
							: run.status === "completed"
								? "border-emerald-300/15 bg-emerald-300/[0.06]"
								: "border-rose-300/15 bg-rose-300/[0.06]"
					}`}
					role="status"
					aria-live="polite"
				>
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="flex min-w-0 items-center gap-3">
							<div
								className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
									isRunning
										? "bg-[#6aa5ff]/15 text-[#9cc3ff]"
										: run.status === "completed"
											? "bg-emerald-300/10 text-emerald-300"
											: "bg-rose-300/10 text-rose-300"
								}`}
							>
								{isRunning ? (
									<LoaderCircle className="h-4.5 w-4.5 animate-spin" />
								) : run.status === "completed" ? (
									<CheckCircle2 className="h-4.5 w-4.5" />
								) : (
									<XCircle className="h-4.5 w-4.5" />
								)}
							</div>
							<div className="min-w-0">
								<div className="flex flex-wrap items-center gap-2">
									<p className="text-sm font-semibold text-white">
										{runStatusText}
									</p>
									<span className="rounded-full bg-white/[0.07] px-2 py-1 text-[11px] text-white/55 ring-1 ring-white/[0.08]">
										{finishedResults} из{" "}
										{results.length || "—"}
									</span>
								</div>
								<p className="mt-0.5 text-xs text-white/45">
									{isRunning
										? "Состояние сохраняется автоматически — перезагрузка страницы не прервёт отображение прогона"
										: run.error ||
											"Результаты доступны в этом окне в течение часа"}
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2 text-xs text-white/45">
							<Clock3 className="h-3.5 w-3.5 text-white/35" />
							{run.sizeMb} MB · {run.concurrency} потока
						</div>
					</div>
					<div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
						<div
							className={`h-full rounded-full transition-[width] duration-500 ${
								isRunning
									? "bg-[#6aa5ff]"
									: run.status === "completed"
										? "bg-emerald-300"
										: "bg-rose-300"
							}`}
							style={{
								width: `${Math.max(progress, isRunning && results.length ? 4 : 0)}%`
							}}
						/>
					</div>
				</div>
			) : null}

			<div className="grid gap-5 xl:grid-cols-[minmax(360px,0.78fr)_minmax(0,1.55fr)] 2xl:grid-cols-[minmax(400px,0.85fr)_minmax(0,1.55fr)]">
				<Card className="!items-stretch !gap-5 !border-[#6aa5ff]/20 !bg-[radial-gradient(circle_at_top_right,rgba(47,107,255,0.18),transparent_48%),linear-gradient(145deg,rgba(14,24,48,0.98),rgba(6,13,28,0.98))]">
					<div className="flex items-start gap-3">
						<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#2f6bff]/15 text-[#83b4ff] ring-1 ring-[#6aa5ff]/25">
							<ShieldCheck className="h-5 w-5" />
						</div>
						<div>
							<h2 className="font-[TalosDisplay] text-2xl font-semibold text-white">
								Безопасный QA-прогон
							</h2>
							<p className="mt-1 text-sm leading-5 text-white/45">
								Трафик идёт через временный логин агента и не
								списывается с пользователей.
							</p>
						</div>
					</div>

					<div className="grid gap-3 sm:grid-cols-2">
						<label className="flex flex-col gap-2 text-sm text-white/55">
							<span>Что проверяем</span>
							<Select
								value={form.target}
								onChange={target =>
									setForm(prev => ({
										...prev,
										target: target as ProxyTestTarget
									}))
								}
								ariaLabel="Выбор тарифа"
							>
								<Select.Option value={ALL_TARGET}>
									Все тарифы
								</Select.Option>
								{catalog.map(item => (
									<Select.Option
										key={item.type}
										value={item.type}
									>
										<span>{item.label}</span>
										{!item.safeQaAvailable ? (
											<span className="rounded-full bg-amber-300/10 px-2 py-0.5 text-[10px] text-amber-200/80">
												нет образца
											</span>
										) : null}
									</Select.Option>
								))}
							</Select>
						</label>

						<label className="flex flex-col gap-2 text-sm text-white/55">
							<span>Гео для универсальных тарифов</span>
							<Input
								value={form.country}
								onChange={event =>
									setForm(prev => ({
										...prev,
										country: event.target.value
											.toUpperCase()
											.slice(0, 2)
									}))
								}
								placeholder="US"
								maxLength={2}
								className="uppercase"
							/>
							<span className="text-xs text-white/35">
								ISO-2. Для ISP EU используется NL, для ISP USA —
								US.
							</span>
						</label>

						<label className="flex flex-col gap-2 text-sm text-white/55">
							<span>Трафик на один образец</span>
							<Select
								value={String(form.sizeMb)}
								onChange={value =>
									setForm(prev => ({
										...prev,
										sizeMb: Number(value)
									}))
								}
								ariaLabel="Размер тестового трафика"
							>
								{[0.25, 0.5, 1, 5, 10, 25].map(size => (
									<Select.Option
										key={size}
										value={String(size)}
									>
										{size} MB
									</Select.Option>
								))}
							</Select>
						</label>

						<div className="grid grid-cols-2 gap-3">
							<label className="flex min-w-0 flex-col gap-2 text-sm text-white/55">
								<span>Образцов тарифа</span>
								<Select
									value={String(form.samplesPerTariff)}
									onChange={value =>
										setForm(prev => ({
											...prev,
											samplesPerTariff: Number(value)
										}))
									}
									size="small"
									ariaLabel="Количество образцов"
								>
									{[1, 2, 3].map(value => (
										<Select.Option
											key={value}
											value={String(value)}
										>
											{value} шт.
										</Select.Option>
									))}
								</Select>
							</label>
							<label className="flex min-w-0 flex-col gap-2 text-sm text-white/55">
								<span>Параллельность</span>
								<Select
									value={String(form.concurrency)}
									onChange={value =>
										setForm(prev => ({
											...prev,
											concurrency: Number(value)
										}))
									}
									size="small"
									ariaLabel="Параллельность теста"
								>
									{[1, 2, 4].map(value => (
										<Select.Option
											key={value}
											value={String(value)}
										>
											{value} потока
										</Select.Option>
									))}
								</Select>
							</label>
						</div>
					</div>

					<div className="grid gap-3 sm:grid-cols-3">
						<div className="rounded-2xl border border-white/[0.08] bg-black/15 p-3">
							<div className="flex items-center gap-2 text-xs tracking-[0.12em] text-white/35 uppercase">
								<ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />{" "}
								Баланс
							</div>
							<p className="mt-2 text-sm font-semibold text-emerald-200">
								Не затрагивается
							</p>
						</div>
						<div className="rounded-2xl border border-white/[0.08] bg-black/15 p-3">
							<div className="flex items-center gap-2 text-xs tracking-[0.12em] text-white/35 uppercase">
								<Database className="h-3.5 w-3.5 text-[#83b4ff]" />{" "}
								Учёт
							</div>
							<p className="mt-2 text-sm font-semibold text-white">
								На gateway
							</p>
						</div>
						<div className="rounded-2xl border border-white/[0.08] bg-black/15 p-3">
							<div className="flex items-center gap-2 text-xs tracking-[0.12em] text-white/35 uppercase">
								<Timer className="h-3.5 w-3.5 text-[#83b4ff]" />{" "}
								Ограничение
							</div>
							<p className="mt-2 text-sm font-semibold text-white">
								25 MB / образец
							</p>
						</div>
					</div>

					<Button
						variant="fill"
						type="button"
						onClick={submit}
						disabled={Boolean(isRunning) || catalogQuery.isLoading}
						className="!h-12 !rounded-2xl !text-base"
					>
						{isRunning ? (
							<LoaderCircle className="h-5 w-5 animate-spin" />
						) : (
							<Play className="h-5 w-5" />
						)}
						{isRunning
							? "Проверка выполняется"
							: "Запустить проверку"}
					</Button>
				</Card>

				<div className="flex min-w-0 flex-col gap-5">
					<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
						{[
							{
								label: "Прошли",
								value: summary.passed,
								icon: CheckCircle2,
								color: "text-emerald-300"
							},
							{
								label: "Ошибки",
								value: summary.failed,
								icon: AlertTriangle,
								color: "text-rose-300"
							},
							{
								label: "Средний ping",
								value: formatLatency(summary.latency),
								icon: Gauge,
								color: "text-[#9cc3ff]"
							},
							{
								label: "Расход gateway",
								value: formatBytes(summary.gatewayBytes),
								icon: Activity,
								color: "text-[#9cc3ff]"
							}
						].map(item => {
							const Icon = item.icon
							return (
								<Card
									key={item.label}
									className="!items-start !gap-2 !px-4 !py-4"
								>
									<Icon className={`h-4 w-4 ${item.color}`} />
									<p className="text-xs text-white/40">
										{item.label}
									</p>
									<p className="truncate text-lg font-semibold text-white">
										{item.value}
									</p>
								</Card>
							)
						})}
					</div>

					<Card className="!items-stretch !gap-4 !overflow-hidden !p-0">
						<div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4 md:px-6">
							<div>
								<h2 className="font-[TalosDisplay] text-2xl font-semibold text-white">
									Результаты прогона
								</h2>
								<p className="mt-1 text-sm text-white/40">
									{run
										? `${results.length} актуальных образцов · ${run.sizeMb} MB каждый · ${run.status === "completed" ? "завершено" : "обновляется"}${hiddenLegacyResults ? ` · ${hiddenLegacyResults} архивных скрыто` : ""}`
										: "Запустите проверку, чтобы увидеть живые метрики"}
								</p>
							</div>
							{run ? (
								<div className="flex items-center gap-2 text-xs text-white/45">
									<RefreshCw
										className={`h-3.5 w-3.5 ${isRunning ? "animate-spin text-[#83b4ff]" : "text-white/30"}`}
									/>
									{isRunning
										? "live"
										: `report ${formatBytes(summary.reportedBytes)}`}
								</div>
							) : null}
						</div>

						{catalogQuery.isLoading ? (
							<div className="flex justify-center py-16">
								<Loader weight={5} size={52} />
							</div>
						) : results.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
								<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#6aa5ff]/10 text-[#83b4ff] ring-1 ring-[#6aa5ff]/20">
									<Globe2 className="h-6 w-6" />
								</div>
								<p className="text-base font-semibold text-white">
									Готово к проверке
								</p>
								<p className="max-w-md text-sm leading-6 text-white/40">
									Каждый образец будет подключён к gateway
									временным QA-логином, измерен и заблокирован
									после теста.
								</p>
							</div>
						) : (
							<div className="divide-y divide-white/[0.06]">
								{results.map(result => (
									<div
										key={result.id}
										className="flex flex-col gap-4 px-5 py-4 transition-colors hover:bg-white/[0.025] md:px-6 lg:grid lg:grid-cols-[minmax(170px,1.2fr)_minmax(0,1fr)_auto] lg:items-center"
									>
										<div className="flex min-w-0 items-center gap-3">
											<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.045] ring-1 ring-white/[0.08]">
												<ResultIcon
													status={result.status}
												/>
											</div>
											<div className="min-w-0">
												<div className="flex flex-wrap items-center gap-2">
													<p className="truncate font-semibold text-white">
														{result.label ||
															typeLabel(
																result.type
															)}
													</p>
													<span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] tracking-[0.12em] text-white/35 uppercase">
														{result.country}
													</span>
												</div>
												<p className="mt-1 flex items-center gap-1.5 text-xs text-white/35">
													<NetworkIcon
														source={result.source}
													/>{" "}
													{result.source ===
													"provider"
														? "QA upstream"
														: "ACTIVE образец"}
												</p>
											</div>
										</div>
										<div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 2xl:grid-cols-5">
											<div>
												<p className="text-xs text-white/35">
													Статус
												</p>
												<span
													className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ${statusClass(result.status)}`}
												>
													{statusLabel(result.status)}
												</span>
											</div>
											<div>
												<p className="text-xs text-white/35">
													Ping / speed
												</p>
												<p className="mt-1 font-medium text-white/80">
													{formatLatency(
														result.latencyMs
													)}{" "}
													<span className="text-white/35">
														·
													</span>{" "}
													{result.mbps === null
														? "—"
														: `${result.mbps} Mbps`}
												</p>
											</div>
											<div>
												<p className="text-xs text-white/35">
													Gateway bytes
												</p>
												<p className="mt-1 font-medium text-white/80">
													{formatBytes(
														result.gatewayInBytes +
															result.gatewayOutBytes
													)}
												</p>
											</div>
											<div>
												<p className="text-xs text-white/35">
													Backend ACK
												</p>
												<p className="mt-1 font-medium text-white/80">
													{formatBytes(
														result.gatewayReportedBytes
													)}
												</p>
											</div>
											<div>
												<p className="text-xs text-white/35">
													Списание БД
												</p>
												<p
													className={`mt-1 font-medium ${result.billingVerified === false ? "text-rose-200" : result.billingVerified ? "text-emerald-200" : "text-white/50"}`}
												>
													{result.billedBytes === null
														? "не применимо"
														: formatBytes(
																result.billedBytes
															)}
												</p>
											</div>
										</div>
										<div className="flex items-center justify-start gap-2 lg:justify-end">
											{result.exitIp ? (
												<span className="rounded-lg bg-white/[0.04] px-2.5 py-2 font-mono text-xs text-white/45">
													{result.exitIp}
												</span>
											) : null}
											{result.error ? (
												<span className="max-w-[260px] text-right text-xs leading-5 text-rose-200/70">
													{result.error}
												</span>
											) : null}
										</div>
									</div>
								))}
							</div>
						)}
					</Card>
				</div>
			</div>
		</div>
	)
}

const NetworkIcon: FC<{ source: ProxyTestResult["source"] }> = ({ source }) =>
	source === "provider" ? (
		<Zap className="h-3.5 w-3.5 text-[#83b4ff]" />
	) : (
		<Database className="h-3.5 w-3.5 text-white/30" />
	)

export default ProxyTests
