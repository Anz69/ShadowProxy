"use client"

import { useEffect } from "react"

import { captureUtm } from "../utils/utm"

export default function UtmCapture() {
	useEffect(() => {
		captureUtm(window.location.search)
	}, [])

	return null
}
