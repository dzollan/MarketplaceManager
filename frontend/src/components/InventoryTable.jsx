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

// Data type of each column's values, used to pick the right filter UI.
const FILTER_KINDS = {
  ProductLine: 'text',
  ProductName: 'text',
  SetName: 'text',
  Number: 'text',
  Rarity: 'text',
  Condition: 'text',
  Edition: 'text',
  ReleaseDate: 'date',
  TotalQuantity: 'numeric',
  MarketPrice: 'numeric',
  AvgDailySold: 'numeric',
  YourPrice: 'numeric',
  OldPrice: 'numeric',
  PriceDiff: 'numeric',
}

const TEXT_FILTER_OPS = [
  { id: 'contains', label: 'contains' },
  { id: 'is', label: 'is' },
  { id: 'isOneOf', label: 'is one of' },
]

const NUMERIC_FILTER_OPS = [
  { id: 'gte', label: '≥' },
  { id: 'lte', label: '≤' },
  { id: 'gt', label: '>' },
  { id: 'lt', label: '<' },
  { id: 'eq', label: '=' },
]

const DATE_FILTER_OPS = [
  { id: 'before', label: 'before' },
  { id: 'after', label: 'after' },
]

function defaultFilter(kind) {
  if (kind === 'numeric') return { operator: 'gte', value: '' }
  if (kind === 'date') return { operator: 'before', value: '' }
  return { operator: 'contains', value: '' }
}

function applyColumnFilter(value, filter, kind) {
  if (!filter || filter.value === '' || filter.value == null) return true
  if (kind === 'numeric') {
    const v = parseFloat(value)
    const t = parseFloat(filter.value)
    if (!Number.isFinite(v) || !Number.isFinite(t)) return false
    switch (filter.operator) {
      case 'gte': return v >= t
      case 'lte': return v <= t
      case 'gt': return v > t
      case 'lt': return v < t
      case 'eq': return v === t
      default: return true
    }
  }
  if (kind === 'date') {
    const v = Date.parse(value)
    const t = Date.parse(filter.value)
    if (Number.isNaN(v) || Number.isNaN(t)) return false
    return filter.operator === 'before' ? v < t : v > t
  }
  // text
  const s = String(value ?? '').toLowerCase()
  const target = String(filter.value).toLowerCase()
  if (filter.operator === 'isOneOf') {
    const list = target.split(',').map((x) => x.trim()).filter(Boolean)
    return list.includes(s)
  }
  if (filter.operator === 'is') return s === target
  return s.includes(target)
}

function describeFilter(kind, filter) {
  if (kind === 'numeric') {
    const op = NUMERIC_FILTER_OPS.find((o) => o.id === filter.operator)
    return `${op?.label ?? ''} ${filter.value}`
  }
  if (kind === 'date') {
    const op = DATE_FILTER_OPS.find((o) => o.id === filter.operator)
    return `${op?.label ?? ''} ${filter.value}`
  }
  if (filter.operator === 'isOneOf') return `is one of: ${filter.value}`
  return `${filter.operator} “${filter.value}”`
}

// Per-column filter function factory (stable per column id).
// Per-column filter function factory (stable per column id).
// Library calls it as filterFn(row, columnId, resolvedValue, meta).
const makeColumnFilterFn = (columnId) => (row, id, filterValue) =>
  applyColumnFilter(row.getValue(columnId), filterValue, FILTER_KINDS[columnId] || 'text')

export default function InventoryTable({ inventory, onPriceEdit, darkMode }) {
  const savedLayout = useRef(loadLayout()).current
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState([])
  const [editingCell, setEditingCell] = useState(null) // { rowKey: string, value: string }
  const [showColMenu, setShowColMenu] = useState(false)
  const [colWidths, setColWidths] = useState(savedLayout?.colWidths ?? {})
  const [columnOrder, setColumnOrder] = useState(savedLayout?.columnOrder ?? null)
  const [columnVisibility, setColumnVisibility] = useState(savedLayout?.columnVisibility ?? {})
  const [filterMenu, setFilterMenu] = useState(null) // { columnId, x, y }
  const [draft, setDraft] = useState(null) // filter draft for the open menu
  const [dragColId, setDragColId] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const colMenuRef = useRef(null)
  const filterMenuRef = useRef(null)
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

  // Right-click a column header to open its filter menu
  const openFilterMenu = useCallback((column, e) => {
    e.preventDefault()
    const kind = FILTER_KINDS[column.id] || 'text'
    const existing = column.getFilterValue()
    setDraft(existing ?? defaultFilter(kind))
    const x = Math.max(8, Math.min(e.clientX, window.innerWidth - 300))
    const y = Math.max(8, Math.min(e.clientY, window.innerHeight - 200))
    setFilterMenu({ columnId: column.id, x, y })
  }, [])

  const closeFilterMenu = useCallback(() => {
    setFilterMenu(null)
    setDraft(null)
  }, [])

  const applyFilterMenu = useCallback(() => {
    if (!filterMenu || !draft) return
    const table = tableRef.current
    const column = table?.getColumn(filterMenu.columnId)
    if (column) {
      const hasValue = draft.value !== '' && draft.value != null
      column.setFilterValue(hasValue ? draft : undefined)
      table.setPageIndex(0)
    }
    closeFilterMenu()
  }, [filterMenu, draft, closeFilterMenu])

  // Close the filter menu on outside click or Escape
  useEffect(() => {
    if (!filterMenu) return
    const onDown = (e) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) closeFilterMenu()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') closeFilterMenu()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [filterMenu, closeFilterMenu])

  const columns = [
    {
      id: 'ProductLine',
      header: 'Product Line',
      accessorFn: (row) => row['Product Line'],
      filterFn: makeColumnFilterFn('ProductLine'),
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
      filterFn: makeColumnFilterFn('SetName'),
    },
    {
      id: 'Number',
      header: 'Number',
      accessorFn: (row) => row['Number'],
      filterFn: makeColumnFilterFn('Number'),
    },
    {
      id: 'ReleaseDate',
      header: 'Release Date',
      accessorFn: (row) => row['Release Date'] || '',
      filterFn: makeColumnFilterFn('ReleaseDate'),
      cell: (info) => info.getValue() || <span className="price-same">—</span>,
    },
    {
      id: 'Rarity',
      header: 'Rarity',
      accessorFn: (row) => row['Rarity'],
      filterFn: makeColumnFilterFn('Rarity'),
    },
    {
      id: 'Condition',
      header: 'Condition',
      accessorFn: (row) => row['Condition'],
      filterFn: makeColumnFilterFn('Condition'),
    },
    {
      id: 'Edition',
      header: 'Edition',
      accessorFn: (row) => row['Edition'],
      filterFn: makeColumnFilterFn('Edition'),
      cell: (info) => info.getValue() || <span className="price-same">—</span>,
    },
    {
      id: 'TotalQuantity',
      header: 'Qty',
      accessorFn: (row) => parseInt(row['Total Quantity']) || 0,
      filterFn: makeColumnFilterFn('TotalQuantity'),
      sortingFn: 'basic',
    },
    {
      id: 'MarketPrice',
      header: 'Market Price',
      accessorFn: (row) => parseFloat(row['TCG Market Price']) || 0,
      filterFn: makeColumnFilterFn('MarketPrice'),
      cell: (info) => `$${info.getValue().toFixed(2)}`,
    },
    {
      id: 'AvgDailySold',
      header: 'Avg Daily Sold',
      accessorFn: (row) => {
        const v = parseFloat(row['Avg Daily Sold'])
        return Number.isFinite(v) ? v : -1
      },
      filterFn: makeColumnFilterFn('AvgDailySold'),
      cell: (info) => {
        const v = info.getValue()
        return v < 0 ? <span className="price-same">—</span> : v.toFixed(2)
      },
    },
    {
      id: 'YourPrice',
      header: 'Your Price',
      accessorFn: (row) => parseFloat(row['TCG Marketplace Price']) || 0,
      filterFn: makeColumnFilterFn('YourPrice'),
      cell: (info) => {
        const row = info.row.original
        const rowKey = row._uid
        const isEditing = editingCell?.rowKey === rowKey
        const currentPrice = parseFloat(row['TCG Marketplace Price']) || 0

        if (isEditing) {
          const handleBlur = () => {
            const newPrice = parseFloat(editingCell.value) || 0
            onPriceEdit(rowKey, newPrice)
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
              onChange={(e) => setEditingCell({ rowKey, value: e.target.value })}
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
            onClick={() => setEditingCell({ rowKey, value: currentPrice.toFixed(2) })}
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
      filterFn: makeColumnFilterFn('OldPrice'),
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
      filterFn: makeColumnFilterFn('PriceDiff'),
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

  // Cancel any in-progress price edit when the visible rows change
  // (page, filter, sort, or a new inventory upload) so the edit can't
  // commit to a stale row. Sorting/filter state are serialized to
  // stable strings because the table returns fresh array refs each render.
  const pageIndex = table.getState().pagination.pageIndex
  const sortingKey = table.getState().sorting.map((s) => `${s.id}:${s.desc}`).join(',')
  const filterKey = columnFilters.map((f) => `${f.id}:${f.value}`).join(',')
  useEffect(() => {
    setEditingCell(null)
  }, [inventory, pageIndex, globalFilter, filterKey, sortingKey])

  if (inventory.length === 0) {
    return (
      <div className="empty-state">
        <p>No inventory loaded yet. Upload a CSV to get started.</p>
      </div>
    )
  }

  const filteredCount = table.getFilteredRowModel().rows.length

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
        {columnFilters.length > 0 && (
          <div className="filter-chips">
            {columnFilters.map((f) => {
              const column = table.getColumn(f.id)
              const kind = FILTER_KINDS[f.id] || 'text'
              return (
                <span key={f.id} className="filter-chip">
                  {column?.columnDef.header}: {describeFilter(kind, f.value)}
                  <button
                    onClick={() => {
                      column?.setFilterValue(undefined)
                      table.setPageIndex(0)
                    }}
                    title="Clear filter"
                  >
                    ✕
                  </button>
                </span>
              )
            })}
            <button
              className="filter-chip-clear"
              onClick={() => {
                table.resetColumnFilters()
                table.setPageIndex(0)
              }}
            >
              Clear all
            </button>
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
                      onContextMenu={(e) => openFilterMenu(column, e)}
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
                      {column.getFilterValue() != null && (
                        <span className="filter-indicator" title="Filtered">●</span>
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

      {filterMenu && draft && (() => {
        const column = table.getColumn(filterMenu.columnId)
        const kind = FILTER_KINDS[filterMenu.columnId] || 'text'
        const ops = kind === 'numeric' ? NUMERIC_FILTER_OPS : kind === 'date' ? DATE_FILTER_OPS : TEXT_FILTER_OPS
        return (
          <div
            className="filter-menu"
            ref={filterMenuRef}
            style={{ left: filterMenu.x, top: filterMenu.y }}
          >
            <div className="filter-menu-title">Filter {column?.columnDef.header}</div>
            <div className="filter-menu-row">
              <select
                value={draft.operator}
                onChange={(e) => setDraft({ ...draft, operator: e.target.value })}
                className="select"
              >
                {ops.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
              {kind === 'date' ? (
                <input
                  type="date"
                  value={draft.value}
                  onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                />
              ) : kind === 'numeric' ? (
                <input
                  type="number"
                  step="any"
                  value={draft.value}
                  onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                />
              ) : (
                <input
                  type="text"
                  placeholder={draft.operator === 'isOneOf' ? 'Comma-separated values…' : 'Value…'}
                  value={draft.value}
                  onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                />
              )}
            </div>
            <div className="filter-menu-actions">
              <button className="btn btn-sm" onClick={() => setDraft(defaultFilter(kind))}>
                Reset
              </button>
              <button className="btn btn-sm btn-primary" onClick={applyFilterMenu}>
                Apply
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
