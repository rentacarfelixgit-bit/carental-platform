// src/app/dashboard/flota/loading.tsx

export default function FlotaLoading() {
  return (
    <div className="p-6 max-w-6xl mx-auto animate-pulse">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <div className="h-6 w-16 bg-gray-200 rounded-lg" />
          <div className="h-3 w-24 bg-gray-100 rounded mt-2" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="h-9 w-28 bg-gray-100 rounded-lg" />
          <div className="h-9 w-24 bg-gray-100 rounded-lg" />
          <div className="h-9 w-36 bg-gray-200 rounded-lg" />
        </div>
      </div>

      {/* Buscador */}
      <div className="h-9 w-full sm:w-72 bg-gray-100 rounded-lg mb-5" />

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-100 bg-gray-50 flex gap-4 px-4 py-3">
          <div className="h-3 w-20 bg-gray-200 rounded" />
          <div className="h-3 w-16 bg-gray-200 rounded hidden sm:block" />
          <div className="h-3 w-20 bg-gray-200 rounded hidden md:block" />
          <div className="h-3 w-14 bg-gray-200 rounded ml-auto" />
        </div>
        {/* Filas */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 last:border-0">
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-40 bg-gray-200 rounded" />
              <div className="h-3 w-20 bg-gray-100 rounded font-mono" />
            </div>
            <div className="hidden sm:block space-y-1.5 w-16">
              <div className="h-3 w-12 bg-gray-100 rounded" />
            </div>
            <div className="hidden md:block w-24">
              <div className="h-5 w-20 bg-gray-100 rounded-full" />
            </div>
            <div className="flex gap-2 ml-auto">
              <div className="h-7 w-10 bg-gray-100 rounded-lg" />
              <div className="h-7 w-14 bg-gray-100 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
