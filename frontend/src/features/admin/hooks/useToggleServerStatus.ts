import { useMutation, useQueryClient } from "@tanstack/react-query"
import { proxyServerService } from "../services/proxy-server.service"
import toast from "react-hot-toast"

export function useToggleServerStatus() {
    const queryClient = useQueryClient()

    const { mutate: toggleStatus, isPending: isLoading } = useMutation({
        mutationKey: ["toggle-server-status"],
        mutationFn: (id: string) => proxyServerService.toggleStatus(id),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["proxy-servers"],
            })
            toast.success("Статус сервера изменён!")
        },
        onError: (error: Error) => {
            toast.error(error.message)
        },
    })

    return {
        toggleStatus,
        isLoading,
    }
}

