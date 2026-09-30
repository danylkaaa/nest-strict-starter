import { create } from 'zustand';

import type { SentWebhookStatus } from '@/features/jobs/job';

interface WebhooksState {
  expandedId: string | null;
  page: number;
  search: string;
  status: SentWebhookStatus | null;
}

interface WebhooksActions {
  setPage: (page: number) => void;
  setSearch: (search: string) => void;
  setStatus: (status: SentWebhookStatus | null) => void;
  toggleExpanded: (id: string) => void;
}

export const initialWebhooksState: WebhooksState = {
  expandedId: null,
  page: 1,
  search: '',
  status: null,
};

// Kept outside the page so leaving and returning to Webhooks restores the same view.
// Changing the page or a filter collapses the open row; filters also go back to page 1.
export const useWebhooksStore = create<WebhooksActions & WebhooksState>()((set) => ({
  ...initialWebhooksState,
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
