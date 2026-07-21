import { useState } from 'react'
import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, getFilteredRowModel, useReactTable } from '@tanstack/react-table'

export default function InventoryTable({ inventory }) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState([])

  const columns = [
    {
      id: 'index',
      header: '#',
      cell: (info) => info.row.index + 1,
      enableSorting: false,
      enableColumnFilter: false,
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
      sortingFn: 'basic',
    },
    {
      id: 'MarketPrice',
      header: 'Market Price',
      accessorFn: (row) => parseFloat(row['TCG Market Price']) || 0,
      cell: (info) => `$${info.getValue().toFixed(2)}`,
    },
    {
      id: 'YourPrice',
      header: 'Your Price',
      accessorFn: (row) => parseFloat(row['TCG Marketplace Price']) || 0,
      cell: (info) => <span className="price-cell">${info.getValue().toFixed(2)}</span>,
    },
    {
      id: 'OldPrice',
      header: 'Old Price',
      accessorFn: (row) => row._originalPrice || 0,
      cell: (info) => <span className="price-cell price-old">$${info.getValue().toFixed(2)}</span>,
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
    },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    initialState: {
      pagination: { pageSize: 100 },
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
        <div className="filters-row">
          {table.getAllLeafColumns().slice(2, -3).map((column) => (
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
      </div>

      <table className="inventory-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  className={header.column.getCanSort() ? 'sortable' : ''}
                >
                  <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                  {header.column.getCanSort() && (
                    <span className="sort-icon">
                      {{ asc: ' ▲', desc: ' ▼', [undefined]: '' }[header.column.getIsSorted()]}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

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
