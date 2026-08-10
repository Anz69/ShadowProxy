"use client"

import { usePathname, useRouter } from "next/navigation"
import { type FC, useEffect } from "react"

import ReviewModal from "@/features/reviews/components/ReviewModal"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"
import { addLocaleToPath, getLocaleFromPath } from "@/shared/utils/getLocaleFromPath"

const ReviewRouteLauncher: FC = () => {
	const pathname = usePathname()
	const router = useRouter()
	const { open } = useModalStore()

	useEffect(() => {
		const locale = getLocaleFromPath(pathname)
		open(<ReviewModal />)
		router.replace(addLocaleToPath("/dashboard", locale))
	}, [])

	return null
}

export default ReviewRouteLauncher
