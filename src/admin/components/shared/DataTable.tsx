/**
 * Admin Data Table Component
 */

import { useState } from 'react';
import { ChevronUp, ChevronDown, Download } from 'lucide-react';

interface Column<T> {
  key: keyof T;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  onExport?: () => void;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading = false,
  onRowClick,
  searchPlaceholder = 'Search...',
  onExport,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSort = (key: keyof T) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const filteredData = data.filter((row) =>
    columns.some((col) =>
      String(row[col.key])
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    )
  );

  const sortedData = sortKey
    ? [...filteredData].sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortDirection === 'asc' ? comparison : -comparison;
      })
    : filteredData;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="admin-control max-w-md px-4 py-2"
        />

        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-200"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {columns.map((col) => (
                <th
                  key={`${String(col.key)}-${col.label}`}
                  className={`px-4 py-3 text-left text-sm font-semibold text-slate-700 ${col.width || ''}`}
                >
                  {col.sortable ? (
                    <button
                      onClick={() => handleSort(col.key)}
                      className="flex items-center gap-2 hover:text-slate-900"
                    >
                      {col.label}
                      {sortKey === col.key && (
                        sortDirection === 'asc' ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                  No data found
                </td>
              </tr>
            ) : (
              sortedData.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row)}
                  className={`border-t border-slate-200 hover:bg-slate-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {columns.map((col) => (
                    <td key={`${String(col.key)}-${col.label}`} className="px-4 py-3 text-sm text-slate-900">
                      {col.render ? col.render(row[col.key], row) : String(row[col.key])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Results count */}
      <div className="text-sm text-slate-500">
        Showing {sortedData.length} of {data.length} results
      </div>
    </div>
  );
}
