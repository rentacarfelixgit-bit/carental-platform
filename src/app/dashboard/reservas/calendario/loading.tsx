// src/app/dashboard/reservas/calendario/loading.tsx

export default function CalendarioLoading() {
  return (
    <div className="p-6 animate-pulse">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
          <div className="h-7 w-48 bg-gray-200 rounded mb-1" />
          <div className="h-4 w-32 bg-gray-100 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-gray-200 rounded-lg" />
          <div className="h-9 w-16 bg-gray-200 rounded-lg" />
          <div className="h-9 w-24 bg-gray-200 rounded-lg" />
        </div>
      </div>

      {/* Quincena tabs */}
      <div className="flex gap-2 mb-5">
        <div className="h-9 w-20 bg-blue-200 rounded-lg" />
        <div className="h-9 w-20 bg-gray-200 rounded-lg" />
      </div>

      {/* Grid */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid" style={{ gridTemplateColumns: 'repeat(15, minmax(100px, 1fr))' }}>
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={`h-${i}`} className="px-3 py-2.5 border-b border-r border-gray-200 last:border-r-0 text-center">
              <div className="h-3 w-6 bg-gray-200 rounded mx-auto mb-1" />
              <div className="h-6 w-8 bg-gray-200 rounded mx-auto" />
            </div>
          ))}
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={`c-${i}`} className="min-h-[120px] border-r border-gray-100 last:border-r-0 p-1.5 space-y-1">
              {i % 3 === 0 && <div className="h-6 bg-yellow-100 rounded w-full" />}
              {i % 4 === 1 && <div className="h-6 bg-blue-100 rounded w-full" />}
              {i % 5 === 2 && <div className="h-6 bg-green-100 rounded w-full" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
