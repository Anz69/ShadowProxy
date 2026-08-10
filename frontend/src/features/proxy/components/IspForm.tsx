import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter, usePathname } from "next/navigation"
import { type FC, useCallback, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import toast from "react-hot-toast"

import { useIspProxy } from "@/features/proxy/hooks/useIspProxy"
import {
	type IssueProxyDto,
	issueProxySchema
} from "@/features/proxy/schemas/issue-proxy.schema"
import type { User } from "@/features/user/types/user.types"

import Button from "@/shared/components/ui/Button"
import Footnote from "@/shared/components/ui/Footnote"
import Input from "@/shared/components/ui/Input"
import Loader from "@/shared/components/ui/Loader/Loader"
import Continent from "@/shared/components/widgets/Continent"
import {
	type ContinentCode,
	continentNames,
	countriesByContinent
} from "@/shared/utils/countries-by-continent"
import { getLocalizedPath } from "@/shared/utils/getLocalizedPath"

type IspFormProps = {
	locations: string[]
	user: User | null
}

const IspForm: FC<IspFormProps> = ({ locations, user }) => {
	const [selectedCountry, setSelectedCountry] = useState("")
	const [continent, setContinent] = useState<"GLOBAL" | "">("")
	const { issue, isLoading } = useIspProxy(locations)
	const router = useRouter()
	const pathname = usePathname()
	const {
		register,
		formState: { errors },
		setError,
		handleSubmit
	} = useForm<IssueProxyDto>({
		resolver: zodResolver(issueProxySchema),
		defaultValues: {
			quantity: 1
		}
	})

	const continentCountries = useMemo(() => {
		return Object.fromEntries(
			Object.entries(continentNames).map(([code]) => [
				code,
				locations.filter(loc =>
					countriesByContinent[code as ContinentCode].includes(
						loc.toUpperCase()
					)
				)
			])
		) as Record<string, string[]>
	}, [locations])

	const handleChange = useCallback((loc: string) => {
		if (loc.length === 2) {
			setSelectedCountry(loc)
			setContinent("")
		} else {
			setSelectedCountry("")
			setContinent(loc as "GLOBAL" | "")
		}
	}, [])

	const onSubmit = (dto: IssueProxyDto) => {
		if (user) {
			if (user.ispIpLeft < dto.quantity) {
				toast.error("Пополните баланс для выполнения этого действия")
				return
			}
			issue(
				{
					location: continent.length ? continent : selectedCountry,
					quantity: dto.quantity
				},
				{
					onError: ({ message }) => {
						setError("root", { message })
					}
				}
			)
		} else {
			toast.error(
				"Вы должны быть авторизованы для выполнения этого действия"
			)
			const localizedPath = getLocalizedPath(pathname, "/auth/login")
			router.push(localizedPath)
		}
	}

	return (
		<form
			className="flex w-full flex-col gap-6"
			onSubmit={handleSubmit(onSubmit)}
		>
			<div className="flex w-full flex-col gap-2">
				{Object.entries(continentNames).map(([code, label], idx) => (
					<Continent
						key={code}
						label={label}
						countries={continentCountries[code] ?? []}
						isOpenedByDefault={idx === 0}
						selectedCountry={selectedCountry}
						onChange={handleChange}
					/>
				))}
				<div className="flex w-full flex-row items-center gap-2">
					<span className="bg-body/25 h-0.5 w-full rounded-xs" />
					<span className="text-body/50 text-base font-semibold">
						Или
					</span>
					<span className="bg-body/25 h-0.5 w-full rounded-xs" />
				</div>
				<div className="grid w-full gap-2 md:grid-cols-3">
					<span
						onClick={() => handleChange("GLOBAL")}
						className={`${continent === "GLOBAL" ? "border-primary" : "border-body/25"} bg-card/50 text-body flex w-full cursor-pointer items-center justify-center rounded-xl border-2 py-1.5 font-semibold duration-200 hover:brightness-80 md:text-lg`}
					>
						Весь мир
					</span>
				</div>
			</div>
			<div className="flex w-full flex-col gap-2">
				<span className="text-body/50 text-lg font-medium md:text-2xl md:font-semibold">
					Количество
				</span>
				<Input
					type="number"
					step="1"
					min={1}
					max={500}
					error={errors.quantity?.message}
					{...register("quantity", {
						valueAsNumber: true
					})}
				/>
			</div>
			{!!errors.root?.message && (
				<Footnote variant="error">{errors.root.message}</Footnote>
			)}

			<Button
				variant="fill"
				type="submit"
				disabled={
					isLoading || (!selectedCountry.length && !continent.length)
				}
			>
				{isLoading ? <Loader /> : "Сгенерировать прокси"}
			</Button>
		</form>
	)
}

export default IspForm
