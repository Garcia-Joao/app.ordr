import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ORDR - Point of Sale',
    short_name: 'ORDR',
    description: 'Sistema de pedidos, estoque e eventos para bares e operações.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#15110c',
    theme_color: '#dd7c12',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}