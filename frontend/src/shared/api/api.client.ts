import axios from "axios"

const baseURL = process.env.NEXT_PUBLIC_BACKEND_URI || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

export const apiClient = axios.create({
    baseURL,
    withCredentials: true,
})

