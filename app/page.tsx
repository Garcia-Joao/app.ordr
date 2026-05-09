'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { me } from '@/lib/api/auth'
import { getFirstAllowedPath } from '@/lib/auth-routing'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    let isMounted = true

    async function resolveHomeRedirect() {
      try {
        const result = await me()

        if (!isMounted) return

        localStorage.setItem('ordr-user', JSON.stringify(result.user))
        window.dispatchEvent(new Event('ordr-user-updated'))

        router.replace(getFirstAllowedPath(result.user))
      } catch {
        if (!isMounted) return

        localStorage.removeItem('ordr-user')
        window.dispatchEvent(new Event('ordr-user-updated'))

        router.replace('/login')
      }
    }

    resolveHomeRedirect()

    return () => {
      isMounted = false
    }
  }, [router])

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-sm text-muted-foreground">
      Verificando acesso...
    </main>
  )
}