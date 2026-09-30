import { create } from 'zustand';

interface EmailsState {
  expandedId: string | null;
  page: number;
}

interface EmailsActions {
  nextPage: () => void;
  prevPage: () => void;
  setExpandedId: (id: string | null) => void;
}

export const initialEmailsState: EmailsState = { expandedId: null, page: 1 };

// Page bounds are enforced by the UI, which knows totalPages from the query result.
export const useEmailsStore = create<EmailsActions & EmailsState>()((set) => ({
  ...initialEmailsState,
  nextPage: () => {
    set((state) => ({ expandedId: null, page: state.page + 1 }));
  },
  prevPage: () => {
    set((state) => ({ expandedId: null, page: Math.max(1, state.page - 1) }));
  },
  setExpandedId: (expandedId) => {
    set({ expandedId });
  },
}));
