import type { Metadata } from "next"

import Layout from "@/shared/components/ui/Layout"
import { requireAuth } from "@/shared/server/requireAuth"
import PageBackground from "@/shared/components/widgets/PageBackground"

import SupportClient from "./SupportClient"

export const metadata: Metadata = {
	title: "Поддержка"
}

export default async function SupportPage() {
	const user = await requireAuth()

	return (
		<Layout header={true} user={user}>
			<div className="relative min-h-screen w-full overflow-hidden font-[TalosInter] text-white light:text-[#0e1019]">
				<PageBackground />
				<div className="relative z-[1]">
					<SupportClient />
				</div>
			</div>
		</Layout>
	)
}
