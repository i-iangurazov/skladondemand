export type PageParams = { page: number; pageSize: number; skip: number; take: number };

export const parsePageParams = (query: any, defaultPageSize = 20, maxPageSize = 100): PageParams => {
  const pageRaw = query?.page ?? 1;
  const pageSizeRaw = query?.pageSize ?? defaultPageSize;
  const page = Number(pageRaw);
  const pageSize = Number(pageSizeRaw);
  if (!Number.isFinite(page) || page < 1) throw new Error('Invalid page');
  if (!Number.isFinite(pageSize) || pageSize < 1) throw new Error('Invalid pageSize');
  const clampedSize = Math.min(Math.max(Math.floor(pageSize), 1), maxPageSize);
  const safePage = Math.max(Math.floor(page), 1);
  return { page: safePage, pageSize: clampedSize, skip: (safePage - 1) * clampedSize, take: clampedSize };
};

export const buildPageInfo = (page: number, pageSize: number, total: number) => ({
  page,
  pageSize,
  total,
  pageCount: Math.ceil(total / Math.max(pageSize, 1)),
});
