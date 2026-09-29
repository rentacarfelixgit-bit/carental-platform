// src/app/dashboard/reservas/loading.tsx

export default function ReservasLoading() {
  return (
    <div className="p-6 max-w-6xl mx-auto animate-pulse">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-6 w-24 bg-gray-200 rounded-lg" />
          <div className="h-3 w-20 bg-gray-100 rounded mt-2" />
        </div>
        <div className="h-9 w-36 bg-gray-200 rounded-lg" />
      </div>

      {/* Filtros de estado */}
      <div className="flex flex-wrap gap-2 mb-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-7 w-20 bg-gray-100 rounded-lg" />
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-100 bg-gray-50 flex gap-4 px-4 py-3">
          <div className="h-3 w-20 bg-gray-200 rounded" />
          <div className="h-3 w-24 bg-gray-200 rounded hidden sm:block" />
          <div className="h-3 w-20 bg-gray-200 rounded hidden md:block" />
          <div className="h-3 w-14 bg-gray-200 rounded" />
          <div className="h-3 w-16 bg-gray-200 rounded ml-auto" />
        </div>
        {/* Filas */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 last:border-0">
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-36 bg-gray-200 rounded" />
              <div className="h-3 w-20 bg-gray-100 rounded" />
            </div>
            <div className="hidden sm:block space-y-1.5 w-32">
              <div className="h-3 w-28 bg-gray-200 rounded" />
              <div className="h-3 w-16 bg-gray-100 rounded font-mono" />
            </div>
            <div className="hidden md:block space-y-1.5 w-28">
              <div className="h-3 w-24 bg-gray-100 rounded" />
              <div className="h-3 w-20 bg-gray-100 rounded" />
            </div>
            <div className="h-5 w-20 bg-gray-100 rounded-full" />
            <div className="h-7 w-10 bg-gray-100 rounded-lg ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
