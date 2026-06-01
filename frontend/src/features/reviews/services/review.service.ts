import axios, { type AxiosInstance } from "axios"
import { extractError } from "@/shared/utils/extract-error"

export type Review = {
	id: string
	rating: number
	text: string
	createdAt: string
}

class ReviewService {
	private readonly api: AxiosInstance

	constructor() {
		this.api = axios.create({
			baseURL: `${process.env.NEXT_PUBLIC_BACKEND_URI}`,
			withCredentials: true
		})
	}

	async create(dto: { rating: number; text: string }): Promise<Review> {
		try {
			const res = await this.api.post<Review>("/reviews", dto)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async myReview(): Promise<{
		hasReview: boolean
		review: Review | null
		eligible: boolean
		reviewDiscountGranted: boolean
	}> {
		try {
			const res = await this.api.get<{
				hasReview: boolean
				review: Review | null
				eligible: boolean
				reviewDiscountGranted: boolean
			}>("/reviews/me")
			return res.data
		} catch {
			return {
				hasReview: false,
				review: null,
				eligible: false,
				reviewDiscountGranted: false
			}
		}
	}

	async adminList(params: {
		ratings?: number[]
		sort?: "new" | "old"
		q?: string
		page?: number
	}) {
		const { ratings, ...rest } = params
		const res = await this.api.get("/admin/reviews", {
			params: {
				...rest,
				ratings: ratings && ratings.length ? ratings.join(",") : undefined
			}
		})
		return res.data as {
			items: Array<
				Review & { user: { email: string; tgLogin: string | null } }
			>
			total: number
			page: number
			limit: number
		}
	}

	async adminStats() {
		const res = await this.api.get("/admin/reviews/stats")
		return res.data as {
			total: number
			avg: number
			distribution: Record<string, number>
		}
	}

	async adminDelete(id: string) {
		await this.api.delete(`/admin/reviews/${id}`)
	}
}

export const reviewService = new ReviewService()
