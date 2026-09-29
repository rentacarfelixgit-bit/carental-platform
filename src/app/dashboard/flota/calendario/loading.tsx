// src/app/dashboard/flota/calendario/loading.tsx

export default function CalendarioLoading() {
  const VEHICLES = 6
  const DAYS = 14

  return (
    <div className="p-6 max-w-7xl mx-auto animate-pulse">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <div className="h-6 w-48 bg-gray-200 rounded-lg" />
          <div className="h-3 w-32 bg-gray-100 rounded mt-2" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-gray-100 rounded-lg" />
          <div className="h-9 w-14 bg-gray-100 rounded-lg" />
          <div className="h-9 w-24 bg-gray-100 rounded-lg" />
        </div>
      </div>

      {/* Gantt grid */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table
            className="border-collapse"
            style={{ minWidth: `${192 + DAYS * 48}px`, width: '100%' }}
          >
            {/* Header de fechas */}
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="w-48 px-3 py-2 border-r border-gray-200">
                  <div className="h-3 w-16 bg-gray-200 rounded" />
                </th>
                {Array.from({ length: DAYS }).map((_, i) => (
                  <th key={i} className="w-12 px-0 py-2 border-r border-gray-200">
                    <div className="h-4 w-5 bg-gray-200 rounded mx-auto mb-1" />
                    <div className="h-2.5 w-6 bg-gray-100 rounded mx-auto" />
                  </th>
                ))}
              </tr>
            </thead>
            {/* Filas de vehículos */}
            <tbody>
              {Array.from({ length: VEHICLES }).map((_, vi) => (
                <tr key={vi} className="h-10 border-b border-gray-100">
                  <td className="px-3 py-1 border-r border-gray-200 w-48">
                    <div className="h-3 w-28 bg-gray-200 rounded mb-1" />
                    <div className="h-2.5 w-16 bg-gray-100 rounded" />
                  </td>
                  {Array.from({ length: DAYS }).map((_, di) => (
                    <td key={di} className="border border-gray-100 w-12">
                      {/* Occasionally render a "fake event" block for visual variety */}
                      {vi === 1 && di >= 2 && di <= 5 && di === 2 ? (
                        <div className="h-full w-full bg-gray-200 rounded" style={{ minHeight: 36 }} />
                      ) : vi === 3 && di >= 7 && di <= 10 && di === 7 ? (
                        <div className="h-full w-full bg-gray-200 rounded" style={{ minHeight: 36 }} />
                      ) : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 mt-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-gray-200" />
            <div className="h-3 w-20 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
