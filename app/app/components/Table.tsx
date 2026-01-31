import React from 'react';

interface TableProps {
  headers: string[];
  rows: (string | React.ReactNode)[][];
  className?: string;
}

export default function Table({ headers, rows, className = '' }: TableProps) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-[#1F2937]">
        <thead className="bg-[#121826]">
          <tr>
            {headers.map((header, index) => (
              <th
                key={index}
                className="px-6 py-4 text-left text-xs font-medium text-[#9CA3AF] uppercase tracking-wider leading-relaxed"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-[#0B0F14] divide-y divide-[#1F2937]">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-[#121826]/50 transition-colors">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-6 py-4 whitespace-nowrap text-sm text-[#f1f5f9] leading-relaxed">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
