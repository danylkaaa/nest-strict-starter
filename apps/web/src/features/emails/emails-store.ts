import { create } from 'zustand';

import type { SentEmailStatus } from '@/features/jobs/job';

interface EmailsState {
  expandedId: string | null;
  page: number;
  search: string;
  status: SentEmailStatus | null;
}

interface EmailsActions {
  setPage: (page: number) => void;
  setSearch: (search: string) => void;
  setStatus: (status: SentEmailStatus | null) => void;
  toggleExpanded: (id: string) => void;
}

export const initialEmailsState: EmailsState = {
  expandedId: null,
  page: 1,
  search: '',
  status: null,
};

// Kept outside the page so leaving and returning to Emails restores the same view.
// Changing the page or a filter collapses the open row; filters also go back to page 1.
export const useEmailsStore = create<EmailsActions & EmailsState>()((set) => ({
  ...initialEmailsState,
  setPage: (page) => {
    set({ expandedId: null, page });
  },
  setSearch: (search) => {
    set({ expandedId: null, page: 1, search });
  },
  setStatus: (status) => {
    set({ expandedId: null, page: 1, status });
  },
  toggleExpanded: (id) => {
    set((state) => ({ expandedId: state.expandedId === id ? null : id }));
  },
}));
