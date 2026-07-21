import { useState } from 'react'
import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, getFilteredRowModel, useReactTable } from '@tanstack/react-table'

export default function InventoryGrid({ inventory }) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState([])

  const columns = [
    {
      id: 'ProductName',
      header: 'Product Name',
      accessorFn: (row) => row['Product Name'],
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
      id: 'Condition',
      header: 'Condition',
      accessorFn: (row) => row['Condition'],
    },
    {
      id: 'TotalQuantity',
      header: 'Qty',
      accessorFn: (row) => parseInt(row['Total Quantity']) || 0,
    },
    {
      id: 'MarketPrice',
      header: 'Market Price',
      accessorFn: (row) => parseFloat(row['TCG Market Price']) || 0,
    },
    {
      id: 'YourPrice',
      header: 'Your Price',
      accessorFn: (row) => parseFloat(row['TCG Marketplace Price']) || 0,
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
    },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    initialState: {
      pagination: { pageSize: 60 },
    },
  })

  if (inventory.length === 0) {
    return (
      <div className="empty-state">
        <p>No inventory loaded yet. Upload a CSV to get started.</p>
      </div>
    )
  }

  const filteredCount = table.getFilteredRowModel().rows.length

  return (
    <div className="grid-container">
      <div className="grid-header">
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
        <div className="filters-row">
          {table.getAllLeafColumns().map((column) => (
            <div key={column.id} className="filter-col">
              <label>{column.columnDef.header}</label>
              <input
                type="text"
                placeholder="Filter…"
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
      </div>

      <div className="sort-bar">
        <span className="sort-label">Sort by:</span>
        {table.getAllLeafColumns().map((column) => (
          <button
            key={column.id}
            className={`btn btn-sm sort-btn ${column.getIsSorted() ? 'active' : ''}`}
            onClick={column.getToggleSortingHandler()}
          >
            {column.columnDef.header}
            {{ asc: ' ↑', desc: ' ↓', [undefined]: '' }[column.getIsSorted()]}
          </button>
        ))}
      </div>

      <div className="inventory-grid">
        {table.getRowModel().rows.map((row) => {
          const item = row.original
          return (
            <div key={item['TCGplayer Id'] || row.id} className="grid-card">
              <div className="grid-card-top">
                <div className="grid-card-name">{item['Product Name']}</div>
                <div className="grid-card-price">${parseFloat(item['TCG Marketplace Price'] || 0).toFixed(2)}</div>
              </div>

              <div className="grid-card-details">
                <div className="grid-detail">
                  <span className="label">Set</span>
                  <span className="value">{item['Set Name']}</span>
                </div>
                <div className="grid-detail">
                  <span className="label">Number</span>
                  <span className="value">{item['Number']}</span>
                </div>
                <div className="grid-detail">
                  <span className="label">Condition</span>
                  <span className="value">{item['Condition']}</span>
                </div>
                <div className="grid-detail">
                  <span className="label">Qty</span>
                  <span className="value qty">{item['Total Quantity']}</span>
                </div>
                <div className="grid-detail">
                  <span className="label">Market</span>
                  <span className="value">${item['TCG Market Price'] ?? 'N/A'}</span>
                </div>
              </div>
            </div>
          )
        })}
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
          {[30, 60, 120, 300].map((size) => (
            <option key={size} value={size}>{size} per page</option>
          ))}
        </select>
      </div>
    </div>
  )
}
