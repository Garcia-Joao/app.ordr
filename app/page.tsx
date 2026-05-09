'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { me } from '@/lib/api/auth'
import { getFirstAllowedPath } from '@/lib/auth-routing'

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('REQUEST_TIMEOUT'))
    }, timeoutMs)

    promise
      .then((value) => {
        window.clearTimeout(timeout)
        resolve(value)
      })
      .catch((error) => {
        window.clearTimeout(timeout)
        reject(error)
      })
  })
}

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    let isMounted = true

    async function resolveHomeRedirect() {
      try {
        const result = await withTimeout(me(), 1800)

        if (!isMounted) return

        localStorage.setItem('ordr-user', JSON.stringify(result.user))
        window.dispatchEvent(new Event('ordr-user-updated'))

        router.replace(getFirstAllowedPath(result.user))
      } catch {
        if (!isMounted) return

        localStorage.removeItem('ordr-user')
        window.dispatchEvent(new Event('ordr-user-updated'))

        router.replace('/login/')
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