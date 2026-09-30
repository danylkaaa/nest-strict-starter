import { create } from 'zustand';

import type { ReportStatus } from '@/features/jobs/job';

interface ReportsState {
  page: number;
  search: string;
  status: ReportStatus | null;
}

interface ReportsActions {
  setPage: (page: number) => void;
  setSearch: (search: string) => void;
  setStatus: (status: ReportStatus | null) => void;
}

export const initialReportsState: ReportsState = { page: 1, search: '', status: null };

// Kept outside the page so leaving and returning to Aircraft reports restores the same view.
// Filters go back to page 1.
export const useReportsStore = create<ReportsActions & ReportsState>()((set) => ({
  ...initialReportsState,
  setPage: (page) => {
    set({ page });
  },
  setSearch: (search) => {
    set({ page: 1, search });
  },
  setStatus: (status) => {
    set({ page: 1, status });
  },
}));
