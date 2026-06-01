"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { type FC, type ReactNode, useState } from "react"

type TanstackQueryProviderProps = {
	children: ReactNode
}

const TanstackQueryProvider: FC<TanstackQueryProviderProps> = ({
	children
}) => {
	const [client] = useState(
		new QueryClient({
			defaultOptions: {
				queries: {
					refetchOnWindowFocus: false
				}
			}
		})
	)

	return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

export default TanstackQueryProvider
