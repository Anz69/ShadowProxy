import { NextRequest, NextResponse } from "next/server"
import { getLocaleFromPath, addLocaleToPath, removeLocaleFromPath } from "@/shared/utils/getLocaleFromPath"
import { defaultLocale, supportedLocales } from "@/shared/utils/i18n"

const BACKEND_URI = process.env.NEXT_PUBLIC_BACKEND_URI

/** Only way we consider session valid: backend /users/me returns 2xx. Never trust cookie presence alone. */
async function isSessionValid(sessionValue: string | undefined): Promise<boolean> {
	if (!sessionValue?.trim() || !BACKEND_URI?.trim()) {
		return false
	}
	try {
		const res = await fetch(`${BACKEND_URI.replace(/\/$/, "")}/users/me`, {
			headers: { Cookie: `session=${sessionValue}` },
			cache: "no-store"
		})
		return res.ok
	} catch {
		return false
	}
}

/** Base URL for redirects: when behind a reverse proxy, use X-Forwarded-* so redirects point to the public URL. */
function getRedirectOrigin(request: NextRequest): string {
	const proto = request.headers.get("x-forwarded-proto")
	const host = request.headers.get("x-forwarded-host")
	if (proto && host) {
		const protocol = proto.split(",")[0].trim().toLowerCase()
		const hostname = host.split(",")[0].trim()
		return `${protocol}://${hostname}`
	}
	try {
		return new URL(request.url).origin
	} catch {
		return request.url
	}
}

export default async function middleware(request: NextRequest) {
	const { pathname, search } = request.nextUrl
	const sessionValue = request.cookies.get("session")?.value
	const redirectOrigin = getRedirectOrigin(request)

	// Get locale from path or use default (ru)
	const locale = getLocaleFromPath(pathname)
	const pathWithoutLocale = removeLocaleFromPath(pathname)

	// Validate locale - if unsupported locale in URL, return 404
	const segments = pathname.split("/").filter(Boolean)
	if (segments.length > 0) {
		const firstSegment = segments[0]
		if (firstSegment.length === 2 || firstSegment === "zh" || firstSegment === "zh-CN") {
			const isSupported = firstSegment === "ru" ||
				firstSegment === "en" ||
				firstSegment === "zh" ||
				firstSegment === "zh-CN"
			if (!isSupported) {
				return new NextResponse(null, { status: 404 })
			}
		}
	}

	// Redirect /support to Telegram
	if (pathWithoutLocale === "/support") {
		return NextResponse.redirect("https://t.me/shadowproxysupport_bot", 302)
	}

	// Handle auth routes — redirect to dashboard ONLY if backend says session is valid
	if (pathWithoutLocale.startsWith("/auth")) {
		const valid = await isSessionValid(sessionValue)
		if (valid) {
			const redirectPath = addLocaleToPath("/dashboard", locale)
			return NextResponse.redirect(new URL(redirectPath + search, redirectOrigin))
		}
		// Not authenticated or backend said invalid — show login
		if (locale !== defaultLocale || pathname.startsWith("/en/") || pathname.startsWith("/zh/")) {
			const url = request.nextUrl.clone()
			url.pathname = pathWithoutLocale
			const response = NextResponse.rewrite(url)
			response.headers.set("x-locale", locale)
			response.headers.set("x-pathname", pathname)
			response.headers.set("x-path-without-locale", pathWithoutLocale)
			return response
		}
		return NextResponse.next()
	}

	// Handle admin routes — require valid session and ADMIN role
	if (pathWithoutLocale.startsWith("/admin")) {
		if (!sessionValue?.trim()) {
			const redirectPath = addLocaleToPath("/auth/login", locale)
			return NextResponse.redirect(new URL(redirectPath + search, redirectOrigin))
		}
		const valid = await isSessionValid(sessionValue)
		if (!valid) {
			const redirectPath = addLocaleToPath("/auth/login", locale)
			return NextResponse.redirect(new URL(redirectPath + search, redirectOrigin))
		}
		try {
			const res = await fetch(`${BACKEND_URI!.replace(/\/$/, "")}/users/me`, {
				headers: { Cookie: `session=${sessionValue}` },
				cache: "no-store"
			})
			if (!res.ok) {
				const redirectPath = addLocaleToPath("/auth/login", locale)
				return NextResponse.redirect(new URL(redirectPath + search, redirectOrigin))
			}
			const data = await res.json()
			if (data.role !== "ADMIN") {
				const redirectPath = addLocaleToPath("/dashboard", locale)
				return NextResponse.redirect(new URL(redirectPath + search, redirectOrigin))
			}
		} catch {
			const redirectPath = addLocaleToPath("/auth/login", locale)
			return NextResponse.redirect(new URL(redirectPath + search, redirectOrigin))
		}
	}

	// Handle protected routes — allow only with valid session from backend
	// u-api can be accessed without auth (/support redirects above, /terms returns 404)
	const publicPaths = ["/", "/u-api", "/terms", "/privacy"]
	if (!pathWithoutLocale.startsWith("/auth") && !publicPaths.includes(pathWithoutLocale)) {
		const valid = await isSessionValid(sessionValue)
		if (!valid) {
			const redirectPath = addLocaleToPath("/auth/login", locale)
			return NextResponse.redirect(new URL(redirectPath + search, redirectOrigin))
		}
	}

	// If locale is in path and it's not default (ru), rewrite to path without locale
	// This allows /en/dashboard to work by rewriting to /dashboard internally
	if (locale !== defaultLocale || pathname.startsWith("/en/") || pathname.startsWith("/zh/")) {
		// Rewrite the URL to remove locale prefix for internal routing
		const url = request.nextUrl.clone()
		url.pathname = pathWithoutLocale
		
		const response = NextResponse.rewrite(url)
		response.headers.set("x-locale", locale)
		response.headers.set("x-pathname", pathname)
		response.headers.set("x-path-without-locale", pathWithoutLocale)
		
		return response
	}
	
	// For default locale (ru) without prefix, just add headers
	const response = NextResponse.next()
	response.headers.set("x-locale", locale)
	response.headers.set("x-pathname", pathname)
	response.headers.set("x-path-without-locale", pathWithoutLocale)

	return response
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - api (API routes)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 * - public files (public folder)
		 */
		"/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
	]
}
