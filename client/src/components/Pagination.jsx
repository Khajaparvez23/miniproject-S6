import { useMemo } from 'react'

export default function Pagination({ total, page, pageSize, onPageChange, onPageSizeChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const pages = useMemo(() => {
    const items = []
    const start = Math.max(1, page - 2)
    const end = Math.min(totalPages, page + 2)
    for (let i = start; i <= end; i += 1) {
      items.push(i)
    }
    return items
  }, [page, totalPages])

  return (
    <div className="pagination">
      <div className="page-size">
        <span>Rows</span>
        <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={20}>20</option>
        </select>
      </div>
      <div className="page-controls">
        <button type="button" className="ghost" disabled={page === 1} onClick={() => onPageChange(page - 1)}>
          Prev
        </button>
        {pages.map((item) => (
          <button
            key={item}
            type="button"
            className={item === page ? 'primary small' : 'ghost'}
            onClick={() => onPageChange(item)}
          >
            {item}
          </button>
        ))}
        <button
          type="button"
          className="ghost"
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
      <span className="muted">Page {page} of {totalPages}</span>
    </div>
  )
}
