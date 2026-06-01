import styles from "./Loader.module.css"
import type { FC } from "react"

type LoaderProps = {
	size?: number
	color?: string
	weight?: number
}

const Loader: FC<LoaderProps> = ({ size = 20, color = "#edf6f9", weight = 2 }) => {
	return (
		<span
			className={styles.loader}
			style={{
				width: size,
				height: size,
				border: `${weight}px solid ${color}`
			}}
		></span>
	)
}

export default Loader
