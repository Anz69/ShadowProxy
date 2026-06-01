import { useMutation } from "@tanstack/react-query"
import { useRouter, usePathname } from "next/navigation"
import toast from "react-hot-toast"

import { trialService } from "@/features/trial/services/trial.service"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"
import { getLocaleFromPath, addLocaleToPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"

export function useTrial() {
	const { close } = useModalStore()
	const router = useRouter()
	const pathname = usePathname()
	const locale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, locale)

	// Бэк может прийти сырым ключом (если i18n-fallback не сработал) — мапим вручную.
	const localizeTrialError = (raw: string): string => {
		const map: Record<string, string> = {
			"errors.trial_already_received": "trialModal.errors.alreadyReceived",
			"errors.invalid_tariff_for_trial": "trialModal.errors.invalidTariff",
			"errors.trial_requires_linked_account": "trialModal.errors.requireLink",
			"errors.trial_identity_already_used": "trialModal.errors.identityUsed",
			"errors.package_not_created": "trialModal.errors.packageNotCreated"
		}
		const key = map[raw]
		if (key) {
			const translated = T(key)
			if (translated !== key) return translated
		}
		return raw
	}

	const { mutate: getTrial, isPending: isLoading } = useMutation({
		mutationKey: ["get-trial"],
		mutationFn: (tariffType: string) => trialService.getTrial(tariffType),
		onSuccess: (userPackageId: string) => {
			toast.success(T("trialModal.successToast"))
			close()
			const localizedPath = addLocaleToPath(`/packages/${userPackageId}`, locale)
			router.push(localizedPath)
		},
		onError: (error: Error) => {
			toast.error(localizeTrialError(error.message) || T("trialModal.errors.generic"))
		}
	})

	return {
		getTrial,
		isLoading
	}
}
