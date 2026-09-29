// src/app/dashboard/flota/bloqueos/loading.tsx

export default function BloqueosLoading() {
  return (
    <div className="p-6 max-w-3xl mx-auto animate-pulse">
      <div className="mb-6">
        <div className="h-4 w-16 bg-gray-100 rounded mb-4" />
        <div className="h-6 w-40 bg-gray-200 rounded-lg" />
      </div>

      {/* Formulario nuevo bloqueo */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-4">
        <div className="h-4 w-32 bg-gray-200 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-20 bg-gray-200 rounded" />
              <div className="h-9 w-full bg-gray-100 rounded-lg" />
            </div>
          ))}
        </div>
        <div className="h-9 w-32 bg-gray-200 rounded-lg" />
      </div>

      {/* Lista de bloqueos */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 last:border-0">
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-36 bg-gray-200 rounded" />
              <div className="h-3 w-48 bg-gray-100 rounded" />
            </div>
            <div className="h-7 w-16 bg-gray-100 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}
