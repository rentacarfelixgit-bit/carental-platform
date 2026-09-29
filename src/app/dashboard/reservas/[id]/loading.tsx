// src/app/dashboard/reservas/[id]/loading.tsx

export default function ReservaDetailLoading() {
  return (
    <div className="p-6 max-w-3xl mx-auto animate-pulse">
      {/* Back link */}
      <div className="mb-6">
        <div className="h-4 w-24 bg-gray-100 rounded mb-4" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="h-6 w-24 bg-gray-200 rounded-lg" />
            <div className="h-3 w-64 bg-gray-100 rounded mt-1.5 font-mono" />
          </div>
          <div className="h-6 w-20 bg-gray-100 rounded-full" />
        </div>
      </div>

      {/* Botones de acción */}
      <div className="mb-6 flex flex-wrap gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-28 bg-gray-100 rounded-lg" />
        ))}
      </div>

      <div className="space-y-4">
        {/* Periodo */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="h-4 w-16 bg-gray-200 rounded border-b border-gray-100 pb-3 mb-3" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-12 bg-gray-100 rounded" />
                <div className="h-4 w-40 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
          <div className="h-3 w-16 bg-gray-100 rounded mt-3" />
        </div>

        {/* Cliente */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="h-4 w-16 bg-gray-200 rounded mb-3" />
          <div className="space-y-2">
            <div className="h-4 w-40 bg-gray-200 rounded" />
            <div className="h-3 w-28 bg-gray-100 rounded" />
            <div className="h-3 w-24 bg-gray-100 rounded" />
          </div>
        </div>

        {/* Vehículo */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="h-4 w-20 bg-gray-200 rounded mb-3" />
          <div className="space-y-1.5">
            <div className="h-4 w-48 bg-gray-200 rounded" />
            <div className="h-3 w-20 bg-gray-100 rounded font-mono" />
            <div className="h-3 w-16 bg-gray-100 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}
