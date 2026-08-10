import { useMutation, useQueryClient } from "@tanstack/react-query"
import { proxyServerService } from "../services/proxy-server.service"
import toast from "react-hot-toast"

export function useDeleteProxyServer() {
    const queryClient = useQueryClient()

    const { mutate: deleteServer, isPending: isLoading } = useMutation({
        mutationKey: ["delete-proxy-server"],
        mutationFn: (id: string) => proxyServerService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["proxy-servers"],
            })
            toast.success("Сервер успешно удалён!")
        },
        onError: (error: Error) => {
            toast.error(error.message)
        },
    })

    return {
        deleteServer,
        isLoading,
    }
}

