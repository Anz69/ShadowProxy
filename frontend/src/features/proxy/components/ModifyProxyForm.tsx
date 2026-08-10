"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Image from "next/image"
import { type FC, useMemo } from "react"
import { useForm } from "react-hook-form"

import { useModifyProxies } from "@/features/proxy/hooks/useModifyProxies"
import {
	type ModifyProxyDto,
	modifyProxySchema
} from "@/features/proxy/schemas/modify-proxy.schema"
import type {
	Locations,
	Proxy,
	ProxyType
} from "@/features/proxy/types/proxy.types"

import Button from "@/shared/components/ui/Button"
import Footnote from "@/shared/components/ui/Footnote"
import Input from "@/shared/components/ui/Input"
import Loader from "@/shared/components/ui/Loader/Loader"
import Select from "@/shared/components/ui/Select"
import SelectWithSearch from "@/shared/components/ui/SelectWithSearch"

type ModifyProxyFormProps = {
	type: Exclude<ProxyType, "MOBILE">
	locations: Locations
	proxies: Proxy[]
}

const truncate = (text: string, limit = 17): string => {
	if (text.length <= limit) return text
	return `${text.slice(0, limit - 3)}...`
}

const ModifyProxyForm: FC<ModifyProxyFormProps> = ({
	type,
	locations,
	proxies
}) => {
	const regionNames = useMemo(
		() => new Intl.DisplayNames(["ru"], { type: "region" }),
		[]
	)

	const {
		setValue,
		setError,
		formState: { errors },
		register,
		reset,
		handleSubmit,
		watch
	} = useForm<ModifyProxyDto>({
		resolver: zodResolver(modifyProxySchema),
		defaultValues: {
			proxies: proxies.map(el => el.id),
			rotation: ""
		}
	})
	const { modifyProxies, isLoading } = useModifyProxies()

	const onSubmit = (dto: ModifyProxyDto) => {
		modifyProxies(
			{
				...dto,
				rotation: dto.rotation?.length ? dto.rotation : undefined
			},
			{
				onSuccess: () => {
					reset()
				},
				onError: ({ message }) => setError("root", { message })
			}
		)
	}

	return (
		<div className="flex flex-col gap-4 w-full md:w-auto">
			<form
				className="flex flex-col w-full md:w-auto md:flex-row items-start gap-2 md:gap-4"
				onSubmit={handleSubmit(onSubmit)}
			>
				<div className="flex flex-row w-full md:w-fit items-start gap-2 md:gap-4">
					{type !== "IPV6_GB" && (
						<div className="flex flex-col gap-1">
						<span className="text-body/50 text-base font-medium">
							Ротация
						</span>
							<Select
								value={watch("rotation") || ""}
								size="small"
								onChange={val =>
									setValue("rotation", val as "AUTO" | "BY_TIME")
								}
							>
								<Select.Option value="AUTO">
									При запросе
								</Select.Option>
								<Select.Option value="BY_TIME">
									По времени
								</Select.Option>
							</Select>
							{errors.rotation?.message && (
								<span className="text-error text-base font-medium">
								{errors.rotation.message}
							</span>
							)}
						</div>
					)}
					{watch("rotation") === "BY_TIME" && (
						<div className="flex w-full md:w-50 md:shrink-0 flex-col gap-1">
						<span className="text-body/50 text-base font-medium">
							Время ротации
						</span>
							<Input
								placeholder="Время в мин."
								min={5}
								max={90}
								type="number"
								step="1"
								error={errors.rotationInterval?.message}
								{...register("rotationInterval", {
									valueAsNumber: true
								})}
							/>
						</div>
					)}
				</div>
				<div className="flex flex-col gap-1">
					<span className="text-body/50 text-base font-medium">
						Страна
					</span>
					<SelectWithSearch
						value={watch("location") || ""}
						size="small"
						onChange={val => setValue("location", val)}
						searchInputProps={{
							placeholder: "Поиск по стране"
						}}
						className="min-w-55"
					>
						{(({
							RESIDENT: locations.premium,
							RESIDENT_PREMIUM: locations.premium,
							PREMIUM_RESIDENTIAL: locations.premiumResidential ?? [],
							IPV6_GB: locations.ipv6,
							MOBILE_GB: locations.premium,
							MOBILE: locations.mobile ?? []
						} as Record<string, string[]>)[type] || [])
							.filter(el => el.length === 2)
							.filter(
								el =>
									!["eu", "gf", "gp", "xk", "sx"].includes(el)
							)
							.map(el => (
								<SelectWithSearch.Option
									value={el}
									key={el}
									label={regionNames.of(el.toUpperCase())!}
								>
									<span className="text-body text-left text-base leading-4.5 font-medium">
										{truncate(
											regionNames.of(el.toUpperCase())!
										)}
									</span>
									<Image
										src={`https://flagsapi.com/${el.toUpperCase()}/flat/64.png`}
										alt={
											regionNames.of(
												el.toUpperCase()
											) as string
										}
										width={64}
										height={40}
										loading="lazy"
										className="h-4 w-6 rounded-sm object-cover"
										draggable={false}
									/>
								</SelectWithSearch.Option>
							))}
					</SelectWithSearch>
					{errors.location?.message && (
						<span className="text-error text-base font-medium">
							{errors.location.message}
						</span>
					)}
				</div>
				<div className="w-[140px]">
					<Button
						variant="fill"
						type="submit"
						disabled={
							(!watch("location")?.length &&
								!watch("rotation")?.length) ||
							isLoading
						}
						className="md:mt-7 !w-full"
					>
						{isLoading ? <Loader /> : "Применить"}
					</Button>
				</div>
			</form>
			{errors.root?.message && (
				<Footnote variant="error">{errors.root.message}</Footnote>
			)}
		</div>
	)
}

export default ModifyProxyForm
