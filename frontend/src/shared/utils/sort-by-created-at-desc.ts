type WithCreatedAt = { createdAt: string }

export function sortByCreatedAtDesc<T extends WithCreatedAt>(
	a: T,
	b: T
): number {
	return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}
