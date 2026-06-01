"use client"

import { BadgeCent, Key } from "lucide-react"
import Link from "next/link"
import type { FC } from "react"

import { useLogout } from "@/features/auth/hooks/useLogout"
import RedeemKeyModal from "@/features/keys/components/RedeemKeyModal"
import type { User } from "@/features/user/types/user.types"

import Button from "@/shared/components/ui/Button"
import Card from "@/shared/components/ui/Card"
import Loader from "@/shared/components/ui/Loader/Loader"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"
import { formatDate } from "@/shared/utils/format-date"
import { formatTraffic } from "@/shared/utils/format-traffic"

type UserAccountProps = {
	user: User
}

const UserAccount: FC<UserAccountProps> = ({ user }) => {
	const { logout, isLoading } = useLogout()
	const { open } = useModalStore()

	return (
		<Card className="w-full !p-4 md:!px-6 md:!py-8">
			<div className="flex w-full flex-row items-start justify-between">
				<div className="flex flex-col">
					<span className="text-body/50 text-xl font-medium">
						Баланс
					</span>
					<div className="flex flex-col items-start gap-2 md:flex-row md:gap-12">
						<div className="flex flex-col">
							<span className="text-body/25 text-lg">
								Resident
							</span>
							<span className="text-body text-xl leading-5 font-semibold md:text-2xl">
								{formatTraffic(user.residentTrafficLeft)}
							</span>
						</div>
						<div className="flex flex-col">
							<span className="text-body/25 text-lg">
								Premium
							</span>
							<span className="text-body text-xl leading-5 font-semibold md:text-2xl">
								{formatTraffic(user.premiumTrafficLeft)}
							</span>
						</div>
						<div className="flex flex-col">
							<span className="text-body/25 text-lg">
								ISP
							</span>
							<span className="text-body text-xl leading-5 font-semibold md:text-2xl">
								{user.ispIpLeft} IP
							</span>
						</div>
					</div>
				</div>
				<div className="w-[90px]">
					<Button
						variant="error-outline"
						type="button"
						onClick={logout}
					>
						{isLoading ? <Loader color="#E84646" /> : "Выйти"}
					</Button>
				</div>
			</div>
			<div className="flex w-full flex-col justify-between gap-2 md:flex-row md:items-center md:gap-0">
				<div className="flex flex-col">
					<span className="text-body/50 text-lg leading-5 font-medium md:text-xl">
						Email
					</span>
					<span className="text-body text-lg font-medium md:text-xl">
						{user.email}
					</span>
				</div>
				<div className="flex flex-col">
					<span className="text-body/50 text-xl leading-5 font-medium">
						Дата регистрации
					</span>
					<span className="text-body text-xl font-medium">
						{formatDate(user.createdAt)}
					</span>
				</div>
			</div>
			<div className="flex w-full flex-col gap-2">
				<Link href="/balance" className="w-full">
					<Button variant="fill" type="button">
						<BadgeCent className="h-6 w-6" />
						Пополнить баланс
					</Button>
				</Link>
				<Button
					variant="outline"
					type="button"
					onClick={() => open(<RedeemKeyModal />)}
				>
					<Key className="h-5 w-5" />
					Активировать ключ
				</Button>
			</div>
		</Card>
	)
}

export default UserAccount
