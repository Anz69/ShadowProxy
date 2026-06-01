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
								const viewportWidth = window.innerWidth;
								const mobileBaseWidth = 360;
								const desktopBaseWidth = 1920;
								const breakpoint = 800;
								let scale = 1;
								
								if (viewportWidth < breakpoint) {
									scale = viewportWidth / mobileBaseWidth;
								} else if (viewportWidth >= breakpoint && viewportWidth < desktopBaseWidth) {
									scale = viewportWidth / desktopBaseWidth;
								} else if (viewportWidth >= desktopBaseWidth) {
									scale = 1;
								}
								
								const roundedScale = Math.round(scale * 10000) / 10000;
								document.documentElement.style.setProperty('--viewport-scale', String(roundedScale));
								const scaleType = viewportWidth < breakpoint ? 'mobile' : 'desktop';
								document.documentElement.setAttribute('data-scale-type', scaleType);
							})();
						`
					}}
				/>
				<ScaleProvider>
					<TanstackQueryProvider>
						<Modal />
						<AnimProvider />
						<Toaster position="top-right" toastOptions={{
						style: {
							background: '#18191D',
							color: '#EDF6F9',
							borderRadius: 12,
							fontFamily: "var(--font-struve)",
							fontWeight: 600
						},
						icon: null,
						error: {
							style: {
								background: 'color-mix(in srgb, #18191D 85%, #E84646 15%)',
								border: "2px solid #E84646",
								color: "#E84646"
							},
						},
						success: {
							style: {
								background: 'color-mix(in srgb, #18191D 85%, #2FC972 15%)',
								border: "2px solid #2FC972",
								color: "#2FC972"
							},
							duration: 4000
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
