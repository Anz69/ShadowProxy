import { useQuery } from "@tanstack/react-query"
import { proxyServerService } from "../services/proxy-server.service"

export function useProxyServers() {
    const { data: servers, isLoading, refetch } = useQuery({
        queryKey: ["proxy-servers"],
        queryFn: () => proxyServerService.getAll(),
        refetchInterval: 60000, // Авто-обновление каждую минуту
    })

    return {
        servers,
        isLoading,
        refetch,
    }
}

