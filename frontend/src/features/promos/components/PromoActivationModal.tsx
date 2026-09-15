"use client"

import { useState } from "react"
import { Gift, Sparkles } from "lucide-react"
import { useMutation } from "@tanstack/react-query"
import { usePathname, useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { promoService } from "../services/promo.service"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"
import { getLocaleFromPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"

export default function PromoActivationModal() {
	const [code, setCode] = useState("")
	const router = useRouter()
	const pathname = usePathname()
	const T = (key: string) => t(key, getLocaleFromPath(pathname))
	const close = useModalStore(state => state.close)
	const mutation = useMutation({
		mutationFn: () => promoService.activate(code),
		onSuccess: result => {
			toast.success(T("dashboard.promo.success").replace("{amount}", result.amount.toFixed(2)))
			close()
			router.refresh()
		},
		onError: (error: Error) => toast.error(error.message)
	})

	return (
		<div className="w-full max-w-[480px] overflow-hidden rounded-[22px] border border-white/[0.1] bg-[radial-gradient(120%_100%_at_100%_0%,rgba(59,130,246,.2),transparent_52%),linear-gradient(145deg,#101d38,#080f1f)] p-6 text-white shadow-2xl sm:p-8">
			<div className="mb-6 flex items-start gap-4">
				<span className="grid size-12 shrink-0 place-items-center rounded-[15px] border border-[#6aa5ff]/30 bg-[#2f6bff]/15 text-[#78adff]"><Gift className="size-6" /></span>
				<div><h2 className="font-[TalosDisplay] text-2xl font-bold">{T("dashboard.promo.title")}</h2><p className="mt-1 text-sm leading-6 text-white/50">{T("dashboard.promo.description")}</p></div>
			</div>
			<label className="block">
				<span className="mb-2 block text-sm font-medium text-white/65">{T("dashboard.promo.code")}</span>
				<input autoFocus value={code} onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} onKeyDown={event => { if (event.key === "Enter" && code.length >= 3) mutation.mutate() }} placeholder={T("dashboard.promo.placeholder")} className="h-13 w-full rounded-[14px] border border-white/10 bg-white/[0.05] px-4 font-mono text-base tracking-[.08em] text-white outline-none transition focus:border-[#6aa5ff]/60 focus:ring-4 focus:ring-[#2f6bff]/15" />
			</label>
			<button type="button" disabled={code.length < 3 || mutation.isPending} onClick={() => mutation.mutate()} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#5595ff] to-[#2f6bff] px-6 font-semibold shadow-[0_16px_38px_-14px_rgba(59,130,246,.9)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0">
				<Sparkles className="size-4" />{mutation.isPending ? T("dashboard.promo.pending") : T("dashboard.promo.activate")}
			</button>
		</div>
	)
}
