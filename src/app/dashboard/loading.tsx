// src/app/dashboard/loading.tsx
// Skeleton del dashboard home

export default function DashboardLoading() {
  return (
    <div className="p-6 max-w-5xl mx-auto animate-pulse">
      {/* Encabezado */}
      <div className="mb-8">
        <div className="h-6 w-48 bg-gray-200 rounded-lg" />
        <div className="h-4 w-64 bg-gray-100 rounded mt-2" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="w-9 h-9 bg-gray-100 rounded-lg mb-3" />
            <div className="h-7 w-12 bg-gray-200 rounded mb-1" />
            <div className="h-3 w-28 bg-gray-100 rounded mt-2" />
          </div>
        ))}
      </div>

      {/* Paneles de actividad */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="h-4 w-28 bg-gray-200 rounded" />
              <div className="h-3 w-14 bg-gray-100 rounded" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-gray-200 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-3/4 bg-gray-200 rounded" />
                    <div className="h-3 w-1/2 bg-gray-100 rounded" />
                  </div>
                  <div className="h-3 w-16 bg-gray-100 rounded flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
