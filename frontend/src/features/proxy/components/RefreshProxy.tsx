"use client"

import { type FC } from "react"

import Button from "@/shared/components/ui/Button"
import Card from "@/shared/components/ui/Card"
import Copy from "@/shared/components/ui/Copy"
import Footnote from "@/shared/components/ui/Footnote"

type RefreshProxyProps = {
	success: boolean
	error?: string
	newIp?: string
}

const RefreshProxy: FC<RefreshProxyProps> = ({
	success,
	error,
	newIp,
}) => {
	return (
		<Card className="w-[600px]">
			<h2 className="text-body text-3xl font-semibold">Смена айпи</h2>
			{success ? (
				<Footnote
					variant="success"
					className="!text-center !font-semibold"
				>
					Успешная смена!
				</Footnote>
			) : (
				<Footnote
					variant="error"
					className="!text-center !font-semibold"
				>
					{error}
				</Footnote>
			)}
			{success && (
				<div className="flex w-full flex-col items-center gap-1">
					<span className="text-body/50 text-2xl font-semibold">
						Новый IP:
					</span>
					<span className="text-body text-3xl font-semibold">
						{newIp}
					</span>
				</div>
			)}
			{
				success && <Button
					variant="fill"
					type="button"
					onClick={() => window.location.reload()}
				>
					Сменить ещё раз
				</Button>
			}
			{!success && (
				<Button
					variant="fill"
					type="button"
					onClick={() => window.location.reload()}
				>
					Повторить попытку
				</Button>
			)}
		</Card>
	)
}

export default RefreshProxy
