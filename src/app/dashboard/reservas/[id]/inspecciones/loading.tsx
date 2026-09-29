// src/app/dashboard/reservas/[id]/inspecciones/loading.tsx

export default function InspeccionesLoading() {
  return (
    <div className="p-6 max-w-3xl mx-auto animate-pulse">
      <div className="mb-6">
        <div className="h-4 w-24 bg-gray-100 rounded mb-4" />
        <div className="h-6 w-48 bg-gray-200 rounded-lg" />
        <div className="h-3 w-32 bg-gray-100 rounded mt-1.5" />
      </div>

      {/* Botones nueva inspección */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="h-9 w-40 bg-gray-200 rounded-lg" />
        <div className="h-9 w-40 bg-gray-100 rounded-lg" />
      </div>

      {/* Tarjetas de inspecciones */}
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 mb-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-5 w-28 bg-gray-200 rounded" />
            <div className="h-4 w-24 bg-gray-100 rounded" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="h-8 w-full bg-gray-100 rounded-lg" />
            ))}
          </div>
          <div className="h-3 w-3/4 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  )
}
