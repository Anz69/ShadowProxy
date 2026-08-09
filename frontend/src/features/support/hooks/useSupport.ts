"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { supportService } from "@/features/support/services/support.service"

/** Диалог поддержки: polling каждые 5с, пока страница открыта (паттерн проекта — react-query refetchInterval). */
export function useSupportThread() {
	const { data, isLoading } = useQuery({
		queryKey: ["support-thread"],
		queryFn: () => supportService.getThread(),
		refetchInterval: 5000,
		refetchIntervalInBackground: false
	})
	return { thread: data, isLoading }
}

export function useSendSupportMessage() {
	const queryClient = useQueryClient()
	const { mutate: send, isPending: isSending } = useMutation({
		mutationKey: ["support-send"],
		mutationFn: ({ text, files }: { text: string; files: File[] }) =>
			supportService.sendMessage(text, files),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["support-thread"] })
		}
	})
	return { send, isSending }
}

/** Бейдж непрочитанных ответов поддержки (для кнопок навигации). */
export function useSupportUnread(enabled: boolean = true) {
	const { data } = useQuery({
		queryKey: ["support-unread"],
		queryFn: () => supportService.unreadCount(),
		refetchInterval: 60_000,
		enabled
	})
	return data ?? 0
}
