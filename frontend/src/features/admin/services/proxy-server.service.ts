import axios, { type AxiosInstance } from "axios"
import { extractError } from "@/shared/utils/extract-error"

export type ProxyServer = {
    id: string
    host: string
    status: "ACTIVE" | "OFFLINE"
    createdAt: string
    updatedAt: string
    currentLoad: number // Динамически высчитывается на бэкенде
    _count: {
        ports: number
    }
}

class ProxyServerService {
    private readonly api: AxiosInstance

    constructor() {
        this.api = axios.create({
            baseURL: `${process.env.NEXT_PUBLIC_BACKEND_URI}/proxy-server`,
            withCredentials: true
        })
    }

    async getAll() {
        try {
            const res = await this.api.get<ProxyServer[]>("/")
            return res.data
        } catch (e) {
            throw new Error(extractError(e))
        }
    }

    async getById(id: string) {
        try {
            const res = await this.api.get<ProxyServer>(`/${id}`)
            return res.data
        } catch (e) {
            throw new Error(extractError(e))
        }
    }

    async create(data: {
        host: string
    }) {
        try {
            const res = await this.api.post<ProxyServer>("/", data)
            return res.data
        } catch (e) {
            throw new Error(extractError(e))
        }
    }

    async update(
        id: string,
        data: {
            host?: string
            status?: "ACTIVE" | "OFFLINE"
        },
    ) {
        try {
            const res = await this.api.put<ProxyServer>(`/${id}`, data)
            return res.data
        } catch (e) {
            throw new Error(extractError(e))
        }
    }

    async delete(id: string) {
        try {
            const res = await this.api.delete<{ success: boolean }>(`/${id}`)
            return res.data
        } catch (e) {
            throw new Error(extractError(e))
        }
    }

    async toggleStatus(id: string) {
        try {
            const res = await this.api.post<ProxyServer>(`/${id}/toggle-status`)
            return res.data
        } catch (e) {
            throw new Error(extractError(e))
        }
    }

    async generateServerToken(serverId: string) {
        try {
            const res = await this.api.post<{ token: string; serverId: string }>(`/${serverId}/generate-token`, {})
            return res.data
        } catch (e) {
            throw new Error(extractError(e))
        }
    }
}

export const proxyServerService = new ProxyServerService()

