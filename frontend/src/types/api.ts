export type ApiResponse<T> = {
  code: number;
  message: string;
  data: T;
  fieldErrors?: Record<string, string[]>;
  requestId?: string;
};

export type PageResult<T> = {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
  viewCounts?: Record<string, number>;
};
