import { type FC, useState } from "react"
import toast from "react-hot-toast"

import type { Prices } from "@/features/proxy/types/proxy.types"
import { useIssueMobileV2 } from "@/features/proxy/hooks/useProxyEmpireFilters"

import Button from "@/shared/components/ui/Button"
import Continent from "@/shared/components/widgets/Continent"
import {
	type ContinentCode,
	continentNames,
	countriesByContinent
} from "@/shared/utils/countries-by-continent"
import type { User } from "@/features/user/types/user.types"
import { useQueryClient } from "@tanstack/react-query"

type MobileFormProps = {
	locations: string[]
	prices: Prices
	user: User | null
}

const MobileForm: FC<MobileFormProps> = ({ locations, prices, user }) => {
	const [selectedCountry, setSelectedCountry] = useState("")
	const [quantity, setQuantity] = useState<number>(1)
	const { mutateAsync: issueMobile, isPending } = useIssueMobileV2()
	const queryClient = useQueryClient()

	const pricePerGb = typeof prices.mobile === "number" ? prices.mobile : 0

	const handleSubmit = async () => {
		if (!user) {
			toast.error("Вы должны быть авторизованы для выполнения этого действия")
			return
		}
		if (!selectedCountry) {
			toast.error("Выберите страну")
			return
		}
		try {
			const result = await issueMobile({
				location: selectedCountry,
				quantity
			})
			toast.success(`Создано ${result.length} прокси`)
			queryClient.invalidateQueries({ queryKey: ["proxies"] })
			queryClient.invalidateQueries({ queryKey: ["user"] })
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Ошибка при создании прокси")
		}
	}

	return (
		<div className="flex w-full flex-col gap-2 md:gap-6">
			<div className="flex w-full flex-col gap-2">
				{Object.entries(continentNames).map((el, idx) => {
					const countries = locations.filter(loc =>
						countriesByContinent[el[0] as ContinentCode].includes(loc.toUpperCase())
					)

					return (
						<Continent
							label={el[1]}
							key={el[0]}
							countries={countries}
							isOpenedByDefault={idx <= 1 && !!countries.length}
							selectedCountry={selectedCountry}
							onChange={setSelectedCountry}
						/>
					)
				})}
			</div>
			<div className="flex w-full flex-col gap-2">
				<span className="text-body/50 text-2xl font-semibold">Количество прокси</span>
				<input
					type="number"
					min={1}
					max={100}
					value={quantity}
					onChange={e => setQuantity(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
					className="bg-card/25 text-body border-body/25 hover:border-primary focus:border-primary w-full rounded-xl border-2 px-4 py-2 text-base font-medium duration-200 outline-none"
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
				disabled={!selectedCountry?.length || isPending}
			>
				{isPending ? "Создание..." : "Создать прокси"}
			</Button>
		</div>
	)
}

export default MobileForm
