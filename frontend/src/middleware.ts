import { NextRequest, NextResponse } from "next/server"
import { getLocaleFromPath, addLocaleToPath, removeLocaleFromPath } from "@/shared/utils/getLocaleFromPath"
import { defaultLocale, supportedLocales } from "@/shared/utils/i18n"

const BACKEND_URI = process.env.NEXT_PUBLIC_BACKEND_URI

const SESSION_CHECK_TIMEOUT_MS = 5000

type SessionState = "valid" | "invalid" | "unknown"

/**
 * Проверка сессии через backend /users/me.
 * "invalid" — только когда backend ответил 401/403 (сессия точно мертва).
 * "unknown" — сеть/таймаут/5xx: выкидывать пользователя на логин нельзя,
 * иначе любой временный сбой backend «сбрасывает авторизацию».
 */
async function checkSession(sessionValue: string | undefined): Promise<{ state: SessionState; user?: { role?: string } }> {
	if (!sessionValue?.trim()) return { state: "invalid" }
	if (!BACKEND_URI?.trim()) return { state: "unknown" }
	try {
		const res = await fetch(`${BACKEND_URI.replace(/\/$/, "")}/users/me`, {
			headers: { Cookie: `session=${sessionValue}` },
			cache: "no-store",
			signal: AbortSignal.timeout(SESSION_CHECK_TIMEOUT_MS)
		})
		if (res.ok) {
			const user = (await res.json().catch(() => undefined)) as { role?: string } | undefined
			return { state: "valid", user }
		}
		if (res.status === 401 || res.status === 403) return { state: "invalid" }
		return { state: "unknown" }
	} catch {
		return { state: "unknown" }
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

	// Handle auth routes — redirect to dashboard ONLY if backend says session is valid
	if (pathWithoutLocale.startsWith("/auth")) {
		const { state } = await checkSession(sessionValue)
		if (state === "valid") {
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
		const { state, user } = await checkSession(sessionValue)
		if (state === "invalid") {
			const redirectPath = addLocaleToPath("/auth/login", locale)
			return NextResponse.redirect(new URL(redirectPath + search, redirectOrigin))
		}
		// state === "unknown" (backend недоступен/5xx) — пропускаем, страница сама
		// покажет ошибку данных; редирект на логин по временному сбою недопустим.
		if (state === "valid") {
			if (user?.role === "SUPPORT") {
				// Поддержке доступен только раздел /admin/support.
				if (!pathWithoutLocale.startsWith("/admin/support")) {
					const redirectPath = addLocaleToPath("/admin/support", locale)
					return NextResponse.redirect(new URL(redirectPath, redirectOrigin))
				}
			} else if (user?.role !== "ADMIN") {
				const redirectPath = addLocaleToPath("/dashboard", locale)
				return NextResponse.redirect(new URL(redirectPath + search, redirectOrigin))
			}
		}
	}

	// Handle protected routes — kick to login only on a definitive 401 from backend.
	// A transient backend error must not log the user out: the session cookie is
	// still valid, and the next successful check would just bring them back.
	// u-api, terms and privacy can be accessed without authentication.
	const publicPaths = ["/", "/u-api", "/terms", "/privacy"]
	if (!pathWithoutLocale.startsWith("/auth") && !pathWithoutLocale.startsWith("/admin") && !publicPaths.includes(pathWithoutLocale)) {
		const { state } = await checkSession(sessionValue)
		if (state === "invalid") {
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
