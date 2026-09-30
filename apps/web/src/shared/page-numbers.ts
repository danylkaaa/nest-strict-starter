export type PageNumber = number | 'gap';

/** First, last, and the pages next to the current one; runs of skipped pages collapse to a gap */
export const pageNumbers = (current: number, total: number): PageNumber[] => {
  const pages: PageNumber[] = [];
  for (let page = 1; page <= total; page += 1) {
    if (page === 1 || page === total || Math.abs(page - current) <= 1) pages.push(page);
    else if (pages.at(-1) !== 'gap') pages.push('gap');
  }
  return pages;
};
