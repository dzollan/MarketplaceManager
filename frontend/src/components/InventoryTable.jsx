import { useState, useCallback, useRef, useEffect } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
} from '@tanstack/react-table'

const MIN_COL_WIDTH = 50
const LAYOUT_KEY = 'mm-table-layout-v1'

function loadLayout() {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY)
    const layout = raw ? JSON.parse(raw) : null
    if (layout?.columnOrder) {
      // Drop stale column IDs (e.g. the removed "#" index column)
      layout.columnOrder = layout.columnOrder.filter((id) => id !== 'index')
      // New columns default to the left (e.g. Product Line)
      if (!layout.columnOrder.includes('ProductLine')) {
        layout.columnOrder = ['ProductLine', ...layout.columnOrder]
      }
    }
    return layout
  } catch {
    return null
  }
}

export default function InventoryTable({ inventory, onPriceEdit, darkMode }) {
  const savedLayout = useRef(loadLayout()).current
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState([])
  const [editingCell, setEditingCell] = useState(null) // { rowIndex: number, value: string }
  const [showColMenu, setShowColMenu] = useState(false)
  const [colWidths, setColWidths] = useState(savedLayout?.colWidths ?? {})
  const [columnOrder, setColumnOrder] = useState(savedLayout?.columnOrder ?? null)
  const [columnVisibility, setColumnVisibility] = useState(savedLayout?.columnVisibility ?? {})
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [dragColId, setDragColId] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const colMenuRef = useRef(null)
  const resizeRef = useRef(null)
  const tableRef = useRef(null)

  // Persist table layout (visible columns, order, widths) to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify({ colWidths, columnOrder, columnVisibility }))
    } catch {
      // storage full or unavailable — layout just won't persist
    }
  }, [colWidths, columnOrder, columnVisibility])

  const resetLayout = useCallback(() => {
    localStorage.removeItem(LAYOUT_KEY)
    setColWidths({})
    setColumnOrder(null)
    setColumnVisibility({})
  }, [])

  // Close the column menu when clicking outside
  useEffect(() => {
    if (!showColMenu) return
    const onClick = (e) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target)) setShowColMenu(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showColMenu])

  // Column resize: track mouse movement while a handle is pressed
  const startResize = useCallback((e, column) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = column.getSize()
    resizeRef.current = { column, startX, startWidth }

    const onMove = (ev) => {
      const r = resizeRef.current
      if (!r) return
      const next = Math.max(MIN_COL_WIDTH, r.startWidth + (ev.clientX - r.startX))
      setColWidths((prev) => ({ ...prev, [r.column.id]: next }))
    }
    const onUp = () => {
      resizeRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  // Column reorder: drag the header grip onto another header
  const startDrag = useCallback((e, column) => {
    e.stopPropagation()
    e.dataTransfer.effectAllowed = 'move'
    setDragColId(column.id)
  }, [])

  const handleHeaderOver = useCallback((column) => {
    if (!dragColId || dragColId === column.id) return
    setDropTarget(column.id)
  }, [dragColId])

  const handleHeaderDrop = useCallback((column) => {
    if (dragColId && dragColId !== column.id) {
      const table = tableRef.current
      if (table) {
        setColumnOrder((prev) => {
          const order = prev ?? table.getAllLeafColumns().map((c) => c.id)
          const from = order.indexOf(dragColId)
          const to = order.indexOf(column.id)
          if (from === -1 || to === -1) return prev
          const next = [...order]
          next.splice(from, 1)
          next.splice(to, 0, dragColId)
          return next
        })
      }
    }
    setDragColId(null)
    setDropTarget(null)
  }, [dragColId])

  const columns = [
    {
      id: 'ProductLine',
      header: 'Product Line',
      accessorFn: (row) => row['Product Line'],
      size: 140,
    },
    {
      id: 'ProductName',
      header: 'Product Name',
      accessorFn: (row) => row['Product Name'],
      cell: (info) => {
        const row = info.row.original
        return (
          <>
            <div className="product-name">{info.getValue()}</div>
            {row['Title'] && <div className="product-subtitle">{row['Title']}</div>}
          </>
        )
      },
      enableColumnFilter: false,
      size: 220,
    },
    {
      id: 'SetName',
      header: 'Set',
      accessorFn: (row) => row['Set Name'],
    },
    {
      id: 'Number',
      header: 'Number',
      accessorFn: (row) => row['Number'],
    },
    {
      id: 'Rarity',
      header: 'Rarity',
      accessorFn: (row) => row['Rarity'],
    },
    {
      id: 'Condition',
      header: 'Condition',
      accessorFn: (row) => row['Condition'],
    },
    {
      id: 'Edition',
      header: 'Edition',
      accessorFn: (row) => row['Edition'],
      cell: (info) => info.getValue() || <span className="price-same">—</span>,
    },
    {
      id: 'TotalQuantity',
      header: 'Qty',
      accessorFn: (row) => parseInt(row['Total Quantity']) || 0,
      sortingFn: 'basic',
    },
    {
      id: 'MarketPrice',
      header: 'Market Price',
      accessorFn: (row) => parseFloat(row['TCG Market Price']) || 0,
      cell: (info) => `$${info.getValue().toFixed(2)}`,
    },
    {
      id: 'AvgDailySold',
      header: 'Avg Daily Sold',
      accessorFn: (row) => {
        const v = parseFloat(row['Avg Daily Sold'])
        return Number.isFinite(v) ? v : -1
      },
      cell: (info) => {
        const v = info.getValue()
        return v < 0 ? <span className="price-same">—</span> : v.toFixed(2)
      },
    },
    {
      id: 'YourPrice',
      header: 'Your Price',
      accessorFn: (row) => parseFloat(row['TCG Marketplace Price']) || 0,
      cell: (info) => {
        const rowIdx = info.row.originalIndex
        const row = info.row.original
        const isEditing = editingCell?.rowIndex === rowIdx
        const currentPrice = parseFloat(row['TCG Marketplace Price']) || 0

        if (isEditing) {
          const handleBlur = () => {
            const newPrice = parseFloat(editingCell.value) || 0
            onPriceEdit(rowIdx, newPrice)
            setEditingCell(null)
          }

          const handleKeyDown = (e) => {
            if (e.key === 'Enter') {
              handleBlur()
            } else if (e.key === 'Escape') {
              setEditingCell(null)
            }
          }

          return (
            <input
              type="number"
              step="0.01"
              min="0"
              className="price-edit-input"
              value={editingCell.value}
              onChange={(e) => setEditingCell({ rowIndex: rowIdx, value: e.target.value })}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              autoFocus
              data-dark={darkMode}
            />
          )
        }

        return (
          <span
            className="price-cell price-editable"
            onClick={() => setEditingCell({ rowIndex: rowIdx, value: currentPrice.toFixed(2) })}
          >
            ${currentPrice.toFixed(2)}
          </span>
        )
      },
    },
    {
      id: 'OldPrice',
      header: 'Old Price',
      accessorFn: (row) => row._originalPrice || 0,
      cell: (info) => <span className="price-cell price-old">${info.getValue().toFixed(2)}</span>,
    },
    {
      id: 'PriceDiff',
      header: '% Diff',
      accessorFn: (row) => {
        const newPrice = parseFloat(row['TCG Marketplace Price']) || 0
        const oldPrice = row._originalPrice || 0
        if (oldPrice === 0) return 0
        return ((newPrice - oldPrice) / oldPrice) * 100
      },
      cell: (info) => {
        const diff = info.getValue()
        const sign = diff > 0 ? '+' : ''
        const className = diff > 0 ? 'price-up' : diff < 0 ? 'price-down' : 'price-same'
        return <span className={className}>{sign}{diff.toFixed(1)}%</span>
      },
    },
  ]

  const table = useReactTable({
    data: inventory,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      globalFilter,
      columnFilters,
      columnSizing: colWidths,
      columnOrder,
      columnVisibility,
    },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    initialState: {
      pagination: { pageSize: 100 },
    },
  })
  tableRef.current = table

  if (inventory.length === 0) {
    return (
      <div className="empty-state">
        <p>No inventory loaded yet. Upload a CSV to get started.</p>
      </div>
    )
  }

  const filteredCount = table.getFilteredRowModel().rows.length
  const filterableColumns = table.getAllLeafColumns().filter((c) => c.getCanFilter())

  return (
    <div className="table-container">
      <div className="table-header">
        <h2>Inventory ({inventory.length} items)</h2>
        {filteredCount !== inventory.length && (
          <div className="filter-count">
            Showing {filteredCount} of {inventory.length}
          </div>
        )}
      </div>

      <div className="toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search all columns…"
            value={globalFilter}
            onChange={(e) => {
              setGlobalFilter(e.target.value)
              table.setPageIndex(0)
            }}
            className="input-search"
          />
        </div>
        <button
          className="btn btn-sm filters-toggle"
          onClick={() => setFiltersOpen(!filtersOpen)}
          title={filtersOpen ? 'Hide filters' : 'Show filters'}
        >
          {filtersOpen ? '▾ Hide filters' : '▸ Show filters'}
        </button>
        {filtersOpen && (
          <div className="filters-row">
            {filterableColumns.map((column) => (
              <div key={column.id} className="filter-col">
                <label>{column.columnDef.header}</label>
                <input
                  type="text"
                  placeholder={`Filter…`}
                  value={(column.getFilterValue() || '')}
                  onChange={(e) => {
                    column.setFilterValue(e.target.value)
                    table.setPageIndex(0)
                  }}
                  className="input-filter"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="table-actions">
        <div className="col-menu" ref={colMenuRef}>
          <button className="btn btn-sm" onClick={() => setShowColMenu(!showColMenu)}>
            ☰ Columns
          </button>
          {showColMenu && (
            <div className="col-menu-dropdown">
              {table.getAllLeafColumns().map((column) => (
                <label key={column.id} className="col-menu-item">
                  <input
                    type="checkbox"
                    checked={column.getIsVisible()}
                    disabled={!column.getCanHide()}
                    onChange={() => column.toggleVisibility()}
                  />
                  <span>{column.columnDef.header}</span>
                </label>
              ))}
              <button className="btn btn-sm col-menu-reset" onClick={resetLayout}>
                ↺ Reset layout
              </button>
            </div>
          )}
        </div>
        <span className="table-hint">Drag ⠿ to reorder · drag edge to resize</span>
      </div>

      <div className="table-scroll">
        <table className="inventory-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const column = header.column
                  const width = column.getSize()
                  return (
                    <th
                      key={header.id}
                      style={{ width, minWidth: width, maxWidth: width }}
                      onClick={column.getCanSort() ? column.getToggleSortingHandler() : undefined}
                      onMouseOver={() => handleHeaderOver(column)}
                      onDrop={() => handleHeaderDrop(column)}
                      onDragOver={(e) => { if (dragColId) e.preventDefault() }}
                      className={
                        (column.getCanSort() ? 'sortable ' : '') +
                        (dropTarget === column.id ? 'drop-target' : '') +
                        (dragColId === column.id ? 'dragging' : '')
                      }
                    >
                      {column.columnDef.enableReordering !== false && (
                        <span
                          className="col-grip"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'move'
                            startDrag(e, column)
                          }}
                          onDragEnd={() => { setDragColId(null); setDropTarget(null) }}
                          onClick={(e) => e.stopPropagation()}
                          title="Drag to reorder"
                        >
                          ⠿
                        </span>
                      )}
                      <span>{flexRender(column.columnDef.header, header.getContext())}</span>
                      {column.getCanSort() && (
                        <span className="sort-icon">
                          {{ asc: ' ▲', desc: ' ▼', [undefined]: '' }[column.getIsSorted()]}
                        </span>
                      )}
                      {column.getCanResize() && (
                        <span
                          className="col-resize-handle"
                          onMouseDown={(e) => startResize(e, column)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{ width: cell.column.getSize(), minWidth: cell.column.getSize(), maxWidth: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button
          className="btn btn-sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          ← Previous
        </button>
        <span className="page-numbers">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </span>
        <button
          className="btn btn-sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next →
        </button>
        <select
          value={table.getState().pagination.pageSize}
          onChange={(e) => {
            table.setPageSize(Number(e.target.value))
            table.setPageIndex(0)
          }}
          className="select-page-size"
        >
          {[50, 100, 200, 500].map((size) => (
            <option key={size} value={size}>{size} per page</option>
          ))}
        </select>
      </div>
    </div>
  )
}
