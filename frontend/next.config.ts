import type { NextConfig } from "next"

const nextConfig: NextConfig = {
	productionBrowserSourceMaps: true, // Стеки ошибок в production будут указывать на исходники
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "flagsapi.com",
				pathname: "/**"
			}
		],
		// Отключаем sharp в Alpine (вызывает spawn /bin/sh EACCES)
		unoptimized: true
	}
}

export default nextConfig
