import { type FC, useState, useEffect } from "react"
import toast from "react-hot-toast"
import { useQueryClient } from "@tanstack/react-query"

import type { Prices } from "@/features/proxy/types/proxy.types"
import {
	useEmpireRegions,
	useEmpireCities,
	useEmpireIsps,
	useIssuePremiumResidential
} from "@/features/proxy/hooks/useProxyEmpireFilters"

import Button from "@/shared/components/ui/Button"
import Continent from "@/shared/components/widgets/Continent"
import {
	type ContinentCode,
	continentNames,
	countriesByContinent
} from "@/shared/utils/countries-by-continent"
import type { User } from "@/features/user/types/user.types"

type PremiumResidentialFormProps = {
	locations: string[]
	prices: Prices
	user: User | null
}

type RotationType = "random" | "sticky" | "custom"

const PremiumResidentialForm: FC<PremiumResidentialFormProps> = ({ locations, prices, user }) => {
	const [country, setCountry] = useState("")
	const [region, setRegion] = useState<string>("")
	const [city, setCity] = useState<string>("")
	const [isp, setIsp] = useState<string>("")
	const [rotation, setRotation] = useState<RotationType>("random")
	const [sessionLifetime, setSessionLifetime] = useState<number>(10)
	const [quantity, setQuantity] = useState<number>(1)

	const { data: regions = [], isLoading: regionsLoading } = useEmpireRegions("residential", country || null)
	const { data: cities = [], isLoading: citiesLoading } = useEmpireCities("residential", country || null, region || null)
	const { data: isps = [], isLoading: ispsLoading } = useEmpireIsps(
		"residential",
		country || null,
		region || null,
		city || null
	)

	const { mutateAsync: issueProxy, isPending } = useIssuePremiumResidential()
	const queryClient = useQueryClient()

	useEffect(() => {
		setRegion("")
		setCity("")
		setIsp("")
	}, [country])
	useEffect(() => {
		setCity("")
		setIsp("")
	}, [region])
	useEffect(() => {
		setIsp("")
	}, [city])

	const pricePerGb = prices.premium_residential ?? 0

	const handleSubmit = async () => {
		if (!user) {
			toast.error("Вы должны быть авторизованы")
			return
		}
		if (!country) {
			toast.error("Выберите страну")
			return
		}
		try {
			const result = await issueProxy({
				location: country,
				region: region || undefined,
				city: city || undefined,
				isp: isp || undefined,
				ip_rotation_type: rotation,
				session_lifetime: rotation === "custom" ? sessionLifetime : undefined,
				quantity
			})
			toast.success(`Создано ${result.length} прокси`)
			queryClient.invalidateQueries({ queryKey: ["proxies"] })
			queryClient.invalidateQueries({ queryKey: ["user"] })
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Ошибка при создании прокси")
		}
	}

	const selectClass =
		"bg-card/25 text-body border-body/25 hover:border-primary focus:border-primary w-full rounded-xl border-2 px-4 py-2 text-base font-medium duration-200 outline-none"

	return (
		<div className="flex w-full flex-col gap-4 md:gap-6">
			<div className="flex w-full flex-col gap-2">
				<span className="text-body/50 text-2xl font-semibold">Страна</span>
				{Object.entries(continentNames).map(([code, name], idx) => {
					const countries = locations.filter(loc =>
						countriesByContinent[code as ContinentCode].includes(loc.toUpperCase())
					)
					if (!countries.length) return null
					return (
						<Continent
							label={name}
							key={code}
							countries={countries}
							isOpenedByDefault={idx <= 1}
							selectedCountry={country}
							onChange={setCountry}
						/>
					)
				})}
			</div>

			{country && (
				<div className="flex w-full flex-col gap-2">
					<span className="text-body/50 text-2xl font-semibold">
						Регион {regionsLoading && <span className="text-sm">(загрузка...)</span>}
					</span>
					<select className={selectClass} value={region} onChange={e => setRegion(e.target.value)}>
						<option value="">— Любой —</option>
						{regions.map(r => (
							<option key={r} value={r}>
								{r}
							</option>
						))}
					</select>
				</div>
			)}

			{country && region && (
				<div className="flex w-full flex-col gap-2">
					<span className="text-body/50 text-2xl font-semibold">
						Город {citiesLoading && <span className="text-sm">(загрузка...)</span>}
					</span>
					<select className={selectClass} value={city} onChange={e => setCity(e.target.value)}>
						<option value="">— Любой —</option>
						{cities.map(c => (
							<option key={c} value={c}>
								{c}
							</option>
						))}
					</select>
				</div>
			)}

			{country && (
				<div className="flex w-full flex-col gap-2">
					<span className="text-body/50 text-2xl font-semibold">
						ISP {ispsLoading && <span className="text-sm">(загрузка...)</span>}
					</span>
					<select className={selectClass} value={isp} onChange={e => setIsp(e.target.value)}>
						<option value="">— Любой —</option>
						{isps.map(i => (
							<option key={i} value={i}>
								{i}
							</option>
						))}
					</select>
				</div>
			)}

			<div className="flex w-full flex-col gap-2">
				<span className="text-body/50 text-2xl font-semibold">Ротация IP</span>
				<div className="flex flex-row flex-wrap gap-2">
					{(["random", "sticky", "custom"] as RotationType[]).map(r => (
						<button
							type="button"
							key={r}
							onClick={() => setRotation(r)}
							className={`${rotation === r ? "border-primary" : "border-body/25"} bg-card/25 text-body cursor-pointer rounded-lg border-2 px-3 py-1 text-base font-medium duration-200 hover:brightness-80`}
						>
							{r === "random" ? "Случайная" : r === "sticky" ? "Sticky" : "Custom"}
						</button>
					))}
				</div>
			</div>

			{rotation === "custom" && (
				<div className="flex w-full flex-col gap-2">
					<span className="text-body/50 text-2xl font-semibold">Session lifetime (минут, 1-120)</span>
					<input
						type="number"
						min={1}
						max={120}
						value={sessionLifetime}
						onChange={e => setSessionLifetime(Math.max(1, Math.min(120, Number(e.target.value) || 1)))}
						className={selectClass}
					/>
				</div>
			)}

			<div className="flex w-full flex-col gap-2">
				<span className="text-body/50 text-2xl font-semibold">Количество прокси</span>
				<input
					type="number"
					min={1}
					max={100}
					value={quantity}
					onChange={e => setQuantity(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
					className={selectClass}
				/>
			</div>

			<div className="border-body/25 flex w-full flex-row items-start justify-between border-t-2 pt-2 md:pt-6">
				<h1 className="text-body/50 text-2xl md:text-4xl font-semibold">Цена за ГБ:</h1>
				<span className="text-body text-2xl md:text-4xl font-semibold">{pricePerGb} $</span>
			</div>

			<Button
				variant="fill"
				type="button"
				onClick={handleSubmit}
				disabled={!country?.length || isPending}
			>
				{isPending ? "Создание..." : "Создать прокси"}
			</Button>
		</div>
	)
}

export default PremiumResidentialForm
