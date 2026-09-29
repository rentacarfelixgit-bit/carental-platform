// src/app/dashboard/usuarios/loading.tsx

export default function UsuariosLoading() {
  return (
    <div className="p-6 max-w-4xl mx-auto animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div className="h-6 w-24 bg-gray-200 rounded-lg" />
        <div className="h-9 w-36 bg-gray-200 rounded-lg" />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50 flex gap-4 px-4 py-3">
          <div className="h-3 w-28 bg-gray-200 rounded" />
          <div className="h-3 w-16 bg-gray-200 rounded hidden sm:block" />
          <div className="h-3 w-16 bg-gray-200 rounded ml-auto" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 last:border-0">
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-36 bg-gray-200 rounded" />
              <div className="h-3 w-44 bg-gray-100 rounded" />
            </div>
            <div className="h-5 w-16 bg-gray-100 rounded-full hidden sm:block" />
            <div className="h-5 w-16 bg-gray-100 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
