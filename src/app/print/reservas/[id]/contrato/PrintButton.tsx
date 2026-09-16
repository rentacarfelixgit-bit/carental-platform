'use client'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        background: '#3b82f6', color: '#fff', border: 'none',
        padding: '8px 16px', borderRadius: 6, cursor: 'pointer',
        fontSize: 13, fontWeight: 500,
      }}
    >
      🖨 Imprimir / Guardar PDF
    </button>
  )
}
