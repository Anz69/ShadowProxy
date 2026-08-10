import { useMutation } from "@tanstack/react-query"

import ModifyProxyModal from "@/features/proxy/components/ModifyProxyModal"
import { proxyService } from "@/features/proxy/services/proxy.service"
import type { IssueIspProxy } from "@/features/proxy/types/proxy.types"

import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"

export function useIspProxy(locations: string[]) {
	const { open } = useModalStore()

	const { mutate: issue, isPending: isLoading } = useMutation({
		mutationKey: ["isp-proxy"],
		mutationFn: (dto: IssueIspProxy) => proxyService.issueIspProxy(dto),
		onSuccess: data => {
			localStorage.setItem("proxy_type", "IPV6_GB")
			open(
				<ModifyProxyModal
					proxyIds={data.map(el => el.id)}
					type="IPV6_GB"
					isNew={true}
					locations={{
						ipv6: locations,
						premium: [],
						resident: [],
						mobile: [],
						mobile_gb: [],
						isp: []
					}}
				/>
			)
		}
	})

	return {
		issue,
		isLoading
	}
}
