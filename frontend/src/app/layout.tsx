import "./globals.css"
import type { Metadata } from "next"
// montserrat removed to use local Struve font
import NextTopLoader from "nextjs-toploader"
import { headers } from "next/headers"

import Modal from "@/shared/components/ui/Modal/ui/Modal"
import TanstackQueryProvider from "@/shared/providers/TanstackQueryProvider"
import { Toaster } from "react-hot-toast"
import ScaleProvider from "./ScaleProvider"
import AnimProvider from "@/shared/anim/AnimProvider"
import PageLoader from "@/shared/components/widgets/PageLoader"
import { getLocale } from "@/shared/server/getLocale"


export const metadata: Metadata = {
	title: {
		absolute: "Shadow Proxy",
		template: "%s | Shadow Proxy"
	}
}

export default async function RootLayout({
	children
}: Readonly<{
	children: React.ReactNode
}>) {
	const locale = await getLocale()
	const headersList = await headers()
	
	// Get domain from request headers
	const host = headersList.get("host") || ""
	const protocol = headersList.get("x-forwarded-proto") || "https"
	const baseUrl = `${protocol}://${host}`
	
	// Get pathname from headers (set by middleware)
	const pathname = headersList.get("x-pathname") || "/"
	const pathWithoutLocale = headersList.get("x-path-without-locale") || "/"
	
	// Import utility functions
	const { addLocaleToPath } = await import("@/shared/utils/getLocaleFromPath")
	
	// Canonical URL: for Russian (default) use path without /ru/, for others use with locale
	const canonicalPath = locale === "ru" 
		? pathWithoutLocale 
		: addLocaleToPath(pathWithoutLocale, locale)
	const canonicalUrl = `${baseUrl}${canonicalPath}`
	
	// Hreflang URLs - Russian without prefix, others with prefix
	const ruUrl = `${baseUrl}${pathWithoutLocale}`
	const enUrl = `${baseUrl}${addLocaleToPath(pathWithoutLocale, "en")}`
	const zhUrl = `${baseUrl}${addLocaleToPath(pathWithoutLocale, "zh-CN")}`
	
	return (
		<html lang={locale} suppressHydrationWarning>
			<head>
				<link rel="canonical" href={canonicalUrl} />
				<link rel="alternate" hrefLang="ru" href={ruUrl} />
				<link rel="alternate" hrefLang="en" href={enUrl} />
				<link rel="alternate" hrefLang="zh-CN" href={zhUrl} />
				<link rel="alternate" hrefLang="x-default" href={ruUrl} />
			</head>
			<body className="antialiased" suppressHydrationWarning>
				<script
					dangerouslySetInnerHTML={{
						__html: `
							(function() {
								// Apply saved theme before paint to avoid a dark→light flash.
								try { if (localStorage.getItem('sp-theme') === 'light') document.documentElement.classList.add('light'); } catch (e) {}
							})();
						`
					}}
				/>
				<PageLoader />
				<ScaleProvider>
					<TanstackQueryProvider>
						<Modal />
						<AnimProvider />
						<Toaster position="top-right" gutter={10} toastOptions={{
						className: "sp-toast",
						duration: 3500,
						success: {
							className: "sp-toast sp-toast--success",
							iconTheme: { primary: "#22c55e", secondary: "#ffffff" },
							duration: 3000
						},
						error: {
							className: "sp-toast sp-toast--error",
							iconTheme: { primary: "#ef4444", secondary: "#ffffff" },
							duration: 4500
						},
						loading: {
							className: "sp-toast sp-toast--loading",
							iconTheme: { primary: "#4f8dff", secondary: "#ffffff" }
						}
					}}/>
					<NextTopLoader
						shadow={false}
						easing="ease-in-out"
						color="#0067FF"
						showSpinner={false}
					/>
						{children}
					</TanstackQueryProvider>
				</ScaleProvider>
			</body>
		</html>
	)
}
