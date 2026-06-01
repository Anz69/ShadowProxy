import axios, { type AxiosInstance } from "axios"
import { extractError } from "@/shared/utils/extract-error"

class TrialService {
	private readonly api: AxiosInstance

	constructor() {
		this.api = axios.create({
			baseURL: `${process.env.NEXT_PUBLIC_BACKEND_URI}/users`,
			withCredentials: true
		})
	}

	async getTrial(tariffType: string): Promise<string> {
		try {
			const res = await this.api.post<{ userPackageId: string }>("/trial", {
				tariffType
			})
			return res.data.userPackageId
		} catch (e) {
			throw new Error(extractError(e))
		}
	}
}

export const trialService = new TrialService()

