"use client"

import type { FC } from "react"

import AdminNav from "@/features/admin/components/AdminNav"
import KeysList from "@/features/keys/components/KeysList"
import { useGetAllKeys } from "@/features/keys/hooks/useGetAllKeys"

import Loader from "@/shared/components/ui/Loader/Loader"
import CreateKey from "@/features/keys/components/CreateKey"

const Keys: FC = () => {
	const { keys } = useGetAllKeys()

	if (!keys)
		return (
			<div className="flex h-full w-full items-center justify-center">
				<Loader weight={5} size={80} />
			</div>
		)
	return (
		<div className="relative z-[1] flex w-full flex-col gap-6">
			<h1 className="font-[TalosDisplay] text-4xl font-semibold text-white md:text-5xl">
				Ключи
			</h1>
			<AdminNav active="/admin/keys" />
			<div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2">
				<CreateKey/>
				<KeysList keys={keys} />
			</div>
		</div>
	)
}

export default Keys
