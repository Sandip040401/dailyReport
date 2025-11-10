// src/components/SkeletonLoader.jsx
import React from 'react';

export default function Loader() {
  return (
    <div className="w-full animate-pulse">
      {/* Header Skeleton */}
      <div className="bg-gray-100 p-4 rounded-t-lg border border-gray-200">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 bg-gray-300 rounded"></div>
          <div className="h-4 w-24 bg-gray-300 rounded"></div>
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-10 gap-4 bg-gray-50 p-4 border-x border-gray-200">
        <div className="h-3 bg-gray-300 rounded col-span-1"></div>
        <div className="h-3 bg-gray-300 rounded col-span-1"></div>
        <div className="h-3 bg-gray-300 rounded col-span-1"></div>
        <div className="h-3 bg-gray-300 rounded col-span-1"></div>
        <div className="h-3 bg-gray-300 rounded col-span-1"></div>
        <div className="h-3 bg-gray-300 rounded col-span-1"></div>
        <div className="h-3 bg-gray-300 rounded col-span-1"></div>
        <div className="h-3 bg-gray-300 rounded col-span-1"></div>
        <div className="h-3 bg-gray-300 rounded col-span-1"></div>
        <div className="h-3 bg-gray-300 rounded col-span-1"></div>
      </div>

      {/* Table Rows - Party 1 */}
      {[...Array(2)].map((_, idx) => (
        <div key={`row1-${idx}`} className="grid grid-cols-10 gap-4 p-4 border-x border-b border-gray-200">
          <div className="h-3 bg-gray-200 rounded col-span-1"></div>
          <div className="h-3 bg-gray-200 rounded col-span-1"></div>
          <div className="h-3 bg-gray-200 rounded col-span-1"></div>
          <div className="h-3 bg-gray-200 rounded col-span-1"></div>
          <div className="h-3 bg-gray-200 rounded col-span-1"></div>
          <div className="h-3 bg-gray-200 rounded col-span-1"></div>
          <div className="h-3 bg-gray-200 rounded col-span-1"></div>
          <div className="h-3 bg-gray-200 rounded col-span-1"></div>
          <div className="h-3 bg-gray-200 rounded col-span-1"></div>
          <div className="h-3 bg-gray-200 rounded col-span-1"></div>
        </div>
      ))}

      {/* Party Total Row */}
      <div className="grid grid-cols-10 gap-4 p-4 bg-green-50 border-x border-b border-gray-200">
        <div className="h-3 bg-green-300 rounded col-span-1"></div>
        <div className="h-3 bg-green-300 rounded col-span-1"></div>
        <div className="h-3 bg-green-300 rounded col-span-1"></div>
        <div className="h-3 bg-green-300 rounded col-span-1"></div>
        <div className="h-3 bg-green-300 rounded col-span-1"></div>
        <div className="h-3 bg-green-300 rounded col-span-1"></div>
        <div className="h-3 bg-green-300 rounded col-span-1"></div>
        <div className="h-3 bg-green-300 rounded col-span-1"></div>
        <div className="h-3 bg-green-300 rounded col-span-1"></div>
        <div className="h-3 bg-green-300 rounded col-span-1"></div>
      </div>

      {/* Table Rows - Party 2 */}
      {[...Array(2)].map((_, idx) => (
        <div key={`row2-${idx}`} className="grid grid-cols-10 gap-4 p-4 border-x border-b border-gray-200">
          <div className="h-3 bg-gray-200 rounded col-span-1"></div>
          <div className="h-3 bg-gray-200 rounded col-span-1"></div>
          <div className="h-3 bg-gray-200 rounded col-span-1"></div>
          <div className="h-3 bg-gray-200 rounded col-span-1"></div>
          <div className="h-3 bg-gray-200 rounded col-span-1"></div>
          <div className="h-3 bg-gray-200 rounded col-span-1"></div>
          <div className="h-3 bg-gray-200 rounded col-span-1"></div>
          <div className="h-3 bg-gray-200 rounded col-span-1"></div>
          <div className="h-3 bg-gray-200 rounded col-span-1"></div>
          <div className="h-3 bg-gray-200 rounded col-span-1"></div>
        </div>
      ))}

      {/* NP Badge Row */}
      <div className="grid grid-cols-10 gap-4 p-4 bg-yellow-50 border-x border-b border-gray-200">
        <div className="h-6 w-10 bg-yellow-300 rounded"></div>
        <div className="col-span-9"></div>
      </div>

      {/* Party Total Row */}
      <div className="grid grid-cols-10 gap-4 p-4 bg-green-50 border-x border-b border-gray-200 rounded-b-lg">
        <div className="h-3 bg-green-300 rounded col-span-1"></div>
        <div className="h-3 bg-green-300 rounded col-span-1"></div>
        <div className="h-3 bg-green-300 rounded col-span-1"></div>
        <div className="h-3 bg-green-300 rounded col-span-1"></div>
        <div className="h-3 bg-green-300 rounded col-span-1"></div>
        <div className="h-3 bg-green-300 rounded col-span-1"></div>
        <div className="h-3 bg-green-300 rounded col-span-1"></div>
        <div className="h-3 bg-green-300 rounded col-span-1"></div>
        <div className="h-3 bg-green-300 rounded col-span-1"></div>
        <div className="h-3 bg-green-300 rounded col-span-1"></div>
      </div>
    </div>
  );
}
