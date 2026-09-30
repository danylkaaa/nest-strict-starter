export interface Email {
  body: string;
  id: string;
  recipient: string;
  /** ISO 8601 timestamp */
  sentAt: string;
  subject: string;
}

export interface PageParams {
  page: number;
  pageSize: number;
}

export interface Page<T> extends PageParams {
  items: T[];
  total: number;
  totalPages: number;
}
