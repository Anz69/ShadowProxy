import { useMutation, useQueryClient } from "@tanstack/react-query"
import { proxyServerService } from "../services/proxy-server.service"
import toast from "react-hot-toast"

export function useCreateProxyServer() {
    const queryClient = useQueryClient()

    const { mutate: createServer, isPending: isLoading } = useMutation({
        mutationKey: ["create-proxy-server"],
        mutationFn: (data: {
            host: string
        }) => proxyServerService.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["proxy-servers"],
            })
            toast.success("Сервер успешно создан!")
        },
        onError: (error: Error) => {
            toast.error(error.message)
        },
    })

    return {
        createServer,
        isLoading,
    }
}

