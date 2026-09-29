// src/app/dashboard/configuracion/loading.tsx

export default function ConfiguracionLoading() {
  return (
    <div className="p-6 max-w-3xl mx-auto animate-pulse">
      {/* Encabezado */}
      <div className="mb-6">
        <div className="h-6 w-36 bg-gray-200 rounded-lg" />
        <div className="h-3 w-56 bg-gray-100 rounded mt-2" />
      </div>

      {/* Sección datos del negocio */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 space-y-4">
        <div className="h-4 w-40 bg-gray-200 rounded border-b border-gray-100 pb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-24 bg-gray-200 rounded" />
              <div className="h-9 w-full bg-gray-100 rounded-lg" />
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-20 bg-gray-200 rounded" />
          <div className="h-9 w-full bg-gray-100 rounded-lg" />
        </div>
      </div>

      {/* Sección fiscal */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 space-y-4">
        <div className="h-4 w-32 bg-gray-200 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-20 bg-gray-200 rounded" />
              <div className="h-9 w-full bg-gray-100 rounded-lg" />
            </div>
          ))}
        </div>
      </div>

      {/* Botón guardar */}
      <div className="h-10 w-32 bg-gray-200 rounded-lg ml-auto" />
    </div>
  )
}
