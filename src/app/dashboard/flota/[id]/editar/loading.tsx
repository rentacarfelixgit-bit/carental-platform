// src/app/dashboard/flota/[id]/editar/loading.tsx
// Mismo layout que nuevo vehículo más tarifa diaria y estado

export default function EditarVehiculoLoading() {
  return (
    <div className="p-6 max-w-2xl mx-auto animate-pulse">
      <div className="mb-6">
        <div className="h-4 w-16 bg-gray-100 rounded mb-4" />
        <div className="h-6 w-40 bg-gray-200 rounded-lg" />
      </div>

      <div className="space-y-6">
        {/* Datos del vehículo */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="h-4 w-36 bg-gray-200 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-20 bg-gray-200 rounded" />
                <div className="h-9 w-full bg-gray-100 rounded-lg" />
              </div>
            ))}
          </div>
        </div>

        {/* Tarifa y estado */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="h-4 w-32 bg-gray-200 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-24 bg-gray-200 rounded" />
                <div className="h-9 w-full bg-gray-100 rounded-lg" />
              </div>
            ))}
          </div>
        </div>

        {/* Documentos */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="h-4 w-40 bg-gray-200 rounded" />
          <div className="space-y-1.5">
            <div className="h-3 w-28 bg-gray-200 rounded" />
            <div className="h-9 w-full bg-gray-100 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-28 bg-gray-200 rounded" />
                <div className="h-9 w-full bg-gray-100 rounded-lg" />
              </div>
            ))}
          </div>
        </div>

        {/* Notas */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-1.5">
          <div className="h-3 w-28 bg-gray-200 rounded" />
          <div className="h-20 w-full bg-gray-100 rounded-lg" />
        </div>

        {/* Botones */}
        <div className="flex gap-3">
          <div className="flex-1 h-10 bg-gray-100 rounded-lg" />
          <div className="flex-1 h-10 bg-gray-200 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
