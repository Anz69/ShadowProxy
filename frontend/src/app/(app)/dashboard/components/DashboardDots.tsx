/**
 * Намеренный «технический» точечный фон ТОЛЬКО для дашборда. На остальных
 * лёгких страницах точки убраны (мерцали при переходах) — здесь они часть
 * дизайна. Два слоя: основная точечная сетка + редкие крупные «узловые» точки,
 * мягко затухают к низу. Тема-адаптивно. Сидит за контентом (-z-10).
 */
export default function DashboardDots() {
	return (
		<div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
			{/* основная точечная сетка */}
			<div className="absolute inset-0 bg-[radial-gradient(rgba(130,165,255,0.18)_1.2px,transparent_1.2px)] [background-size:24px_24px] [mask-image:radial-gradient(125%_80%_at_50%_0%,#000_28%,transparent_88%)] light:bg-[radial-gradient(rgba(47,107,255,0.13)_1.2px,transparent_1.2px)]" />
			{/* редкие «узлы» — крупнее и чуть ярче, на другой сетке для глубины */}
			<div className="absolute inset-0 bg-[radial-gradient(rgba(106,165,255,0.22)_1.8px,transparent_1.8px)] [background-size:96px_96px] [background-position:24px_18px] [mask-image:radial-gradient(120%_75%_at_50%_0%,#000_22%,transparent_82%)] light:bg-[radial-gradient(rgba(47,107,255,0.16)_1.8px,transparent_1.8px)]" />
		</div>
	)
}
