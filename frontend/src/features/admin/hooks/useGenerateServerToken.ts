import { useMutation, useQueryClient } from "@tanstack/react-query"
import { proxyServerService } from "../services/proxy-server.service"

export function useGenerateServerToken() {
	const queryClient = useQueryClient()

	const { mutate: generateToken, isPending } = useMutation({
		mutationFn: (serverId: string) => {
			return proxyServerService.generateServerToken(serverId)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["proxy-servers"]
			})
		},
		onError: (error) => {
			console.error('Token generation failed:', error)
		}
	})

	return { generateToken, isPending }
}
