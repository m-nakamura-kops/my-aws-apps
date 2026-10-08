'use client';

interface SkeletonLoaderProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
}

export default function SkeletonLoader({ 
  rows = 5, 
  columns = 4,
  showHeader = true 
}: SkeletonLoaderProps) {
  return (
    <div className="animate-pulse">
      {showHeader && (
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
      )}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div
                key={colIndex}
                className="h-4 bg-gray-200 rounded flex-1"
                style={{
                  width: colIndex === columns - 1 ? '30%' : undefined,
                }}
              ></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
