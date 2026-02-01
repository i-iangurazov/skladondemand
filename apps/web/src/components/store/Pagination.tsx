'use client';

type PaginationProps = {
  page: number;
  maxKnownPage: number;
  maxNavigablePage?: number;
  totalPages?: number | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onPageChange: (nextPage: number) => void;
};

const clampPage = (value: number) => (value < 1 ? 1 : value);

const buildPageList = (current: number, maxPage: number) => {
  if (maxPage <= 7) {
    return Array.from({ length: maxPage }, (_, index) => index + 1);
  }

  const pages = new Set<number>();
  pages.add(1);
  pages.add(maxPage);
  pages.add(current);
  pages.add(current - 1);
  pages.add(current + 1);

  if (current <= 4) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }

  if (current >= maxPage - 3) {
    pages.add(maxPage - 1);
    pages.add(maxPage - 2);
    pages.add(maxPage - 3);
  }

  return Array.from(pages)
    .filter((value) => value >= 1 && value <= maxPage)
    .sort((a, b) => a - b);
};

export default function Pagination({
  page,
  maxKnownPage,
  maxNavigablePage,
  totalPages = null,
  hasNextPage,
  hasPreviousPage,
  onPageChange,
}: PaginationProps) {
  const current = clampPage(page);
  const resolvedTotal = typeof totalPages === 'number' && totalPages > 0 ? totalPages : null;
  const pageCount = resolvedTotal ?? Math.max(1, maxKnownPage);
  const showNumbers = resolvedTotal !== null;
  const list = showNumbers ? buildPageList(current, pageCount) : [];
  const maxPage = maxNavigablePage ?? maxKnownPage;

  return (
    <div className="flex w-full items-center justify-between gap-4 border-t border-border pt-6">
      <div className="flex w-full items-center justify-between gap-3 sm:hidden">
        <button
          type="button"
          onClick={() => onPageChange(current - 1)}
          disabled={!hasPreviousPage}
          className="h-9 cursor-pointer border border-border px-3 text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-foreground hover:bg-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          Prev
        </button>
        <button
          type="button"
          onClick={() => onPageChange(current + 1)}
          disabled={!hasNextPage}
          className="h-9 cursor-pointer border border-border px-3 text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-foreground hover:bg-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>

      <div className="hidden w-full items-center justify-between gap-4 sm:flex">
        <button
          type="button"
          onClick={() => onPageChange(current - 1)}
          disabled={!hasPreviousPage}
          className="h-9 cursor-pointer border border-border px-3 text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-foreground hover:bg-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          Prev
        </button>
        <div className="flex items-center gap-2">
          {showNumbers ? (
            list.map((value, index) => {
              const prev = list[index - 1];
              const showEllipsis = prev && value - prev > 1;
              const isDisabled = value !== current && value > maxPage;
              return (
                <span key={`page-${value}`} className="flex items-center gap-2">
                  {showEllipsis ? (
                    <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">…</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onPageChange(value)}
                    disabled={isDisabled}
                    className={`h-9 min-w-[36px] cursor-pointer border px-3 text-xs uppercase tracking-[0.2em] transition-colors ${
                      value === current
                        ? 'border-foreground text-foreground'
                        : `border-border text-muted-foreground hover:border-foreground hover:bg-hover hover:text-foreground${
                            isDisabled ? ' pointer-events-none opacity-40' : ''
                          }`
                    }`}
                  >
                    {value}
                  </button>
                </span>
              );
            })
          ) : (
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Page {current}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onPageChange(current + 1)}
            disabled={!hasNextPage}
            className="h-9 cursor-pointer border border-border px-3 text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-foreground hover:bg-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
