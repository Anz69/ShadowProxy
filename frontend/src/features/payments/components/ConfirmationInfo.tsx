import Image from "next/image"

import { formatSeconds } from "@/shared/utils/format-seconds"

type Props = {
	parsedData: { country: string; rentTime: number; price: number }
}

const ConfirmationInfo = ({ parsedData }: Props) => {
	const regionNames = new Intl.DisplayNames(["ru"], { type: "region" })

	return (
		<>
			<div className="flex w-full flex-row items-start justify-between">
				<span className="text-body/50 text-lg font-semibold md:text-2xl">
					Тип прокси
				</span>
				<span className="text-body text-base font-semibold md:text-xl">
					Мобильные
				</span>
			</div>
			<div className="flex w-full flex-row items-start justify-between">
				<span className="text-body/50 text-lg font-semibold md:text-2xl">
					Страна
				</span>
				<span className="text-body flex flex-row items-center gap-1 text-base font-semibold md:text-xl">
					{regionNames.of(parsedData.country)}
					<Image
						src={`https://flagsapi.com/${parsedData.country.toUpperCase()}/flat/64.png`}
						alt={
							regionNames.of(
								parsedData.country.toUpperCase()
							) as string
						}
						width={64}
						height={44}
						className="h-5 w-8 rounded-md object-cover"
						draggable={false}
					/>
				</span>
			</div>
			<div className="flex w-full flex-row items-start justify-between">
				<span className="text-body/50 text-lg font-semibold md:text-2xl">
					Срок аренды
				</span>
				<span className="text-body text-base font-semibold md:text-xl">
					{formatSeconds(parsedData.rentTime)}
				</span>
			</div>
			<div className="flex w-full flex-row items-start justify-between">
				<span className="text-body/50 text-lg font-semibold md:text-2xl">
					Цена
				</span>
				<span className="text-body text-base font-semibold md:text-xl">
					{parsedData.price} $
				</span>
			</div>
		</>
	)
}

export default ConfirmationInfo
