"use client"

import styles from "./Modal.module.css"
import { X } from "lucide-react"
import { type FC, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"

const EXIT_MS = 240

const Modal: FC = () => {
	const { isOpen, content, close } = useModalStore()
	const [mounted, setMounted] = useState(false)
	const [closing, setClosing] = useState(false)
	const [isPaymentModal, setIsPaymentModal] = useState(false)
	const [isRedeemKeyModal, setIsRedeemKeyModal] = useState(false)
	const lastContent = useRef(content)

	if (isOpen && content) lastContent.current = content

	useEffect(() => {
		if (isOpen && content) {
			setMounted(true)
			setClosing(false)
		} else if (mounted) {
			setClosing(true)
			const t = setTimeout(() => {
				setMounted(false)
				setClosing(false)
			}, EXIT_MS)
			return () => clearTimeout(t)
		}
	}, [isOpen, content, mounted])

	useEffect(() => {
		const onEsc = (e: KeyboardEvent) => {
			if (e.key === "Escape") close()
		}
		document.addEventListener("keydown", onEsc)
		return () => document.removeEventListener("keydown", onEsc)
	}, [close])

	useEffect(() => {
		if (!mounted) return
		const id = setTimeout(() => {
			setIsPaymentModal(!!document.querySelector(".payment-modal-content"))
			setIsRedeemKeyModal(!!document.querySelector(".redeem-key-modal-content"))
		}, 0)
		return () => clearTimeout(id)
	}, [mounted])

	useEffect(() => {
		if (mounted) {
			document.body.style.overflow = "hidden"
			return () => {
				document.body.style.overflow = ""
			}
		}
	}, [mounted])

	if (!mounted) return null

	return createPortal(
		<div
			className={`${closing ? styles.appearanceOut : styles.appearance} ${isPaymentModal ? `bg-back ${styles["payment-modal-background"]}` : "bg-card/30"} fixed inset-0 z-999 flex ${isPaymentModal ? "flex-col items-stretch md:items-center" : "items-center justify-center"} ${isPaymentModal ? "p-5 md:px-4 md:py-4" : "px-4 py-4"}`}
			onClick={close}
		>
			<div
				className={`${isPaymentModal ? "" : closing ? styles.panelOut : styles.panel} ${styles.glass} relative flex ${isPaymentModal ? "" : "max-h-[90dvh] md:max-h-[80dvh]"} w-full md:min-w-[600px] flex-col gap-4 overflow-y-auto rounded-2xl sm:rounded-3xl ${isPaymentModal ? "p-0" : "p-5 sm:p-7"} md:w-auto`}
				onClick={(e) => e.stopPropagation()}
			>
				{!isPaymentModal && (
					<X
						className="text-body/40 hover:text-body/90 absolute top-4 right-4 z-10 h-6 w-6 cursor-pointer duration-200 payment-modal-close-button"
						onClick={close}
					/>
				)}
				{lastContent.current}
			</div>
		</div>,
		document.body
	)
}

export default Modal
