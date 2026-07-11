"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CsvTableProps {
  headers: string[];
  rows: Record<string, string | number | null | undefined>[];
  pageSize?: number;
}

export default function CsvTable({ headers, rows, pageSize = 20 }: CsvTableProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalRows = rows.length;
  const totalPages = Math.ceil(totalRows / pageSize);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalRows);
  const currentRows = rows.slice(startIndex, endIndex);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
        No records found.
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="table-wrapper">
        <table className="custom-table">
          <thead>
            <tr>
              <th className="w-12 text-center text-xs text-slate-400">#</th>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentRows.map((row, idx) => (
              <tr key={idx}>
                <td className="text-center text-xs font-mono text-slate-400">
                  {startIndex + idx + 1}
                </td>
                {headers.map((header) => {
                  const val = row[header];
                  return (
                    <td key={header} title={val !== null && val !== undefined ? String(val) : ""}>
                      {val !== null && val !== undefined && val !== "" ? (
                        String(val)
                      ) : (
                        <span className="text-slate-300 dark:text-slate-700 italic">empty</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-2 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800/80">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Showing <span className="font-semibold text-slate-800 dark:text-slate-200">{startIndex + 1}</span> to{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{endIndex}</span> of{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{totalRows}</span> records
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Page {currentPage} of {totalPages}
            </div>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
