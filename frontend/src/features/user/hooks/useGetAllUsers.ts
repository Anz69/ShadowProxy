import { useQuery } from "@tanstack/react-query"
import { userService } from "@/features/user/services/user.service"

export function useGetAllUsers() {
	const {data: users, isPending: isLoading} = useQuery({
		queryKey: ["admin-users"],
		queryFn: () => userService.getAll()
	})

	return {
		users,
		isLoading
	}
}