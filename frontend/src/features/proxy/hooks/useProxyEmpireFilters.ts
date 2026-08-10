import { useMutation, useQuery } from "@tanstack/react-query"

import { proxyEmpireService } from "@/features/proxy/services/proxy-empire.service"
import type { IssuePremiumResidentialProxy, IssueMobileV2Proxy } from "@/features/proxy/types/proxy.types"

type ConnectionType = "residential" | "mobile"

export function useEmpireRegions(connectionType: ConnectionType, country: string | null | undefined) {
	return useQuery({
		queryKey: ["empire-regions", connectionType, country],
		queryFn: () => proxyEmpireService.getRegions(connectionType, country!),
		enabled: !!country && country.length === 2
	})
}

export function useEmpireCities(
	connectionType: ConnectionType,
	country: string | null | undefined,
	region?: string | null
) {
	return useQuery({
		queryKey: ["empire-cities", connectionType, country, region],
		queryFn: () => proxyEmpireService.getCities(connectionType, country!, region ?? undefined),
		enabled: !!country && country.length === 2
	})
}

export function useEmpireIsps(
	connectionType: ConnectionType,
	country: string | null | undefined,
	region?: string | null,
	city?: string | null
) {
	return useQuery({
		queryKey: ["empire-isps", connectionType, country, region, city],
		queryFn: () =>
			proxyEmpireService.getIsps(connectionType, country!, region ?? undefined, city ?? undefined),
		enabled: !!country && country.length === 2
	})
}

// Mango Residential Proxy filters (задача 2 ТЗ)
export function useMangoRegions(country: string | null | undefined) {
	return useQuery({
		queryKey: ["mango-regions", country],
		queryFn: () => proxyEmpireService.getMangoRegions(country!),
		enabled: !!country && country.length === 2
	})
}

export function useMangoCities(country: string | null | undefined, region?: string | null) {
	return useQuery({
		queryKey: ["mango-cities", country, region],
		queryFn: () => proxyEmpireService.getMangoCities(country!, region ?? undefined),
		enabled: !!country && country.length === 2
	})
}

export function useMangoIsps(
	country: string | null | undefined,
	region?: string | null,
	city?: string | null
) {
	return useQuery({
		queryKey: ["mango-isps", country, region, city],
		queryFn: () =>
			proxyEmpireService.getMangoIsps(country!, region ?? undefined, city ?? undefined),
		enabled: !!country && country.length === 2
	})
}

export function useIssuePremiumResidential() {
	return useMutation({
		mutationKey: ["issue-premium-residential"],
		mutationFn: (dto: IssuePremiumResidentialProxy) => proxyEmpireService.issuePremiumResidential(dto)
	})
}

export function useIssueMobileV2() {
	return useMutation({
		mutationKey: ["issue-mobile-v2"],
		mutationFn: (dto: IssueMobileV2Proxy) => proxyEmpireService.issueMobile(dto)
	})
}
