"use client"

import { useLayoutEffect } from "react"

const updateScale = () => {
	// Используем window.innerWidth для точного определения viewport (без учета скроллбара)
	// Это дает одинаковый результат как в device toolbar, так и при обычном изменении окна
	const viewportWidth = window.innerWidth
	const mobileBaseWidth = 360 // Базовая ширина для мобильной версии
	const desktopBaseWidth = 1920 // Базовая ширина для десктопной версии
	const breakpoint = 800 // Граница между мобильным и десктопным скейлом
	
	let scale = 1
	
	// Мобильный скейл: от 320px до 800px (база 360px)
	if (viewportWidth < breakpoint) {
		// Не ограничиваем минимальную ширину, чтобы контент масштабировался правильно
		scale = viewportWidth / mobileBaseWidth
	}
	// Десктопный скейл: от 800px до 1920px (база 1920px)
	else if (viewportWidth >= breakpoint && viewportWidth < desktopBaseWidth) {
		scale = viewportWidth / desktopBaseWidth
	}
	// Для разрешений 1920px и выше - без скейла
	else if (viewportWidth >= desktopBaseWidth) {
		scale = 1
	}
	
	// Округляем до 4 знаков для точности
	const roundedScale = Math.round(scale * 10000) / 10000
	document.documentElement.style.setProperty('--viewport-scale', String(roundedScale))
	
	// Устанавливаем тип скейла для CSS
	const scaleType = viewportWidth < breakpoint ? 'mobile' : 'desktop'
	document.documentElement.setAttribute('data-scale-type', scaleType)
}

export default function ScaleProvider({ children }: { children: React.ReactNode }) {
	useLayoutEffect(() => {
		// Начальное значение уже установлено inline скриптом в layout.tsx
		// Обновляем при изменении размера окна (без задержек для мобильных)
		window.addEventListener('resize', updateScale, { passive: true })
		
		// Также обновляем при изменении ориентации устройства
		window.addEventListener('orientationchange', updateScale, { passive: true })
		
		return () => {
			window.removeEventListener('resize', updateScale)
			window.removeEventListener('orientationchange', updateScale)
		}
	}, [])

	return <>{children}</>
}

