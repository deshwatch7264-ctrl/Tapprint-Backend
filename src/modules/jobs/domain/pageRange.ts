import { UnprocessableError } from '../../../shared/errors/http-errors';

/**
 * Parses a page range string like "1-3,5,8-10" and returns the count of
 * distinct pages selected, validated against the document's total page count.
 * A null/empty range means "all pages".
 */
export function countPagesInRange(range: string | undefined, totalPages: number): number {
  if (!range || range.trim() === '') {
    return totalPages;
  }

  const selected = new Set<number>();
  const segments = range.split(',').map((s) => s.trim());

  for (const segment of segments) {
    if (/^\d+$/.test(segment)) {
      selected.add(Number.parseInt(segment, 10));
    } else if (/^\d+-\d+$/.test(segment)) {
      const [startStr, endStr] = segment.split('-');
      const start = Number.parseInt(startStr, 10);
      const end = Number.parseInt(endStr, 10);
      if (start > end) {
        throw new UnprocessableError(`Invalid page range: ${segment}`);
      }
      for (let p = start; p <= end; p += 1) selected.add(p);
    } else {
      throw new UnprocessableError(`Invalid page range token: ${segment}`);
    }
  }

  for (const page of selected) {
    if (page < 1 || page > totalPages) {
      throw new UnprocessableError(
        `Page ${page} is out of bounds (document has ${totalPages} pages)`,
      );
    }
  }

  return selected.size;
}
