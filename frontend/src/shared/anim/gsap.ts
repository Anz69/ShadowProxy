"use client"

// Central GSAP init for the app. Imported by all client animation modules.
// Registers plugins once (client-side only) and defines the brand easing so
// motion matches the existing CSS language (cubic-bezier(0.16,1,0.3,1)).
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { CustomEase } from "gsap/CustomEase"
import { useGSAP } from "@gsap/react"

export const BRAND_EASE = "brand"

let registered = false

/** Idempotent, client-only plugin + defaults registration. */
export function ensureGsap() {
	if (registered || typeof window === "undefined") return
	gsap.registerPlugin(useGSAP, ScrollTrigger, CustomEase)
	// Brand ease == the project's signature cubic-bezier(0.16,1,0.3,1)
	CustomEase.create(BRAND_EASE, "0.16,1,0.3,1")
	gsap.defaults({ duration: 0.6, ease: BRAND_EASE })
	registered = true
}

// Register at import time on the client so the "brand" ease and plugins are
// ready before any component effect runs (child effects run before parents').
ensureGsap()

export const prefersReducedMotion = () =>
	typeof window !== "undefined" &&
	window.matchMedia("(prefers-reduced-motion: reduce)").matches

export const isFirefox = () =>
	typeof navigator !== "undefined" && /firefox/i.test(navigator.userAgent)

export { gsap, ScrollTrigger, useGSAP }
