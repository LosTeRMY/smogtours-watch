// Pagination ‹ 1 2 3 … 200 › (composants Figma « Page » et « Chevron »).
// Rien n'est affiché s'il n'y a qu'une page.

import { pagerItems } from "./data";

interface Props {
  page: number;
  pages: number;
  onPage: (n: number) => void;
}

export default function Pager({ page, pages, onPage }: Props) {
  if (pages <= 1) return null;

  return (
    <nav className="pager">
      <button
        className="pg chevron"
        title="Previous page"
        disabled={page === 1}
        onClick={() => onPage(page - 1)}>
        ‹
      </button>
      {pagerItems(page, pages).map((n, i) =>
        n === null ? (
          <span className="pg-gap" key={`gap${i}`}>
            …
          </span>
        ) : (
          <button
            className={"pg" + (n === page ? " active" : "")}
            key={n}
            onClick={() => onPage(n)}>
            {n}
          </button>
        ),
      )}
      <button
        className="pg chevron"
        title="Next page"
        disabled={page === pages}
        onClick={() => onPage(page + 1)}>
        ›
      </button>
    </nav>
  );
}
