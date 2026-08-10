"use client"

import { type FC, useState, useRef, useEffect, useMemo } from "react"
import Image from "next/image"
import { ChevronDown } from "lucide-react"
import Input from "@/shared/components/ui/Input"
import Range from "@/shared/components/ui/Range/Range"
import { useGeneratePackageProxy } from "@/features/packages/hooks/useGeneratePackageProxy"
import {
	useEmpireRegions,
	useEmpireCities,
	useEmpireIsps,
	useMangoRegions,
	useMangoCities,
	useMangoIsps,
} from "@/features/proxy/hooks/useProxyEmpireFilters"
import toast from "react-hot-toast"
import { usePathname } from "next/navigation"
import { getLocaleFromPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"
import { MOBILE_GB_ALLOWED_ISO2_UPPER } from "@/shared/constants/mobile-gb-allowed-countries"

// Полный список стран для Residential (Mango) — как на проде. Статический, без Mango API.
// Алфавитный порядок по коду, как в проде (служебные коды групп EU/OC исключены).
const STATIC_RESIDENTIAL_COUNTRIES = [
	"AD", "AE", "AF", "AG", "AL", "AM", "AO", "AR", "AS", "AT", "AU", "AZ",
	"BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BN", "BO", "BR", "BS", "BT", "BW", "BY", "BZ",
	"CA", "CD", "CF", "CG", "CH", "CI", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CY", "CZ",
	"DE", "DJ", "DK", "DM", "DO", "DZ",
	"EC", "EE", "EG", "ER", "ES", "ET",
	"FI", "FJ", "FM", "FR",
	"GA", "GB", "GD", "GE", "GH", "GM", "GN", "GQ", "GR", "GT", "GW", "GY",
	"HN", "HR", "HT", "HU",
	"ID", "IE", "IL", "IN", "IQ", "IR", "IS", "IT",
	"JM", "JO", "JP",
	"KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KZ",
	"LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY",
	"MA", "MC", "MD", "ME", "MG", "MH", "MK", "ML", "MM", "MN", "MR", "MT", "MU", "MV", "MW", "MX", "MY", "MZ",
	"NA", "NE", "NG", "NI", "NL", "NO", "NP", "NR", "NZ",
	"OM",
	"PA", "PE", "PG", "PH", "PK", "PL", "PS", "PT", "PW", "PY",
	"QA",
	"RO", "RS", "RU", "RW",
	"SA", "SB", "SC", "SD", "SE", "SG", "SI", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SY", "SZ",
	"TD", "TG", "TH", "TJ", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ",
	"UA", "UG", "US", "UY", "UZ",
	"VA", "VC", "VE", "VN", "VU",
	"WS",
	"YE",
	"ZA", "ZM", "ZW",
]

type ProxyGeneratorProps = {
	packageId?: string
	existingProxies?: Array<{
		id: string
		port: number
		login: string
		password: string
		serverHost: string
		createdAt: string
		lastActivityAt: string
	}>
	packageType?: string
}

const prettifyLabel = (slug: string): string =>
	slug
		.split(/[+_\s-]+/)
		.filter(Boolean)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
		.join(" ")

type CustomDropdownProps = {
	placeholder: string
	options: string[]
	value: string
	onChange: (v: string) => void
	disabled?: boolean
	searchable?: boolean
}
const CustomDropdown: FC<CustomDropdownProps> = ({ placeholder, options, value, onChange, disabled, searchable = true }) => {
	const pathname = usePathname()
	const locale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, locale)
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState("")
	const wrapRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		const onClickOutside = (e: MouseEvent) => {
			if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
				setOpen(false)
				setQuery("")
			}
		}
		document.addEventListener("mousedown", onClickOutside)
		return () => document.removeEventListener("mousedown", onClickOutside)
	}, [])

	useEffect(() => {
		if (open && searchable) setTimeout(() => inputRef.current?.focus(), 0)
	}, [open, searchable])

	const filtered = useMemo(() => {
		if (!query.trim()) return options
		const q = query.trim().toLowerCase()
		return options.filter(o =>
			prettifyLabel(o).toLowerCase().includes(q) || o.toLowerCase().includes(q),
		)
	}, [options, query])

	return (
		<div className="relative flex-1 min-w-0" ref={wrapRef}>
			<div
				onClick={() => !disabled && setOpen(!open)}
				className={`rounded-[12px] border px-4 py-3 w-full flex items-center gap-3 transition-colors ${
					disabled
						? "opacity-40 cursor-not-allowed border-white/10 bg-white/[0.02] light:border-[#e2e4ea] light:bg-[#f4f6fa]"
						: open
							? "border-[#4f8dff]/60 bg-white/[0.06] cursor-pointer ring-4 ring-[#4f8dff]/15 light:bg-[#eef1f6]"
							: "border-white/10 bg-white/[0.04] hover:border-white/20 cursor-pointer light:border-[#e2e4ea] light:bg-[#f4f6fa] light:hover:bg-[#eef1f6]"
				}`}
			>
				{open && searchable ? (
					<>
						<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 text-white light:text-[#5b6472]" style={{ opacity: 0.7 }}>
							<path d="M15.75 15.75L12.495 12.495M14.25 8.25C14.25 11.5637 11.5637 14.25 8.25 14.25C4.93629 14.25 2.25 11.5637 2.25 8.25C2.25 4.93629 4.93629 2.25 8.25 2.25C11.5637 2.25 14.25 4.93629 14.25 8.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
						<input
							ref={inputRef}
							type="text"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							onClick={(e) => e.stopPropagation()}
							placeholder={T("package.proxyGenerator.search")}
							className="flex-1 min-w-0 bg-transparent border-none outline-none text-white text-base font-normal placeholder:text-white/50 light:text-[#0e1019] light:placeholder:text-[#9aa3b2]"
						/>
						{query && (
							<button
								type="button"
								onClick={(e) => { e.stopPropagation(); setQuery(""); inputRef.current?.focus() }}
								className="p-1 flex-shrink-0 rounded hover:bg-white/10 transition-colors cursor-pointer text-white light:text-[#5b6472] light:hover:bg-[#eef1f6]"
								aria-label="Clear"
							>
								<svg width="14" height="14" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
									<g opacity="0.5">
										<path d="M13.2004 4.40002L4.40039 13.2M4.40039 4.40002L13.2004 13.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
									</g>
								</svg>
							</button>
						)}
					</>
				) : (
					<span className="flex-1 min-w-0 text-white light:text-[#0e1019] text-base font-normal block truncate" style={!value ? { opacity: 0.5 } : {}}>
						{value ? prettifyLabel(value) : placeholder}
					</span>
				)}
				<ChevronDown
					className={`h-5 w-5 text-white light:text-[#5b6472] transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`}
					style={{ opacity: 0.5 }}
				/>
			</div>
			{open && !disabled && (
				<div className="absolute top-full left-0 right-0 mt-2 w-full rounded-[12px] border border-white/10 bg-[#0e1830] z-20 overflow-hidden shadow-[0_30px_70px_-30px_rgba(0,0,0,0.9)] light:bg-white light:border-[#e2e4ea] light:shadow-[0_30px_70px_-30px_rgba(14,16,25,0.25)]">
					<div className="max-h-52 overflow-y-auto overflow-x-hidden py-2">
						<div
							onClick={() => { onChange(""); setOpen(false); setQuery("") }}
							className="px-4 py-3 flex items-center gap-3 cursor-pointer text-white/60 light:text-[#5b6472] text-base font-normal hover:bg-white/[0.06] light:hover:bg-[#f4f6fa] transition-colors"
						>
							<span className="flex-1 italic">{T("package.proxyGenerator.any")}</span>
							{!value && <div className="w-2 h-2 rounded-full bg-[#6aa5ff]" />}
						</div>
						{filtered.map((opt) => (
							<div
								key={opt}
								onClick={() => { onChange(opt); setOpen(false); setQuery("") }}
								className="px-4 py-3 flex items-center gap-3 cursor-pointer text-white light:text-[#0e1019] text-base font-normal hover:bg-white/[0.06] light:hover:bg-[#f4f6fa] transition-colors"
								title={opt}
							>
								<span className="flex-1 min-w-0 truncate">{prettifyLabel(opt)}</span>
								<div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
									value === opt ? "border-[#4f8dff] bg-[#4f8dff]" : "border-white/30 light:border-[#cdd2db]"
								}`}>
									{value === opt && <div className="w-2 h-2 rounded-full bg-white" />}
								</div>
							</div>
						))}
						{filtered.length === 0 && (
							<div className="px-4 py-3 text-white/50 light:text-[#8a93a3] text-sm">
								{T("package.proxyGenerator.noOptions")}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	)
}

// Мультигео-селектор стран (ISP_EU, ТЗ п.2) — несколько стран сразу.
type MultiCountryDropdownProps = {
	placeholder: string
	options: string[]
	values: string[]
	onToggle: (code: string) => void
	regionNames: Intl.DisplayNames
}
const MultiCountryDropdown: FC<MultiCountryDropdownProps> = ({ placeholder, options, values, onToggle, regionNames }) => {
	const pathname = usePathname()
	const locale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, locale)
	const [open, setOpen] = useState(false)
	const wrapRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const onClickOutside = (e: MouseEvent) => {
			if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
		}
		document.addEventListener("mousedown", onClickOutside)
		return () => document.removeEventListener("mousedown", onClickOutside)
	}, [])

	const label = values.length === 0
		? placeholder
		: values.map(v => regionNames.of(v.toUpperCase()) || v).join(", ")

	return (
		<div className="relative flex-1 min-w-[180px] w-full" ref={wrapRef}>
			<div
				onClick={() => setOpen(!open)}
				className={`rounded-[12px] border px-4 py-3 w-full min-w-0 flex items-center gap-3 cursor-pointer transition-colors ${
					open ? "border-[#4f8dff]/60 bg-white/[0.06] ring-4 ring-[#4f8dff]/15 light:bg-[#eef1f6]" : "border-white/10 bg-white/[0.04] hover:border-white/20 light:border-[#e2e4ea] light:bg-[#f4f6fa] light:hover:bg-[#eef1f6]"
				}`}
			>
				<span className="flex-1 min-w-0 text-white light:text-[#0e1019] text-base font-normal block truncate" style={values.length === 0 ? { opacity: 0.5 } : {}}>
					{label}
				</span>
				{values.length > 0 && (
					<span className="flex-shrink-0 rounded-full bg-[#4f8dff] px-2 py-0.5 text-[12px] font-semibold text-white">{values.length}</span>
				)}
				<ChevronDown className={`h-5 w-5 text-white light:text-[#5b6472] transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} style={{ opacity: 0.5 }} />
			</div>
			{open && (
				<div className="absolute top-full left-0 right-0 mt-2 w-full rounded-[12px] border border-white/10 bg-[#0e1830] z-20 overflow-hidden shadow-[0_30px_70px_-30px_rgba(0,0,0,0.9)] light:bg-white light:border-[#e2e4ea] light:shadow-[0_30px_70px_-30px_rgba(14,16,25,0.25)]">
					<div className="max-h-52 overflow-y-auto overflow-x-hidden py-2">
						{options.map(country => {
							const checked = values.includes(country)
							return (
								<div
									key={country}
									onClick={() => onToggle(country)}
									className="px-4 py-3 flex items-center gap-3 cursor-pointer text-white light:text-[#0e1019] text-base font-normal hover:bg-white/[0.06] light:hover:bg-[#f4f6fa] transition-colors"
								>
									<Image
										src={`https://flagsapi.com/${country.toUpperCase()}/flat/64.png`}
										alt={regionNames.of(country.toUpperCase()) as string}
										width={28}
										height={20}
										className="h-5 w-7 rounded object-cover flex-shrink-0"
										draggable={false}
									/>
									<span className="flex-1 min-w-0 break-words">{regionNames.of(country.toUpperCase())}</span>
									<div className={`flex-shrink-0 w-5 h-5 rounded-[6px] border-2 flex items-center justify-center transition-colors ${
										checked ? "border-[#4f8dff] bg-[#4f8dff]" : "border-white/30 bg-transparent light:border-[#cdd2db]"
									}`}>
										{checked && (
											<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 7L6 10L11 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
										)}
									</div>
								</div>
							)
						})}
						{options.length === 0 && (
							<div className="px-4 py-3 text-white/50 light:text-[#8a93a3] text-sm">{T("package.proxyGenerator.noCountries")}</div>
						)}
					</div>
				</div>
			)}
		</div>
	)
}

const ProxyGenerator: FC<ProxyGeneratorProps> = ({ packageId, existingProxies = [], packageType }) => {
	const pathname = usePathname()
	const locale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, locale)
	
	const [selectedCountry, setSelectedCountry] = useState("")
	const [region, setRegion] = useState("")
	const [city, setCity] = useState("")
	const [isp, setIsp] = useState("")
	const [rotation, setRotation] = useState("auto")
	const [rotationInterval, setRotationInterval] = useState(5)

	const isPR = packageType === "PREMIUM_RESIDENTIAL"
	const isMangoResi = packageType === "RESIDENT_PREMIUM"
	const isMobilePE = packageType === "MOBILE"
	// Новые типы (ТЗ п.2/п.3/п.7): трафик считает наш гейтвей, апстрим скрыт.
	const isIspUsa = packageType === "ISP_USA" // страна фиксирована (US)
	const isIspEu = packageType === "ISP_EU"   // мультигео
	const isLite = packageType === "RESIDENTIAL_LITE" // одна страна, любая
	// Эти типы поддерживают время жизни 1–1440 мин (остальные — от 5).
	const isNewGatewayType = isIspUsa || isIspEu || isLite
	const rotMin = isNewGatewayType ? 1 : 5
	const rotMax = isNewGatewayType ? 1440 : 90
	const [selectedCountries, setSelectedCountries] = useState<string[]>([]) // для ISP_EU
	// Локация для запроса: ISP_EU отправляет коды через запятую (мультигео).
	const hasLocation = isIspEu ? selectedCountries.length > 0 : !!selectedCountry
	const effectiveLocation = isIspEu ? selectedCountries.join(",") : selectedCountry
	const prCountry = isPR && selectedCountry ? selectedCountry.toLowerCase() : null
	const mobileCountry = isMobilePE && selectedCountry ? selectedCountry.toLowerCase() : null
	const mangoCountry = isMangoResi && selectedCountry ? selectedCountry.toLowerCase() : null

	// ProxyEmpire Premium Residential
	const { data: prRegions = [] } = useEmpireRegions("residential", prCountry)
	const { data: prCities = [] } = useEmpireCities("residential", prCountry, region || null)
	const { data: prIsps = [] } = useEmpireIsps("residential", prCountry, region || null, city || null)

	// ProxyEmpire Mobile
	const { data: mobileRegions = [] } = useEmpireRegions("mobile", mobileCountry)
	const { data: mobileCities = [] } = useEmpireCities("mobile", mobileCountry, region || null)
	const { data: mobileIsps = [] } = useEmpireIsps("mobile", mobileCountry, region || null, city || null)

	// Mango Residential Proxy (задача 2 ТЗ)
	const { data: mangoRegions = [] } = useMangoRegions(mangoCountry)
	const { data: mangoCities = [] } = useMangoCities(mangoCountry, region || null)
	const { data: mangoIsps = [] } = useMangoIsps(mangoCountry, region || null, city || null)

	// Объединённые источники для UI: выбирается тот, который соответствует тарифу.
	const filterRegions = isMangoResi ? mangoRegions : isMobilePE ? mobileRegions : prRegions
	const filterCities = isMangoResi ? mangoCities : isMobilePE ? mobileCities : prCities
	const filterIsps = isMangoResi ? mangoIsps : isMobilePE ? mobileIsps : prIsps
	const showLocationFilters = isPR || isMangoResi || isMobilePE

	// ISP_USA — страна фиксирована (US), селектор не показываем.
	useEffect(() => { if (isIspUsa) setSelectedCountry("US") }, [isIspUsa])

	// Сброс нижестоящих фильтров при смене страны/региона/города.
	useEffect(() => { setRegion(""); setCity(""); setIsp("") }, [selectedCountry])
	useEffect(() => { setCity(""); setIsp("") }, [region])
	useEffect(() => { setIsp("") }, [city])
	const [proxyFormat, setProxyFormat] = useState<"ip:port:login:password" | "login:password@ip:port">("ip:port:login:password")
	const [quantity, setQuantity] = useState("")
	const [newProxies, setNewProxies] = useState<string[]>([])
	const [isCountrySelectOpen, setIsCountrySelectOpen] = useState(false)
	const [countrySearchQuery, setCountrySearchQuery] = useState("")
	const [availableCountries, setAvailableCountries] = useState<string[]>([])
	const countrySelectRef = useRef<HTMLDivElement>(null)
	const countrySearchInputRef = useRef<HTMLInputElement>(null)
	const proxiesScrollRef = useRef<HTMLDivElement>(null)
	const { mutate: generateProxy, isPending } = useGeneratePackageProxy()

	// Format proxy string for display (convert between formats)
	const formatProxyForDisplay = (raw: string, format: "ip:port:login:password" | "login:password@ip:port"): string => {
		const parts = raw.split(":")
		if (parts.length < 4) return raw
		const host = parts[0]
		const port = parts[1]
		const login = parts[2]
		const password = parts.slice(3).join(":")
		return format === "ip:port:login:password"
			? `${host}:${port}:${login}:${password}`
			: `${login}:${password}@${host}:${port}`
	}

	// Raw proxies (always stored as ip:port:login:password)
	const rawProxies = [
		...existingProxies.map(proxy => `${proxy.serverHost}:${proxy.port}:${proxy.login}:${proxy.password}`),
		...newProxies
	]
	// Formatted for display based on selected proxyFormat
	const allProxies = rawProxies.map(p => formatProxyForDisplay(p, proxyFormat))
	
	const regionNames = useMemo(() => new Intl.DisplayNames(["ru"], { type: "region" }), [])

	// Фильтрация стран по поисковому запросу (код или название)
	const filteredCountries = useMemo(() => {
		if (!countrySearchQuery.trim()) return availableCountries
		const query = countrySearchQuery.trim().toLowerCase()
		return availableCountries.filter(country => {
			const name = (regionNames.of(country) || "").toLowerCase()
			const code = country.toLowerCase()
			return name.includes(query) || code.includes(query)
		})
	}, [availableCountries, countrySearchQuery, regionNames])
	
	// Загружаем список доступных стран
	useEffect(() => {
		const fetchCountries = async () => {
			try {
				// Для IPv6 доступны только Германия и Нидерланды
				if (packageType === "IPV6_GB") {
					setAvailableCountries(["DE", "NL"])
					return
				}

				// Residential (Mango) и Residential Lite — список стран СТАТИЧЕСКИЙ (как на проде),
				// без запроса к бэку (Residential Lite работает с любой страной, апстрим отдаёт
				// пустой /locations и селектор оставался бы пустым → «Страны не найдены»).
				if (packageType === "RESIDENT_PREMIUM" || packageType === "RESIDENT" || packageType === "RESIDENTIAL_LITE") {
					setAvailableCountries(STATIC_RESIDENTIAL_COUNTRIES)
					return
				}

				// Для других типов получаем список из API
				const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URI}/proxy/locations`, {
					credentials: "include"
				})
				const locations = await res.json()
				
				// Определяем, какой список стран использовать в зависимости от типа пакета
				let countries: string[] = []
				if (packageType === "RESIDENT") {
					countries = locations.resident || []
				} else if (packageType === "RESIDENT_PREMIUM") {
					countries = locations.premium || []
				} else if (packageType === "PREMIUM_RESIDENTIAL") {
					countries = locations.premiumResidential || []
				} else if (packageType === "MOBILE") {
					countries = locations.mobile || []
				} else if (packageType === "MOBILE_GB") {
					countries = locations.mobileGb?.length ? locations.mobileGb : [...MOBILE_GB_ALLOWED_ISO2_UPPER]
				} else if (packageType === "IPV6_GB") {
					// Для IPv6 доступны только Германия и Нидерланды
					countries = locations.ipv6 || ["DE", "NL"]
				} else if (packageType === "ISP_USA") {
					countries = locations.ispUsa?.length ? locations.ispUsa : ["US"]
				} else if (packageType === "ISP_EU") {
					countries = locations.ispEu || []
				} else if (packageType === "RESIDENTIAL_LITE") {
					countries = locations.residentialLite || []
				} else {
					// По умолчанию используем resident
					countries = locations.resident || []
				}
				
				setAvailableCountries(countries.map((c: string) => c.toUpperCase()))
			} catch (error) {
				console.error("Ошибка при загрузке списка стран:", error)
				// Fallback на дефолтный список
				setAvailableCountries(["US", "RU", "GB", "DE", "FR", "CN", "JP", "KR"])
			}
		}
		
		fetchCountries()
	}, [packageType])
	
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (countrySelectRef.current && !countrySelectRef.current.contains(e.target as Node)) {
				setIsCountrySelectOpen(false)
				setCountrySearchQuery("")
			}
		}
		document.addEventListener("mousedown", handleClickOutside)
		return () => document.removeEventListener("mousedown", handleClickOutside)
	}, [])

	// Автофокус на поиск при открытии dropdown
	useEffect(() => {
		if (isCountrySelectOpen) {
			setTimeout(() => countrySearchInputRef.current?.focus(), 0)
		}
	}, [isCountrySelectOpen])

	// Начальное смещение скролла списка прокси — видно затухание сверху, понятно что есть прокрутка
	useEffect(() => {
		if (allProxies.length > 0 && proxiesScrollRef.current) {
			const el = proxiesScrollRef.current
			// Смещаем на ~12px вниз, чтобы сверху была видна подсказка затухания
			el.scrollTop = 12
		}
	}, [allProxies.length])

	return (
		<div className="proxy-generator-mobile w-full rounded-[20px] border border-white/[0.08] light:border-[#e6e8ef] bg-[linear-gradient(180deg,#0e1830,#0a1020)] light:bg-none light:bg-white light:shadow-[0_24px_60px_-44px_rgba(14,16,25,0.14)] p-6 sm:p-8 flex flex-col gap-6 shadow-[0_30px_70px_-44px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)]" style={{ minHeight: "526px" }}>
			<h2 className="text-white light:text-[#0e1019] font-[TalosDisplay] text-[clamp(22px,3vw,30px)] font-semibold leading-none">
				{T("package.proxyGenerator.title")}
			</h2>

			<div className="flex flex-col gap-4 flex-1">
				{/* Первый блок */}
				<div className="rounded-[16px] border border-white/[0.06] light:border-[#e2e4ea] bg-white/[0.02] light:bg-[#f4f6fa] p-6 flex flex-col gap-4 flex-1">
					<h3 className="text-white light:text-[#0e1019] font-[TalosDisplay] text-[18px] font-semibold leading-[1.2] tracking-[-0.01em]">
						{T("package.proxyGenerator.inputData")}
					</h3>
					
					{/* Ряд 1: Ротация + Страна */}
					<div className="proxy-generator__inputs flex flex-row gap-4 items-center flex-wrap">
						{/* Кнопки ротации — первыми */}
						<div className="proxy-generator__radio-wrap flex items-center rounded-[12px] border border-white/10 light:border-[#e2e4ea] p-1 bg-white/[0.04] light:bg-[#f4f6fa]">
							<button
								type="button"
								onClick={() => setRotation("auto")}
								className={`rounded-[9px] px-4 py-2 text-sm font-medium min-w-[100px] cursor-pointer transition-colors ${
									rotation === "auto"
										? "bg-gradient-to-b from-[#4f8dff] to-[#2f6bff] text-white shadow-[0_8px_24px_-12px_rgba(59,130,246,0.8)]"
										: "text-white/70 hover:text-white hover:bg-white/[0.06] light:text-[#5b6472] light:hover:text-[#0e1019] light:hover:bg-[#eef1f6]"
								}`}
							>
								{T("package.proxyGenerator.onRequest")}
							</button>
							<button
								type="button"
								onClick={() => setRotation("time")}
								className={`rounded-[9px] px-4 py-2 text-sm font-medium min-w-[100px] cursor-pointer transition-colors ${
									rotation === "time"
										? "bg-gradient-to-b from-[#4f8dff] to-[#2f6bff] text-white shadow-[0_8px_24px_-12px_rgba(59,130,246,0.8)]"
										: "text-white/70 hover:text-white hover:bg-white/[0.06] light:text-[#5b6472] light:hover:text-[#0e1019] light:hover:bg-[#eef1f6]"
								}`}
							>
								{T("package.proxyGenerator.byTime")}
							</button>
						</div>
						
						{/* ISP_USA — страна фиксирована (США), показываем статичный чип */}
						{isIspUsa && (
							<div className="relative flex-1 min-w-[180px] w-full">
								<div className="rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-3 w-full flex items-center gap-3 light:border-[#e2e4ea] light:bg-[#f4f6fa]">
									<Image src="https://flagsapi.com/US/flat/64.png" alt="USA" width={28} height={20} className="h-5 w-7 rounded object-cover flex-shrink-0" draggable={false} />
									<span className="flex-1 min-w-0 text-white light:text-[#0e1019] text-base font-normal">{regionNames.of("US")}</span>
								</div>
							</div>
						)}
						{/* ISP_EU — мультигео: можно выбрать несколько стран */}
						{isIspEu && (
							<MultiCountryDropdown
								placeholder={T("package.proxyGenerator.country")}
								options={availableCountries}
								values={selectedCountries}
								onToggle={(code) => setSelectedCountries(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code])}
								regionNames={regionNames}
							/>
						)}
						{/* Селект стран — закрыт: иконка + текст; открыт: поиск в кнопке */}
						{!isIspUsa && !isIspEu && (
						<div className="relative flex-1 min-w-[180px] w-full" ref={countrySelectRef}>
							<div
								onClick={() => setIsCountrySelectOpen(!isCountrySelectOpen)}
								className={`proxy-generator__country-trigger rounded-[12px] border px-4 py-3 w-full min-w-0 flex items-center gap-3 cursor-pointer transition-colors ${
									isCountrySelectOpen ? "border-[#4f8dff]/60 bg-white/[0.06] ring-4 ring-[#4f8dff]/15 light:bg-[#eef1f6]" : "border-white/10 bg-white/[0.04] hover:border-white/20 light:border-[#e2e4ea] light:bg-[#f4f6fa] light:hover:bg-[#eef1f6]"
								}`}
							>
								{/* Левая иконка: пустая страна (когда нет выбора) или флаг (выбрана) или лупа (открыт) */}
								{isCountrySelectOpen ? (
									<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 text-white light:text-[#5b6472]" style={{ opacity: 0.7 }}>
										<path d="M15.75 15.75L12.495 12.495M14.25 8.25C14.25 11.5637 11.5637 14.25 8.25 14.25C4.93629 14.25 2.25 11.5637 2.25 8.25C2.25 4.93629 4.93629 2.25 8.25 2.25C11.5637 2.25 14.25 4.93629 14.25 8.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
									</svg>
								) : selectedCountry ? (
									<Image
										src={`https://flagsapi.com/${selectedCountry.toUpperCase()}/flat/64.png`}
										alt={regionNames.of(selectedCountry.toUpperCase()) as string}
										width={28}
										height={20}
										className="h-5 w-7 rounded object-cover flex-shrink-0"
										draggable={false}
									/>
								) : (
									<svg width="28" height="20" viewBox="0 0 28 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
										<rect width="28" height="20" rx="2" fill="white"/>
										<mask id="mask0_country_empty" style={{maskType:"luminance"}} maskUnits="userSpaceOnUse" x="0" y="0" width="28" height="20">
											<rect width="28" height="20" rx="2" fill="white"/>
										</mask>
										<g mask="url(#mask0_country_empty)">
											<rect width="28" height="20" fill="#19BFBF"/>
											<path d="M14 2.66669C18.05 2.66669 21.3338 5.94976 21.334 9.99969C21.334 14.0498 18.0501 17.3337 14 17.3337C9.95006 17.3335 6.66699 14.0497 6.66699 9.99969C6.66717 5.94987 9.95017 2.66686 14 2.66669ZM12.0166 10.6667C12.1139 12.9144 12.6996 14.9003 13.6143 15.985C13.7418 15.9932 13.8704 15.9997 14 15.9997C14.1296 15.9997 14.2582 15.9931 14.3857 15.985C15.3005 14.9003 15.8871 12.9146 15.9844 10.6667H12.0166ZM17.3193 10.6667C17.2462 12.5278 16.8647 14.251 16.2148 15.5749C18.2343 14.7719 19.7142 12.9062 19.9619 10.6667H17.3193ZM8.03809 10.6667C8.28582 12.9058 9.7652 14.7717 11.7842 15.5749C11.1345 14.251 10.7548 12.5274 10.6816 10.6667H8.03809ZM14 3.99969C13.8704 3.9997 13.7418 4.00526 13.6143 4.01337C12.6991 5.098 12.1139 7.08519 12.0166 9.33368H15.9844C15.8871 7.08497 15.301 5.09793 14.3857 4.01337C14.2582 4.00527 14.1296 3.99969 14 3.99969ZM16.2148 4.42352C16.8652 5.74771 17.2462 7.47187 17.3193 9.33368H19.9619C19.7144 7.09372 18.2347 5.22656 16.2148 4.42352ZM11.7842 4.42352C9.76482 5.2268 8.28562 7.09412 8.03809 9.33368H10.6816C10.7548 7.47218 11.1341 5.74762 11.7842 4.42352Z" fill="white"/>
										</g>
									</svg>
								)}
								{/* Закрыт: текст "Страна" или название. Открыт: инпут поиска */}
								{isCountrySelectOpen ? (
									<input
										ref={countrySearchInputRef}
										type="text"
										value={countrySearchQuery}
										onChange={(e) => setCountrySearchQuery(e.target.value)}
										onClick={(e) => e.stopPropagation()}
										placeholder={T("package.proxyGenerator.enterCountryName")}
										className="proxy-generator__country-input flex-1 min-w-0 bg-transparent border-none outline-none text-white text-base font-normal placeholder:text-white/50 light:text-[#0e1019] light:placeholder:text-[#9aa3b2]"
									/>
								) : (
									<span className="flex-1 min-w-0 text-white light:text-[#0e1019] text-base font-normal block break-words" style={!selectedCountry ? { opacity: 0.5 } : {}}>
										{selectedCountry ? regionNames.of(selectedCountry.toUpperCase()) : T("package.proxyGenerator.country")}
									</span>
								)}
								{/* Крестик — виден только при введённом тексте фильтра */}
								{isCountrySelectOpen && countrySearchQuery && (
									<button
										type="button"
										onClick={(e) => { e.stopPropagation(); setCountrySearchQuery(""); countrySearchInputRef.current?.focus() }}
										className="p-1 flex-shrink-0 rounded hover:bg-white/10 transition-colors cursor-pointer text-white light:text-[#5b6472] light:hover:bg-[#eef1f6]"
										aria-label="Clear"
									>
										<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
											<g opacity="0.5">
												<path d="M13.2004 4.40002L4.40039 13.2M4.40039 4.40002L13.2004 13.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
											</g>
										</svg>
									</button>
								)}
								<ChevronDown
									className={`h-5 w-5 text-white light:text-[#5b6472] transition-transform flex-shrink-0 ${isCountrySelectOpen ? "rotate-180" : ""}`}
									style={{ opacity: 0.5 }}
								/>
							</div>
							{isCountrySelectOpen && (
								<div className="absolute top-full left-0 right-0 mt-2 w-full rounded-[12px] border border-white/10 bg-[#0e1830] z-10 overflow-hidden shadow-[0_30px_70px_-30px_rgba(0,0,0,0.9)] light:bg-white light:border-[#e2e4ea] light:shadow-[0_30px_70px_-30px_rgba(14,16,25,0.25)] proxy-generator__country-dropdown">
									<div className="max-h-52 overflow-y-auto overflow-x-hidden py-2 proxy-generator__country-list">
										{filteredCountries.map(country => (
											<div
												key={country}
												onClick={() => {
													setSelectedCountry(country)
													setIsCountrySelectOpen(false)
													setCountrySearchQuery("")
												}}
												className="proxy-generator__country-option px-4 py-3 flex items-center gap-3 cursor-pointer text-white light:text-[#0e1019] text-base font-normal hover:bg-white/[0.06] light:hover:bg-[#f4f6fa]"
											>
												<Image
													src={`https://flagsapi.com/${country.toUpperCase()}/flat/64.png`}
													alt={regionNames.of(country.toUpperCase()) as string}
													width={28}
													height={20}
													className="h-5 w-7 rounded object-cover flex-shrink-0"
													draggable={false}
												/>
												<span className="flex-1 min-w-0 break-words">{regionNames.of(country.toUpperCase())}</span>
												{/* Радиобокс 20x20, выбранный: синий с белым кружком 8x8 */}
												<div className={`proxy-generator__country-radio flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
													selectedCountry === country
														? "border-[#4f8dff] bg-[#4f8dff]"
														: "border-white/30 bg-transparent light:border-[#cdd2db]"
												}`}>
													{selectedCountry === country && (
														<div className="w-2 h-2 rounded-full bg-white" />
													)}
												</div>
											</div>
										))}
										{filteredCountries.length === 0 && (
											<div className="px-4 py-3 text-white/50 light:text-[#8a93a3] text-sm">
												{T("package.proxyGenerator.noCountries")}
											</div>
										)}
									</div>
								</div>
							)}
						</div>
						)}
					</div>
					
					{/* PREMIUM_RESIDENTIAL (ProxyEmpire) и RESIDENT_PREMIUM (Mango) — каскадные фильтры region/city/isp.
					    Появляются после выбора страны. Источник данных переключается по packageType. */}
					{showLocationFilters && selectedCountry && (
						<div className="proxy-generator__pr-filters flex flex-col md:flex-row gap-3 mt-1">
							<CustomDropdown
								placeholder={T("package.proxyGenerator.region")}
								options={filterRegions}
								value={region}
								onChange={setRegion}
							/>
							<CustomDropdown
								placeholder={T("package.proxyGenerator.city")}
								options={filterCities}
								value={city}
								onChange={setCity}
								disabled={!filterCities.length}
							/>
							<CustomDropdown
								placeholder={T("package.proxyGenerator.isp")}
								options={filterIsps}
								value={isp}
								onChange={setIsp}
								disabled={!filterIsps.length}
							/>
						</div>
					)}

					{/* Ряд 2: Формат прокси + Инпут + Кнопка генерации (на телефоне — колонка) */}
					<div className="proxy-generator__row2 flex flex-col md:flex-row gap-4 items-stretch md:items-center">
						{/* Формат прокси — переключатель (на телефоне кнопки в колонку) */}
						<div className="flex flex-col md:flex-row md:items-center rounded-[12px] border border-white/10 light:border-[#e2e4ea] p-1 bg-white/[0.04] light:bg-[#f4f6fa] flex-1 min-w-0 w-full md:w-auto gap-1 md:gap-0">
							<button
								type="button"
								onClick={() => setProxyFormat("ip:port:login:password")}
								className={`flex-1 w-full md:w-auto rounded-[9px] px-4 py-2 text-sm font-medium whitespace-nowrap cursor-pointer transition-colors text-center ${
									proxyFormat === "ip:port:login:password"
										? "bg-gradient-to-b from-[#4f8dff] to-[#2f6bff] text-white shadow-[0_8px_24px_-12px_rgba(59,130,246,0.8)]"
										: "text-white/70 hover:text-white hover:bg-white/[0.06] light:text-[#5b6472] light:hover:text-[#0e1019] light:hover:bg-[#eef1f6]"
								}`}
							>
								ip:port:login:password
							</button>
							<button
								type="button"
								onClick={() => setProxyFormat("login:password@ip:port")}
								className={`flex-1 w-full md:w-auto rounded-[9px] px-4 py-2 text-sm font-medium whitespace-nowrap cursor-pointer transition-colors text-center ${
									proxyFormat === "login:password@ip:port"
										? "bg-gradient-to-b from-[#4f8dff] to-[#2f6bff] text-white shadow-[0_8px_24px_-12px_rgba(59,130,246,0.8)]"
										: "text-white/70 hover:text-white hover:bg-white/[0.06] light:text-[#5b6472] light:hover:text-[#0e1019] light:hover:bg-[#eef1f6]"
								}`}
							>
								login:password@ip:port
							</button>
						</div>
						
						{/* Инпут количества */}
						<div className="w-full md:w-[120px] flex-shrink-0">
							<Input
								type="number"
								value={quantity}
								onChange={(e) => setQuantity(e.target.value)}
								placeholder={T("package.proxyGenerator.quantity")}
								className="bg-white/[0.04] border-white/10 hover:border-white/20 focus:border-[#4f8dff] text-white placeholder:text-white/50 rounded-[12px] light:bg-[#f4f6fa] light:border-[#e2e4ea] light:text-[#0e1019] light:placeholder:text-[#9aa3b2]"
							/>
						</div>
						
						{/* Квадратная кнопка генерации — только иконка */}
						<button
							type="button"
							disabled={isPending || !hasLocation || !quantity || parseInt(quantity) < 1}
							className="proxy-generator__generate-btn w-full md:w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-[12px] bg-gradient-to-b from-[#4f8dff] to-[#2f6bff] text-white shadow-[0_14px_40px_-12px_rgba(59,130,246,0.8)] disabled:opacity-50 disabled:cursor-not-allowed transition-transform hover:-translate-y-0.5 disabled:hover:translate-y-0"
							onClick={() => {
								if (!hasLocation) {
									toast.error(T("package.proxyGenerator.selectCountry"))
									return
								}
								if (!quantity || parseInt(quantity) < 1) {
									toast.error(T("package.proxyGenerator.enterQuantity"))
									return
								}
								const quantityNum = parseInt(quantity)
								const rotationType = rotation === "auto" ? "BY_REQUEST" : "BY_TIME"
								if (rotationType === "BY_TIME" && (!rotationInterval || rotationInterval < rotMin)) {
									toast.error(`${T("package.proxyGenerator.selectRotationTime")} (${rotMin}–${rotMax})`)
									return
								}
								if (!packageId) {
									toast.error("Пакет не выбран")
									return
								}
								generateProxy(
									{
										packageId,
										location: effectiveLocation,
										rotation: rotationType,
										quantity: quantityNum,
										rotationInterval: rotationType === "BY_TIME" ? rotationInterval : undefined,
										// Фильтры region/city/isp применяются и к PREMIUM_RESIDENTIAL (PE),
										// и к RESIDENT_PREMIUM (Mango) — см. задача 2 ТЗ
										...(showLocationFilters && region ? { region } : {}),
										...(showLocationFilters && city ? { city } : {}),
										...(showLocationFilters && isp ? { isp } : {}),
									},
									{
										onSuccess: (data) => {
											const proxiesArray = Array.isArray(data) ? data : [data]
											const generatedProxies = proxiesArray.map((item: { proxyPort: { serverHost: string; port: number; login: string; password: string } }) =>
												`${item.proxyPort.serverHost}:${item.proxyPort.port}:${item.proxyPort.login}:${item.proxyPort.password}`
											)
											setNewProxies(prev => [...prev, ...generatedProxies])
											toast.success(T("package.proxyGenerator.generationSuccess"))
										},
										onError: (error: Error) => {
											toast.error(error.message || T("package.proxyGenerator.generationError"))
										}
									}
								)
							}}
						>
							{isPending ? (
								<svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
									<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
									<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
								</svg>
							) : (
								<svg width="23" height="23" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
									<path d="M14.6591 8.71389C14.6464 8.76345 14.6176 8.80738 14.5772 8.83875C14.5368 8.87012 14.4871 8.88714 14.4359 8.88714C14.3847 8.88714 14.335 8.87012 14.2946 8.83875C14.2542 8.80738 14.2254 8.76345 14.2127 8.71389C13.6583 6.75885 12.1175 5.22261 10.1668 4.66581C10.1174 4.65334 10.0735 4.62473 10.0422 4.58452C10.0109 4.5443 9.99385 4.49479 9.99385 4.44381C9.99385 4.39284 10.0109 4.34332 10.0422 4.30311C10.0735 4.26289 10.1174 4.23428 10.1668 4.22181C11.1297 3.94649 12.0065 3.43026 12.7144 2.72187C13.4223 2.01348 13.938 1.13633 14.2127 0.173252C14.2254 0.123692 14.2542 0.0797648 14.2946 0.0483957C14.335 0.0170267 14.3847 0 14.4359 0C14.4871 0 14.5368 0.0170267 14.5772 0.0483957C14.6176 0.0797648 14.6464 0.123692 14.6591 0.173252C15.2135 2.12829 16.7548 3.66477 18.705 4.22133C18.7546 4.23372 18.7985 4.26231 18.83 4.30255C18.8614 4.3428 18.8784 4.39239 18.8784 4.44345C18.8784 4.49451 18.8614 4.5441 18.83 4.58435C18.7985 4.6246 18.7546 4.65318 18.705 4.66557C16.7548 5.22237 15.2135 6.76101 14.6593 8.71365L14.6591 8.71389ZM22.6684 13.1251C21.9461 13.3318 21.2883 13.7192 20.7572 14.2507C20.2261 14.7821 19.8392 15.4401 19.6329 16.1625C19.5837 16.3358 19.3475 16.3358 19.3009 16.1625C19.0947 15.44 18.7077 14.782 18.1766 14.2505C17.6455 13.719 16.9878 13.3316 16.2654 13.1249C16.2278 13.1162 16.1943 13.0951 16.1703 13.0649C16.1462 13.0348 16.1332 12.9973 16.1332 12.9588C16.1332 12.9202 16.1462 12.8828 16.1703 12.8526C16.1943 12.8224 16.2278 12.8013 16.2654 12.7927C17.7294 12.3789 18.8845 11.2236 19.3009 9.75741C19.3097 9.71994 19.3308 9.68652 19.361 9.6626C19.3911 9.63868 19.4284 9.62566 19.4669 9.62566C19.5054 9.62566 19.5427 9.63868 19.5729 9.6626C19.603 9.68652 19.6241 9.71994 19.6329 9.75741C20.0493 11.2236 21.2044 12.3789 22.6684 12.7927C22.8436 12.8419 22.8436 13.0737 22.6684 13.1251ZM13.0667 15.8865C10.1411 16.7189 7.83062 19.0248 7.00046 21.9549C6.98167 22.0297 6.93844 22.0961 6.87763 22.1435C6.81683 22.1909 6.74193 22.2166 6.66482 22.2166C6.58772 22.2166 6.51282 22.1909 6.45202 22.1435C6.39121 22.0961 6.34798 22.0297 6.32918 21.9549C5.49902 19.0269 3.1931 16.7189 0.262944 15.8865C0.187972 15.8683 0.121292 15.8255 0.0736075 15.7648C0.0259229 15.7042 0 15.6292 0 15.5521C0 15.4749 0.0259229 15.4 0.0736075 15.3394C0.121292 15.2787 0.187972 15.2359 0.262944 15.2177C3.18854 14.3873 5.49902 12.0816 6.32918 9.15117C6.34762 9.07607 6.3907 9.00932 6.45155 8.9616C6.5124 8.91388 6.58749 8.88794 6.66482 8.88794C6.74215 8.88794 6.81725 8.91388 6.8781 8.9616C6.93895 9.00932 6.98203 9.07607 7.00046 9.15117C7.83086 12.0768 10.1365 14.3875 13.0667 15.2177C13.1417 15.2359 13.2084 15.2787 13.256 15.3394C13.3037 15.4 13.3296 15.4749 13.3296 15.5521C13.3296 15.6292 13.3037 15.7042 13.256 15.7648C13.2084 15.8255 13.1417 15.8683 13.0667 15.8865Z" fill="currentColor"/>
								</svg>
							)}
						</button>
					</div>
					
					{/* Range для выбора времени жизни (только для BY_TIME) */}
					{rotation === "time" && (
						<div className="flex flex-col gap-2">
							<span className="text-white/60 light:text-[#5b6472] text-base font-normal">
								{T("package.proxyGenerator.rotationTime")}
							</span>
							<Range
								min={rotMin}
								max={rotMax}
								step={1}
								marks={[`${rotMin} ${T("package.proxyGenerator.minutesShort")}`, `${rotMax} ${T("package.proxyGenerator.minutesShort")}`]}
								value={rotationInterval}
								onChange={setRotationInterval}
							/>
						</div>
					)}
				</div>
				
				{/* Второй блок — Ваши прокси (шаблон мобильных прокси) */}
				<div className="rounded-[16px] border border-white/[0.06] light:border-[#e2e4ea] bg-white/[0.02] light:bg-[#f4f6fa] pt-6 px-6 pb-6 flex flex-col gap-4 flex-1 min-h-[165px]">
					{/* Заголовок и кнопки в одном ряду */}
					<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
						<h3 className="text-white light:text-[#0e1019] font-[TalosDisplay] text-[18px] font-semibold leading-[1.2] tracking-[-0.01em]">
							{T("package.proxyGenerator.yourProxies")}
						</h3>
						<div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:justify-end">
							<button
								className={`inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 w-full min-w-0 justify-center md:w-auto light:border-[#e2e4ea] light:bg-[#f4f6fa] light:text-[#0e1019] light:hover:bg-[#eef1f6] ${allProxies.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
								type="button"
								disabled={allProxies.length === 0}
								onClick={async () => {
									if (allProxies.length === 0) return
									await navigator.clipboard.writeText(allProxies.join("\n"))
									toast.success(T("package.proxyGenerator.copySuccess"))
								}}
							>
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
									<rect x="7" y="3" width="14" height="15" fill="white"/>
									<path d="M6.5 6.2158V3.90625C6.5 3.1296 7.1296 2.5 7.90625 2.5H20.0938C20.8704 2.5 21.5 3.1296 21.5 3.90625V16.0938C21.5 16.8704 20.8704 17.5 20.0938 17.5H17.7582" stroke="#0067FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
									<path d="M16.0938 6.5H3.90625C3.1296 6.5 2.5 7.1296 2.5 7.90625V20.0938C2.5 20.8704 3.1296 21.5 3.90625 21.5H16.0938C16.8704 21.5 17.5 20.8704 17.5 20.0938V7.90625C17.5 7.1296 16.8704 6.5 16.0938 6.5Z" fill="#0067FF" stroke="#0067FF" strokeWidth="2" strokeLinejoin="round"/>
								</svg>
								<span>{T("package.proxyGenerator.copy")}</span>
							</button>
							<button
								className={`inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 w-full min-w-0 justify-center md:w-auto light:border-[#e2e4ea] light:bg-[#f4f6fa] light:text-[#0e1019] light:hover:bg-[#eef1f6] ${allProxies.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
								type="button"
								disabled={allProxies.length === 0}
								onClick={() => {
									if (allProxies.length === 0) return
									const blob = new Blob([allProxies.join("\n")], { type: "text/plain" })
									const url = URL.createObjectURL(blob)
									const a = document.createElement("a")
									a.href = url
									a.download = "proxies.txt"
									document.body.appendChild(a)
									a.click()
									document.body.removeChild(a)
									URL.revokeObjectURL(url)
								}}
							>
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
									<rect x="7.59961" y="5.40002" width="11" height="15.4" fill="white"/>
									<path d="M20.602 3.398C18.38 1.176 13.452 1 12 1C10.548 1 5.62 1.176 3.398 3.398C1.176 5.62 1 10.548 1 12C1 13.452 1.176 18.38 3.398 20.602C5.62 22.824 10.548 23 12 23C13.452 23 18.38 22.824 20.602 20.602C22.824 18.38 23 13.452 23 12C23 10.548 22.824 5.62 20.602 3.398ZM14.2 18.6H9.8C9.50826 18.6 9.22847 18.4841 9.02218 18.2778C8.81589 18.0715 8.7 17.7917 8.7 17.5C8.7 17.2083 8.81589 16.9285 9.02218 16.7222C9.22847 16.5159 9.50826 16.4 9.8 16.4H14.2C14.4917 16.4 14.7715 16.5159 14.9778 16.7222C15.1841 16.9285 15.3 17.2083 15.3 17.5C15.3 17.7917 15.1841 18.0715 14.9778 18.2778C14.7715 18.4841 14.4917 18.6 14.2 18.6ZM16.081 11.681L12.781 14.981C12.6787 15.0841 12.5571 15.1659 12.423 15.2218C12.289 15.2776 12.1452 15.3064 12 15.3064C11.8548 15.3064 11.711 15.2776 11.577 15.2218C11.4429 15.1659 11.3213 15.0841 11.219 14.981L7.919 11.681C7.71187 11.4739 7.5955 11.1929 7.5955 10.9C7.5955 10.6071 7.71187 10.3261 7.919 10.119C8.12613 9.91187 8.40707 9.7955 8.7 9.7955C8.99293 9.7955 9.27387 9.91187 9.481 10.119L10.9 11.549V6.5C10.9 6.20826 11.0159 5.92847 11.2222 5.72218C11.4285 5.51589 11.7083 5.4 12 5.4C12.2917 5.4 12.5715 5.51589 12.7778 5.72218C12.9841 5.92847 13.1 6.20826 13.1 6.5V11.549L14.519 10.119C14.7261 9.91187 15.0071 9.7955 15.3 9.7955C15.5929 9.7955 15.8739 9.91187 16.081 10.119C16.2881 10.3261 16.4045 10.6071 16.4045 10.9C16.4045 11.1929 16.2881 11.4739 16.081 11.681Z" fill="#0067FF"/>
								</svg>
								<span>{T("package.proxyGenerator.download")} .txt</span>
							</button>
						</div>
					</div>
					
					{/* Блок со списком прокси — прозрачный фон, ~2 строки видимы, скролл + затухание по краям */}
					<div className="flex-1 min-h-0">
						{allProxies.length > 0 ? (
							<div ref={proxiesScrollRef} className="flex max-h-[180px] flex-col gap-2 overflow-y-auto pr-1">
								{allProxies.map((proxy, idx) => (
									<div key={idx} className="flex items-center justify-between gap-3 rounded-[10px] border border-white/[0.05] light:border-[#e2e4ea] bg-white/[0.03] light:bg-white px-3 py-2.5">
										<span className="min-w-0 flex-1 truncate font-mono text-[13px] text-white/80 light:text-[#475467]">{proxy}</span>
										<button
											className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[8px] border border-white/10 bg-white/[0.04] text-white transition-colors hover:bg-white/[0.1] light:border-[#e2e4ea] light:bg-[#f4f6fa] light:text-[#5b6472] light:hover:bg-[#eef1f6]"
											type="button"
											onClick={async () => {
												await navigator.clipboard.writeText(proxy)
												toast.success(T("package.proxyGenerator.copySuccess"))
											}}
										>
											<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
												<path d="M3.27308 13.091C2.37308 13.091 1.63672 12.3546 1.63672 11.4546V3.27278C1.63672 2.37278 2.37308 1.63641 3.27308 1.63641H11.4549C12.3549 1.63641 13.0913 2.37278 13.0913 3.27278M8.18217 6.5455H16.364C17.2677 6.5455 18.0004 7.27813 18.0004 8.18187V16.3637C18.0004 17.2674 17.2677 18 16.364 18H8.18217C7.27843 18 6.54581 17.2674 6.54581 16.3637V8.18187C6.54581 7.27813 7.27843 6.5455 8.18217 6.5455Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
											</svg>
										</button>
									</div>
								))}
							</div>
						) : (
							<div className="flex flex-1 w-full items-end justify-start text-left px-4 pb-4 text-[14px] text-white/45 light:text-[#8a93a3]">
								{T("package.proxyGenerator.proxiesPlaceholder")}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}

export default ProxyGenerator
