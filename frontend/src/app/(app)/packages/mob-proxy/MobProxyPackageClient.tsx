"use client"

import { usePathname, useRouter } from "next/navigation"
import { getLocaleFromPath, addLocaleToPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"
import { useState, useEffect, useRef, useMemo } from "react"
import { AlertCircle } from "lucide-react"
import Select from "@/shared/components/ui/Select"
import Input from "@/shared/components/ui/Input"
import type { Package } from "@/features/packages/types/packages.types"
import type { User } from "@/features/user/types/user.types"
import type { Prices, Plan } from "@/features/proxy/types/proxy.types"
import { useMyPackages } from "@/features/packages/hooks/useMyPackages"
import { userService } from "@/features/user/services/user.service"
import { packageService } from "@/features/packages/services/package.service"

// Функция для рендеринга звездного рейтинга
function renderStars(rating: number) {
	const stars = []
	for (let i = 1; i <= 5; i++) {
		stars.push(
			<path
				key={i}
				opacity={i <= rating ? 1 : 0.3}
				d={`M${6 + (i-1)*16}.33423 1.64893C${6.53214 + (i-1)*16} 1.00362 ${7.46786 + (i-1)*16} 1.00362 ${7.66577 + (i-1)*16} 1.64893L${8.38059 + (i-1)*16} 3.75309C${8.4804 + (i-1)*16} 4.05753 ${8.76245 + (i-1)*16} 4.26337 ${9.08455 + (i-1)*16} 4.26337H${11.332 + (i-1)*16}C${11.9938 + (i-1)*16} 4.26337 ${12.2679 + (i-1)*16} 5.11108 ${11.7332 + (i-1)*16} 5.50309L${9.96755 + (i-1)*16} 6.78801C${9.70131 + (i-1)*16} 6.98157 ${9.58978 + (i-1)*16} 7.32679 ${9.68959 + (i-1)*16} 7.63123L${10.4044 + (i-1)*16} 9.73539C${10.6023 + (i-1)*16} 10.3807 ${9.90447 + (i-1)*16} 10.9189 ${9.36974 + (i-1)*16} 10.5269L${7.60408 + (i-1)*16} 9.24198C${7.33784 + (i-1)*16} 9.04842 ${6.66216 + (i-1)*16} 9.04842 ${6.39592 + (i-1)*16} 9.24198L${4.63026 + (i-1)*16} 10.5269C${4.09553 + (i-1)*16} 10.9189 ${3.39767 + (i-1)*16} 10.3807 ${3.59558 + (i-1)*16} 9.73539L${4.31041 + (i-1)*16} 7.63123C${4.41022 + (i-1)*16} 7.32679 ${4.29869 + (i-1)*16} 6.98157 ${4.03245 + (i-1)*16} 6.78801L${2.26682 + (i-1)*16} 5.50309C${1.73209 + (i-1)*16} 5.11108 ${2.00625 + (i-1)*16} 4.26337 ${2.66801 + (i-1)*16} 4.26337H${4.91545 + (i-1)*16}C${5.23755 + (i-1)*16} 4.26337 ${5.5196 + (i-1)*16} 4.05753 ${5.61941 + (i-1)*16} 3.75309L${6.33423 + (i-1)*16} 1.64893Z`}
				fill="#FFFFFF"
			/>
		)
	}
	return stars
}

// Тип для прокси
type ProxyItem = {
	region: string
	host: string
	port: string
	login: string
	password: string
}

// Тестовые данные прокси
const testProxies: ProxyItem[] = [
	{
		region: "США",
		host: "proxy1.example.com",
		port: "8080",
		login: "user1",
		password: "pass123"
	},
	{
		region: "Германия",
		host: "proxy2.example.com",
		port: "3128",
		login: "user2",
		password: "pass456"
	},
	{
		region: "Великобритания",
		host: "proxy3.example.com",
		port: "8888",
		login: "user3",
		password: "pass789"
	},
	{
		region: "Франция",
		host: "proxy4.example.com",
		port: "1080",
		login: "user4",
		password: "pass012"
	},
	{
		region: "Япония",
		host: "proxy5.example.com",
		port: "8080",
		login: "user5",
		password: "pass345"
	}
]

// Компонент переключателя формата (как переключатель языков из Header)
function FormatSwitcher({
	options,
	value,
	onChange
}: {
	options: string[]
	value: string
	onChange: (val: string) => void
}) {
	const [active, setActive] = useState(value)

	useEffect(() => {
		if (value && value !== active) {
			setActive(value)
		}
	}, [value, active])

	const handleClick = (opt: string) => {
		setActive(opt)
		onChange(opt)
	}

	return (
		<div
			className="flex items-center rounded-xl border border-white/20 p-1 flex-1"
			style={{ background: 'transparent' }}
		>
			{options.map(opt => (
				<button
					key={opt}
					onClick={() => handleClick(opt)}
					type="button"
					className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
						active === opt
							? "bg-white/20 text-white"
							: "text-white hover:bg-white/10"
					}`}
				>
					{opt}
				</button>
			))}
		</div>
	)
}

type MobProxyPackageClientProps = {
	packageData?: Package
	user?: User | null
	prices?: Prices | null
	plans?: Plan[]
}

export default function MobProxyPackageClient({ packageData, user: initialUser, prices, plans = [] }: MobProxyPackageClientProps) {
	const pathname = usePathname()
	const router = useRouter()
	const currentLocale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, currentLocale)
	const { userPackages, isLoading } = useMyPackages()
	
	// Состояние для хранения актуальных данных пользователя
	const [user, setUser] = useState<User | null>(initialUser ?? null)
	
	// Обновление данных пользователя раз в минуту
	useEffect(() => {
		if (!initialUser) return
		
		// Функция для обновления данных пользователя
		const updateUserData = async () => {
			try {
				const updatedUser = await userService.getMe()
				setUser(updatedUser)
			} catch (error) {
				console.error("Ошибка при обновлении данных пользователя:", error)
				// При ошибке не обновляем состояние, чтобы не потерять текущие данные
			}
		}
		
		// Обновляем сразу при монтировании компонента
		updateUserData()
		
		// Устанавливаем интервал для обновления каждую минуту
		const interval = setInterval(updateUserData, 60000) // 60000 мс = 1 минута
		
		// Очищаем интервал при размонтировании компонента
		return () => clearInterval(interval)
	}, [initialUser])
	
	// Найти activeProxies для текущего пакета
	// packageData.id теперь это userPackage.id (так как мы передаем userPackage.id как packageData.id)
	const currentUserPackage = Array.isArray(userPackages) && packageData ? userPackages.find(up => up.id === packageData.id) : null
	const activeProxies = currentUserPackage?.activeProxies || []
	
	// Преобразуем реальные прокси в формат ProxyItem
	const realProxies: ProxyItem[] = useMemo(() => {
		if (!activeProxies || activeProxies.length === 0) {
			return []
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return activeProxies.map((proxy: any) => ({
			region: proxy.country || proxy.serverHost || "",
			host: proxy.host || proxy.serverHost || "",
			port: String(proxy.port ?? ""),
			login: proxy.login || proxy.username || "",
			password: proxy.password || ""
		}))
	}, [activeProxies])
	
	// Используем реальные прокси, если они есть, иначе тестовые
	const [proxies, setProxies] = useState<ProxyItem[]>([])
	
	// Обновляем прокси при загрузке данных или изменении activeProxies
	useEffect(() => {
		if (!isLoading) {
			// Всегда используем реальные прокси, если они есть
			if (realProxies.length > 0) {
				setProxies(realProxies)
			} else {
				// Если нет реальных прокси, показываем пустой список (не тестовые)
				setProxies([])
			}
		}
	}, [realProxies, isLoading])
	const [displayFormat, setDisplayFormat] = useState<string>("ip:port:login:password") // Для FormatSwitcher во втором блоке
	const [proxyFormat, setProxyFormat] = useState<string>("ip:port:login:password") // Для селекта в третьем блоке и списка прокси
	const [proxyCount, setProxyCount] = useState<string>("10")
	const [fileFormat, setFileFormat] = useState<string>("txt")
	const [csvDelimiter, setCsvDelimiter] = useState<string>(";") // Разделитель для CSV

	// Форматирование прокси в выбранном формате
	const formatProxy = (proxy: ProxyItem, format: string): string => {
		if (format === "ip:port:login:password") {
			return `${proxy.host}:${proxy.port}:${proxy.login}:${proxy.password}`
		} else {
			return `${proxy.login}:${proxy.password}@${proxy.host}:${proxy.port}`
		}
	}

	// Копирование прокси в буфер обмена
	const copyProxy = (proxy: ProxyItem) => {
		const formatted = formatProxy(proxy, proxyFormat)
		navigator.clipboard.writeText(formatted)
	}

	// Копирование всех прокси
	const copyAllProxies = () => {
		const allProxies = proxies.map(p => formatProxy(p, proxyFormat)).join("\n")
		navigator.clipboard.writeText(allProxies)
	}

	// Скачивание прокси в выбранном формате
	const downloadProxies = () => {
		if (proxies.length === 0) return

		let content = ""
		let mimeType = ""
		let extension = ""

		if (fileFormat === "txt") {
			content = proxies.map(p => formatProxy(p, proxyFormat)).join("\n")
			mimeType = "text/plain"
			extension = "txt"
		} else if (fileFormat === "json") {
			content = JSON.stringify(
				proxies.map(p => ({
					host: p.host,
					port: p.port,
					login: p.login,
					password: p.password,
					formatted: formatProxy(p, proxyFormat)
				})),
				null,
				2
			)
			mimeType = "application/json"
			extension = "json"
		} else if (fileFormat === "csv") {
			// Определяем порядок параметров в зависимости от формата
			let headers: string[]
			let rows: string[][]
			
			if (proxyFormat === "ip:port:login:password") {
				headers = ["Host", "Port", "Login", "Password"]
				rows = proxies.map(p => [p.host, p.port, p.login, p.password])
			} else {
				// login:password@ip:port
				headers = ["Login", "Password", "Host", "Port"]
				rows = proxies.map(p => [p.login, p.password, p.host, p.port])
			}
			
			content = [headers, ...rows].map(row => row.join(csvDelimiter)).join("\n")
			mimeType = "text/csv"
			extension = "csv"
		}

		const blob = new Blob([content], { type: mimeType })
		const url = URL.createObjectURL(blob)
		const link = document.createElement("a")
		link.href = url
		link.download = `proxies.${extension}`
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)
		URL.revokeObjectURL(url)
	}

	// Генерация прокси
	const [isGenerating, setIsGenerating] = useState(false)
	const [generationError, setGenerationError] = useState("")
	
	// Ротация IP
	const [isRotating, setIsRotating] = useState(false)
	const [rotationError, setRotationError] = useState("")
	const [rotationSuccess, setRotationSuccess] = useState(false)
	
	const rotateAllProxies = async () => {
		if (!currentUserPackage || !packageData) return
		
		setIsRotating(true)
		setRotationError("")
		setRotationSuccess(false)
		
		try {
			const result = await packageService.refreshAllPackageProxies(packageData.id)
			
			if (result.success) {
				setRotationSuccess(true)
				// Обновляем список прокси через перезагрузку страницы
				setTimeout(() => {
					window.location.reload()
				}, 2000)
			} else {
				setRotationError(T("package.rotationError"))
			}
		} catch (error: unknown) {
			setRotationError((error as Error).message || T("package.rotationError"))
		} finally {
			setIsRotating(false)
		}
	}
	
	const generateProxies = async () => {
		if (!currentUserPackage || !packageData) return
		
		// Проверяем, не истекло ли время пакета
		if (remainingTime && remainingTime.expired) {
			setGenerationError(T("package.timeExpired"))
			return
		}
		
		const count = parseInt(proxyCount) || 1
		if (count < 1 || count > 1000) {
			setGenerationError(T("package.quantityError"))
			return
		}
		
		setIsGenerating(true)
		setGenerationError("")
		
		try {
			// Для MOBILE прокси location не требуется, так как страна и оператор сохранены в planId пакета
			const result = await packageService.generatePackageProxy(packageData.id, {
				quantity: count,
			})
			
			// Обновляем список пакетов для получения новых прокси
			// Используем queryClient для инвалидации кэша
			window.location.reload() // Временное решение, лучше использовать queryClient.invalidateQueries
		} catch (error: unknown) {
			setGenerationError((error as Error).message || T("package.generationError"))
		} finally {
			setIsGenerating(false)
		}
	}
	
	// Состояние для текущего времени (для таймера)
	const [currentTime, setCurrentTime] = useState(new Date())
	
	// Обновляем текущее время каждую секунду
	useEffect(() => {
		const interval = setInterval(() => {
			setCurrentTime(new Date())
		}, 1000)
		
		return () => clearInterval(interval)
	}, [])
	
	// Вычисляем оставшееся время аренды
	const remainingTime = useMemo(() => {
		if (!currentUserPackage) return null
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const pkg = currentUserPackage as any
		if (!pkg.rentTime || !pkg.createdAt) return null
		
		const createdAt = new Date(pkg.createdAt)
		const expirationTime = new Date(createdAt.getTime() + pkg.rentTime * 1000)
		const diff = expirationTime.getTime() - currentTime.getTime()
		
		if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }
		
		const totalSeconds = Math.floor(diff / 1000)
		const days = Math.floor(totalSeconds / 86400)
		const hours = Math.floor((totalSeconds % 86400) / 3600)
		const minutes = Math.floor((totalSeconds % 3600) / 60)
		const seconds = totalSeconds % 60
		
		return { days, hours, minutes, seconds, expired: false }
	}, [currentUserPackage, currentTime])
	
	// Форматирование оставшегося времени
	const formatRemainingTime = () => {
		if (!remainingTime) return T("package.notSpecified")
		if (remainingTime.expired) return T("package.timeExpired")
		
		const parts: string[] = []
		if (remainingTime.days > 0) parts.push(`${remainingTime.days} ${T("package.daysShort")}`)
		if (remainingTime.hours > 0) parts.push(`${remainingTime.hours} ${T("package.hoursShort")}`)
		if (remainingTime.minutes > 0) parts.push(`${remainingTime.minutes} ${T("package.minutesShort")}`)
		if (remainingTime.seconds > 0 || parts.length === 0) parts.push(`${remainingTime.seconds} ${T("package.secondsShort")}`)
		
		return parts.join(" : ")
	}

	// Если packageData не передан, показываем сообщение
	if (!packageData) {
		return <div>{T("package.notFound")}</div>
	}

	return (
		<main className="mob-proxy-package">
			<div className="mob-proxy-package__container">
				{/* Заголовок страницы */}
				<h1 className="mob-proxy-package__title">{T("package.title")}</h1>

				{/* Блок с данными и кнопками - первый блок с синим фоном */}
				<div className="mob-proxy-package__main-block">
					{/* Левая часть - данные о прокси */}
					<div className="mob-proxy-package__data">
						{/* Блок с текстом и звездами */}
						<div className="proxy-package-badge">
							<span className="badge-text">{T("package.quality")}</span>
							<div className="rating-stars">
								<svg width="80" height="16" viewBox="0 0 80 16" fill="none" xmlns="http://www.w3.org/2000/svg">
									{renderStars(4)}
								</svg>
							</div>
						</div>

						{/* Заголовок прокси */}
						<h3 className="proxy-package-title">{T("package.packageTypes.mobile")}</h3>

						{/* Таблица данных в один ряд через дивы */}
						<div className="proxy-package-data">
							{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
							{currentUserPackage && (currentUserPackage as any).planId && (
								<>
									{(() => {
										// eslint-disable-next-line @typescript-eslint/no-explicit-any
										const plan = plans.find(p => p.id === (currentUserPackage as any).planId)
										if (!plan) return null
										return (
											<>
												<div className="data-row">
													<span className="data-label">{T("payment.country")}</span>
													<span className="data-value">{plan.countryCode.toUpperCase()}</span>
												</div>
												<div className="data-row">
													<span className="data-label">{T("payment.operator")}</span>
													<span className="data-value">{plan.name}</span>
												</div>
											</>
										)
									})()}
								</>
							)}
							<div className="data-row">
								<span className="data-label">{T("package.status")}</span>
								{remainingTime && !remainingTime.expired ? (
									<span className="data-value">{T("package.active")}</span>
								) : (
									<span className="data-value" style={{
										display: "inline-flex",
										alignItems: "center",
										justifyContent: "center",
										gap: "6px",
										backgroundColor: "#FFD964",
										color: "#222222",
										padding: "0 10px",
										height: "24px",
										borderRadius: "8px",
										fontSize: "12px",
										fontWeight: 500,
										lineHeight: "1.3",
										letterSpacing: "-0.01em"
									}}>
										<AlertCircle size={16} style={{ opacity: 0.5 }} />
										{T("package.timeExpired")}
									</span>
								)}
							</div>
						</div>
					</div>

					{/* Правая часть - время аренды и кнопка */}
					<div className="mob-proxy-package__actions">
						<div className="mob-proxy-package__rental-time">
							<div className="mob-proxy-package__rental-label">
								<span className="mob-proxy-package__rental-label-text">{T("package.timeLeftLabel")}</span>
								<span className="mob-proxy-package__rental-value">{formatRemainingTime()}</span>
							</div>
						</div>
						<button 
							className="mob-proxy-package__action-btn"
							onClick={() => {
								const locale = getLocaleFromPath(pathname)
								router.push(addLocaleToPath(`/payment-time?packageId=${packageData!.id}`, locale))
							}}
						>
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<circle cx="15.25" cy="11" r="7" fill="white"/>
								<path d="M12.25 1C10.0744 1 7.94767 1.64514 6.13873 2.85383C4.32979 4.06253 2.91989 5.78049 2.08733 7.79048C1.25477 9.80047 1.03693 12.0122 1.46137 14.146C1.8858 16.2798 2.93345 18.2398 4.47183 19.7782C6.01021 21.3166 7.97022 22.3642 10.104 22.7886C12.2378 23.2131 14.4495 22.9952 16.4595 22.1627C18.4695 21.3301 20.1875 19.9202 21.3962 18.1113C22.6049 16.3023 23.25 14.1756 23.25 12C23.2466 9.08367 22.0865 6.28778 20.0244 4.22563C17.9622 2.16347 15.1663 1.00344 12.25 1ZM15.957 15.707C15.7695 15.8945 15.5152 15.9998 15.25 15.9998C14.9848 15.9998 14.7305 15.8945 14.543 15.707L11.543 12.707C11.3555 12.5195 11.2501 12.2652 11.25 12V6C11.25 5.73478 11.3554 5.48043 11.5429 5.29289C11.7304 5.10536 11.9848 5 12.25 5C12.5152 5 12.7696 5.10536 12.9571 5.29289C13.1446 5.48043 13.25 5.73478 13.25 6V11.586L15.957 14.293C16.1445 14.4805 16.2498 14.7348 16.2498 15C16.2498 15.2652 16.1445 15.5195 15.957 15.707Z" fill="#0067FF"/>
							</svg>
							<span>{T("package.extendRent")}</span>
						</button>
					</div>
				</div>

				{/* Блок "Формат прокси" */}
				<div className="mob-proxy-package__format-block">
					<h2 className="mob-proxy-package__format-title">{T("package.proxyFormat")}</h2>
					<FormatSwitcher
						options={["ip:port:login:password", "login:password@ip:port"]}
						value={displayFormat}
						onChange={(val) => setDisplayFormat(val)}
					/>
					<button 
						className="mob-proxy-package__rotation-btn" 
						type="button"
						onClick={rotateAllProxies}
						disabled={isRotating || !remainingTime || (remainingTime && remainingTime.expired)}
					>
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
							<g clipPath="url(#clip0_385_3886)">
								<rect x="2.67188" y="3.5625" width="18.75" height="19.2188" fill="white"/>
								<path d="M19.5312 0H4.46878C2.00466 0 0 2.0047 0 4.46878V19.5312C0 21.9953 2.00466 24 4.46878 24H19.5312C21.9953 24 24 21.9953 24 19.5312V4.46878C24 2.0047 21.9953 0 19.5312 0ZM6.42534 14.6315C6.3528 14.6561 6.27671 14.6686 6.20011 14.6687C5.90681 14.6687 5.6332 14.4838 5.53406 14.1905C5.13259 13.0019 5.06552 11.7259 5.34019 10.5017C5.62256 9.24159 6.25655 8.09077 7.17356 7.1737C8.46277 5.8845 10.1768 5.17453 12 5.17453C13.3028 5.17453 14.5499 5.5373 15.626 6.21473L15.6261 5.22188C15.6261 4.83361 15.9409 4.5188 16.3292 4.5188C16.7175 4.5188 17.0323 4.83361 17.0323 5.22197L17.0322 7.67081C17.0322 7.69402 17.031 7.71717 17.0287 7.74023C17.0277 7.75078 17.0257 7.76095 17.0243 7.77136C17.0224 7.78364 17.0211 7.79597 17.0186 7.80816C17.0162 7.82016 17.013 7.83169 17.01 7.84345C17.0073 7.85395 17.005 7.8645 17.0019 7.87491C16.9984 7.88644 16.9941 7.8975 16.99 7.9088C16.9863 7.9192 16.9829 7.92961 16.9786 7.93983C16.9743 7.95037 16.9692 7.9605 16.9643 7.97077C16.9593 7.98131 16.9546 7.99191 16.9492 8.00217C16.9439 8.01216 16.9378 8.02158 16.932 8.03119C16.926 8.04122 16.9204 8.05139 16.9138 8.06114C16.9066 8.07192 16.8986 8.08209 16.8908 8.0925C16.8848 8.10047 16.8793 8.10867 16.8729 8.11645C16.8435 8.15237 16.8105 8.18528 16.7746 8.2147C16.7668 8.22112 16.7586 8.22666 16.7506 8.23266C16.7403 8.24044 16.7302 8.24841 16.7194 8.25562C16.7095 8.26223 16.6992 8.26795 16.6891 8.27405C16.6796 8.27972 16.6703 8.28572 16.6605 8.29097C16.65 8.29655 16.6393 8.30128 16.6286 8.30625C16.6185 8.31108 16.6085 8.31614 16.5982 8.32045C16.5877 8.32477 16.5771 8.32823 16.5665 8.33203C16.5555 8.33602 16.5445 8.34023 16.5332 8.34366C16.5225 8.34689 16.5116 8.34928 16.5008 8.352C16.4894 8.35486 16.4782 8.35809 16.4665 8.36039C16.4539 8.36292 16.4411 8.36442 16.4284 8.36625C16.4185 8.36761 16.4087 8.36953 16.3986 8.37056C16.3754 8.37286 16.3522 8.37403 16.3289 8.37403H13.8803C13.4919 8.37403 13.1772 8.05922 13.1772 7.67091C13.1772 7.28259 13.4919 6.96778 13.8803 6.96778H14.0179C13.3847 6.714 12.7026 6.58078 12 6.58078C10.5524 6.58078 9.19153 7.1445 8.16797 8.16806C6.69966 9.63647 6.20081 11.7716 6.86625 13.7403C6.99066 14.1081 6.79322 14.5071 6.42534 14.6315ZM18.6598 13.4983C18.3774 14.7584 17.7434 15.9092 16.8264 16.8263C15.5372 18.1155 13.8232 18.8254 12 18.8254C10.6972 18.8254 9.45019 18.4627 8.37398 17.7853L8.37408 18.7781C8.37408 19.1664 8.05927 19.4813 7.67095 19.4813C7.28264 19.4813 6.96783 19.1665 6.96783 18.7782L6.96773 16.3291V16.3291C6.96773 16.3062 6.96886 16.2833 6.97111 16.2605C6.97167 16.2546 6.97289 16.2488 6.97364 16.2428C6.9757 16.226 6.97791 16.209 6.98119 16.1923C6.98217 16.1875 6.98362 16.1829 6.98466 16.1781C6.9885 16.1603 6.99263 16.1427 6.99792 16.1253C6.99881 16.1223 7.00003 16.1195 7.00092 16.1165C7.00697 16.0976 7.01348 16.0788 7.02108 16.0604L7.02314 16.0559C7.03134 16.0364 7.0403 16.0171 7.05037 15.9982C7.05113 15.9969 7.05202 15.9956 7.05277 15.9942C7.06289 15.9756 7.07367 15.9572 7.08558 15.9394C7.08811 15.9357 7.09102 15.9322 7.09359 15.9285C7.10409 15.9135 7.11473 15.8984 7.12655 15.884C7.14127 15.8659 7.15697 15.8485 7.17361 15.8319C7.19025 15.8153 7.20773 15.7996 7.22578 15.7847C7.23848 15.7743 7.25189 15.765 7.26516 15.7556C7.27055 15.7518 7.27575 15.7475 7.28128 15.7438C7.29778 15.7328 7.3147 15.723 7.33177 15.7136C7.33467 15.712 7.3373 15.7101 7.34025 15.7086C7.35783 15.6992 7.37588 15.6909 7.39406 15.6831C7.39688 15.6819 7.39955 15.6804 7.40236 15.6793C7.41966 15.6721 7.43728 15.6661 7.45495 15.6604C7.45913 15.6592 7.46311 15.6574 7.46733 15.6561C7.48355 15.6513 7.5 15.6474 7.51655 15.6437C7.5225 15.6424 7.52831 15.6406 7.53427 15.6394C7.54945 15.6364 7.56483 15.6346 7.5802 15.6326C7.58761 15.6316 7.59492 15.6301 7.60247 15.6294C7.6208 15.6276 7.63917 15.627 7.65759 15.6266C7.66209 15.6265 7.66641 15.626 7.67086 15.626L10.1199 15.6261C10.5082 15.6261 10.823 15.9409 10.823 16.3292C10.823 16.7175 10.5082 17.0323 10.1199 17.0323H9.98231C10.6155 17.286 11.2974 17.4192 12 17.4192C13.4475 17.4192 14.8084 16.8555 15.832 15.8319C17.3003 14.3635 17.7991 12.2285 17.1337 10.26C17.0093 9.89203 17.2068 9.49303 17.5747 9.36867C17.9425 9.24431 18.3415 9.44175 18.4659 9.80958C18.8674 10.9981 18.9345 12.2742 18.6598 13.4983Z" fill="#0067FF"/>
							</g>
							<defs>
								<clipPath id="clip0_385_3886">
									<rect width="24" height="24" fill="white"/>
								</clipPath>
							</defs>
						</svg>
						<span>{isRotating ? T("package.rotating") : T("package.ipRotation")}</span>
					</button>
					<button className="mob-proxy-package__download-btn" type="button">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
							<rect x="7.59961" y="5.40002" width="11" height="15.4" fill="white"/>
							<path d="M20.602 3.398C18.38 1.176 13.452 1 12 1C10.548 1 5.62 1.176 3.398 3.398C1.176 5.62 1 10.548 1 12C1 13.452 1.176 18.38 3.398 20.602C5.62 22.824 10.548 23 12 23C13.452 23 18.38 22.824 20.602 20.602C22.824 18.38 23 13.452 23 12C23 10.548 22.824 5.62 20.602 3.398ZM14.2 18.6H9.8C9.50826 18.6 9.22847 18.4841 9.02218 18.2778C8.81589 18.0715 8.7 17.7917 8.7 17.5C8.7 17.2083 8.81589 16.9285 9.02218 16.7222C9.22847 16.5159 9.50826 16.4 9.8 16.4H14.2C14.4917 16.4 14.7715 16.5159 14.9778 16.7222C15.1841 16.9285 15.3 17.2083 15.3 17.5C15.3 17.7917 15.1841 18.0715 14.9778 18.2778C14.7715 18.4841 14.4917 18.6 14.2 18.6ZM16.081 11.681L12.781 14.981C12.6787 15.0841 12.5571 15.1659 12.423 15.2218C12.289 15.2776 12.1452 15.3064 12 15.3064C11.8548 15.3064 11.711 15.2776 11.577 15.2218C11.4429 15.1659 11.3213 15.0841 11.219 14.981L7.919 11.681C7.71187 11.4739 7.5955 11.1929 7.5955 10.9C7.5955 10.6071 7.71187 10.3261 7.919 10.119C8.12613 9.91187 8.40707 9.7955 8.7 9.7955C8.99293 9.7955 9.27387 9.91187 9.481 10.119L10.9 11.549V6.5C10.9 6.20826 11.0159 5.92847 11.2222 5.72218C11.4285 5.51589 11.7083 5.4 12 5.4C12.2917 5.4 12.5715 5.51589 12.7778 5.72218C12.9841 5.92847 13.1 6.20826 13.1 6.5V11.549L14.519 10.119C14.7261 9.91187 15.0071 9.7955 15.3 9.7955C15.5929 9.7955 15.8739 9.91187 16.081 10.119C16.2881 10.3261 16.4045 10.6071 16.4045 10.9C16.4045 11.1929 16.2881 11.4739 16.081 11.681Z" fill="#0067FF"/>
						</svg>
						<span>{T("package.download")}</span>
					</button>
				</div>

				{/* Блок "Список прокси" */}
				<div className="mob-proxy-package__list-block">
					{/* Первый ряд */}
					<div className="mob-proxy-package__list-row">
						<h2 className="mob-proxy-package__list-title">{T("package.proxyList")}</h2>
						<Select
							value={proxyFormat}
							onChange={(val) => setProxyFormat(val)}
							className="mob-proxy-package__format-select"
						>
							<Select.Option value="ip:port:login:password">ip:port:login:password</Select.Option>
							<Select.Option value="login:password@ip:port">login:password@ip:port</Select.Option>
						</Select>
						<Input
							type="number"
							value={proxyCount}
							onChange={(e) => setProxyCount(e.target.value)}
							className="mob-proxy-package__count-input"
							placeholder={T("package.quantity")}
						/>
						<button 
							className="mob-proxy-package__generate-btn" 
							type="button" 
							onClick={generateProxies}
							disabled={isGenerating || !remainingTime}
						>
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<rect x="7" y="3" width="14" height="15" fill="white"/>
								<path d="M6.5 6.2158V3.90625C6.5 3.1296 7.1296 2.5 7.90625 2.5H20.0938C20.8704 2.5 21.5 3.1296 21.5 3.90625V16.0938C21.5 16.8704 20.8704 17.5 20.0938 17.5H17.7582" stroke="#0067FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
								<path d="M16.0938 6.5H3.90625C3.1296 6.5 2.5 7.1296 2.5 7.90625V20.0938C2.5 20.8704 3.1296 21.5 3.90625 21.5H16.0938C16.8704 21.5 17.5 20.8704 17.5 20.0938V7.90625C17.5 7.1296 16.8704 6.5 16.0938 6.5Z" fill="#0067FF" stroke="#0067FF" strokeWidth="2" strokeLinejoin="round"/>
							</svg>
							<span>{isGenerating ? T("package.generating") : T("package.generate")}</span>
						</button>
					</div>
					{generationError && (
						<div style={{ color: "#E84646", marginTop: "12px", width: "100%" }}>{generationError}</div>
					)}
					{rotationError && (
						<div style={{ color: "#E84646", marginTop: "12px", width: "100%" }}>{rotationError}</div>
					)}
					{rotationSuccess && (
						<div style={{ color: "#4CAF50", marginTop: "12px", width: "100%" }}>
							{T("package.rotationSuccess")}
						</div>
					)}

					{/* Второй ряд */}
					<div className="mob-proxy-package__list-second-row">
						{/* Блок со списком прокси */}
						<div className="mob-proxy-package__proxies-list">
							{proxies.length > 0 ? (
								<div className="mob-proxy-package__proxies-scroll">
									{proxies.map((proxy, index) => (
										<div key={index} className="mob-proxy-package__proxy-item">
											<span className="proxy-text">{formatProxy(proxy, proxyFormat)}</span>
											<button
												className="proxy-copy-wrapper"
												type="button"
												onClick={() => copyProxy(proxy)}
											>
												<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
													<path d="M3.27308 13.091C2.37308 13.091 1.63672 12.3546 1.63672 11.4546V3.27278C1.63672 2.37278 2.37308 1.63641 3.27308 1.63641H11.4549C12.3549 1.63641 13.0913 2.37278 13.0913 3.27278M8.18217 6.5455H16.364C17.2677 6.5455 18.0004 7.27813 18.0004 8.18187V16.3637C18.0004 17.2674 17.2677 18 16.364 18H8.18217C7.27843 18 6.54581 17.2674 6.54581 16.3637V8.18187C6.54581 7.27813 7.27843 6.5455 8.18217 6.5455Z" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
												</svg>
											</button>
										</div>
									))}
								</div>
							) : (
								<div className="mob-proxy-package__empty">{T("package.noProxiesAvailable")}</div>
							)}
						</div>

						{/* Блок с кнопками справа */}
						<div className="mob-proxy-package__list-actions">
							<button className="mob-proxy-package__copy-all-btn" type="button" onClick={copyAllProxies}>
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
									<rect x="7" y="3" width="14" height="15" fill="white"/>
									<path d="M6.5 6.2158V3.90625C6.5 3.1296 7.1296 2.5 7.90625 2.5H20.0938C20.8704 2.5 21.5 3.1296 21.5 3.90625V16.0938C21.5 16.8704 20.8704 17.5 20.0938 17.5H17.7582" stroke="#0067FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
									<path d="M16.0938 6.5H3.90625C3.1296 6.5 2.5 7.1296 2.5 7.90625V20.0938C2.5 20.8704 3.1296 21.5 3.90625 21.5H16.0938C16.8704 21.5 17.5 20.8704 17.5 20.0938V7.90625C17.5 7.1296 16.8704 6.5 16.0938 6.5Z" fill="#0067FF" stroke="#0067FF" strokeWidth="2" strokeLinejoin="round"/>
								</svg>
								<span>{T("package.copy")}</span>
							</button>
							<div className="mob-proxy-package__download-group">
								<Select
									value={fileFormat}
									onChange={(val) => setFileFormat(val)}
									className="mob-proxy-package__file-format-select"
								>
									<Select.Option value="txt">TXT</Select.Option>
									<Select.Option value="json">JSON</Select.Option>
									<Select.Option value="csv">CSV</Select.Option>
								</Select>
								{fileFormat === "csv" && (
									<Input
										type="text"
										value={csvDelimiter}
										onChange={(e) => {
											const value = e.target.value
											if (value.length <= 1) {
												setCsvDelimiter(value || ";")
											}
										}}
										className="mob-proxy-package__csv-delimiter-input"
										placeholder=";"
									/>
								)}
								<button className="mob-proxy-package__download-file-btn" type="button" onClick={downloadProxies}>
									<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
										<rect x="7" y="3" width="14" height="15" fill="white"/>
										<path d="M6.5 6.2158V3.90625C6.5 3.1296 7.1296 2.5 7.90625 2.5H20.0938C20.8704 2.5 21.5 3.1296 21.5 3.90625V16.0938C21.5 16.8704 20.8704 17.5 20.0938 17.5H17.7582" stroke="#0067FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
										<path d="M16.0938 6.5H3.90625C3.1296 6.5 2.5 7.1296 2.5 7.90625V20.0938C2.5 20.8704 3.1296 21.5 3.90625 21.5H16.0938C16.8704 21.5 17.5 20.8704 17.5 20.0938V7.90625C17.5 7.1296 16.8704 6.5 16.0938 6.5Z" fill="#0067FF" stroke="#0067FF" strokeWidth="2" strokeLinejoin="round"/>
									</svg>
									<span>{T("package.download")}</span>
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</main>
	)
}

