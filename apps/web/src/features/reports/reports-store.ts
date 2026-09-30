import { create } from 'zustand';

import type { ReportStatus } from '@/features/jobs/job';

interface ReportsState {
  expandedId: string | null;
  page: number;
  search: string;
  status: ReportStatus | null;
}

interface ReportsActions {
  setPage: (page: number) => void;
  setSearch: (search: string) => void;
  setStatus: (status: ReportStatus | null) => void;
  toggleExpanded: (id: string) => void;
}

export const initialReportsState: ReportsState = {
  expandedId: null,
  page: 1,
  search: '',
  status: null,
};

// Kept outside the page so leaving and returning to Aircraft reports restores the same view.
// Changing the page or a filter collapses the open row; filters also go back to page 1.
export const useReportsStore = create<ReportsActions & ReportsState>()((set) => ({
  ...initialReportsState,
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
