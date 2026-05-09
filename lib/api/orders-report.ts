const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export async function downloadOrdersReportPdf() {
  const response = await fetch(`${API_URL}/orders/report/pdf`, {
    method: 'GET',
    credentials: 'include',
  })

  if (!response.ok) {
    let message = 'Failed to download report'

    try {
      const data = await response.json()
      message = data?.error || message
    } catch {}

    throw new Error(message)
  }

  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `orders-report-${new Date().toISOString().slice(0, 10)}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()

  window.URL.revokeObjectURL(url)
}