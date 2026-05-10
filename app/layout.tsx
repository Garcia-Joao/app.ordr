import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import AppShell from '@/components/layout/app-shell'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#dd7c12',
}

export const metadata: Metadata = {
  title: 'ORDR',
  description: 'ORDR PDV',
  icons: {
    icon: [
      {
        url: '/favicon.ico',
        sizes: 'any',
      },
      {
        url: '/ordr-icon.svg',
        type: 'image/svg+xml',
      },
    ],
    shortcut: '/favicon.ico',
    apple: '/ordr-icon.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className="dark bg-background">
      <body className="font-sans antialiased min-h-screen">
        <AppShell>{children}</AppShell>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}