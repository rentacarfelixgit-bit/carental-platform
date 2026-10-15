// src/app/dashboard/configuracion/loading.tsx

export default function ConfiguracionLoading() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto animate-pulse">
      {/* Encabezado */}
      <div className="mb-5">
        <div className="h-6 w-36 bg-gray-200 rounded-lg" />
        <div className="h-3 w-72 bg-gray-100 rounded mt-2" />
      </div>

      {/* Pestañas */}
      <div className="flex gap-2 border-b border-gray-200 pb-2.5">
        {[140, 150, 260, 160].map((w, i) => (
          <div key={i} className="h-5 bg-gray-200 rounded" style={{ width: w }} />
        ))}
      </div>

      {/* Encabezado del panel */}
      <div className="flex items-start gap-3 mt-6 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gray-200" />
        <div className="space-y-2 pt-1">
          <div className="h-4 w-40 bg-gray-200 rounded" />
          <div className="h-3 w-80 bg-gray-100 rounded" />
        </div>
      </div>

      {/* Contenido */}
      <div className="space-y-4">
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
        <div className="h-10 w-32 bg-gray-200 rounded-lg" />
      </div>
    </div>
  )
}
