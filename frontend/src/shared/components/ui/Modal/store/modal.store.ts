import { create } from 'zustand';
import type {ReactNode} from "react";

type ModalStore = {
	isOpen: boolean;
	content: ReactNode | null;
	open: (content: ReactNode) => void;
	updateContent: (content: ReactNode) => void;
	close: () => void;
};

export const useModalStore = create<ModalStore>((set) => ({
	isOpen: false,
	content: null,
	open: (content) => set({ isOpen: true, content }),
	updateContent: (content) => set((state) => (state.isOpen ? { content } : state)),
	close: () => set({ isOpen: false, content: null }),
}));
