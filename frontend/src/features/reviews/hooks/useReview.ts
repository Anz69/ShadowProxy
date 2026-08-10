import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { reviewService } from "@/features/reviews/services/review.service"

export function useMyReview() {
	return useQuery({
		queryKey: ["my-review"],
		queryFn: () => reviewService.myReview()
	})
}

export function useCreateReview() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (dto: { rating: number; text: string }) => reviewService.create(dto),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["my-review"] })
		}
	})
}
