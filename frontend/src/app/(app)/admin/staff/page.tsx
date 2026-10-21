import type { Metadata } from "next"

import AdminNav from "@/features/admin/components/AdminNav"
import SupportAccounts from "@/features/admin/components/SupportAccounts"

import Layout from "@/shared/components/ui/Layout"
import { getUser } from "@/shared/server/getUser"

export const metadata: Metadata = {
	title: "Сотрудники"
}

export default async function AdminStaffPage() {
	const user = await getUser()

	return (
		<Layout user={user}>
			<div className="relative z-[1] flex w-full flex-col gap-6">
				<div>
					<p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#6aa5ff]">Доступы</p>
					<h1 className="font-[TalosDisplay] text-4xl font-semibold text-white md:text-5xl">Сотрудники</h1>
					<p className="mt-2 max-w-2xl text-sm text-white/50">
						Аккаунты поддержки входят по почте и паролю и видят в админке только раздел «Поддержка».
					</p>
				</div>
				<AdminNav active="/admin/staff" />
				<SupportAccounts />
			</div>
		</Layout>
	)
}
