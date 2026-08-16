'use client';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export default function TableSkeleton({ rows = 5, columns = 5 }: TableSkeletonProps) {
  return (
    <div className="animate-pulse">
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {/* ヘッダー */}
        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
          <div className="flex gap-4">
            {Array.from({ length: columns }).map((_, index) => (
              <div
                key={index}
                className="h-4 bg-gray-200 rounded flex-1"
              ></div>
            ))}
          </div>
        </div>
        {/* 行 */}
        <div className="divide-y divide-gray-200">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="px-6 py-4">
              <div className="flex gap-4">
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <div
                    key={colIndex}
                    className="h-4 bg-gray-200 rounded flex-1"
                  ></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
