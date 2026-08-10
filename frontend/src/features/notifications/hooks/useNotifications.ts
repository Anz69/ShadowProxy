import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { notificationService } from "@/features/notifications/services/notification.service"

export function useUnreadCount(enabled: boolean) {
	return useQuery({
		queryKey: ["notifications-unread"],
		queryFn: () => notificationService.unreadCount(),
		enabled,
		refetchInterval: 60_000
	})
}

export function useNotifications(enabled: boolean) {
	return useQuery({
		queryKey: ["notifications-list"],
		queryFn: () => notificationService.list(1),
		enabled
	})
}

export function useMarkNotificationRead() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (id: string) => notificationService.markRead(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["notifications-unread"] })
			qc.invalidateQueries({ queryKey: ["notifications-list"] })
		}
	})
}

export function useMarkAllNotificationsRead() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: () => notificationService.markAllRead(),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["notifications-unread"] })
			qc.invalidateQueries({ queryKey: ["notifications-list"] })
		}
	})
}
