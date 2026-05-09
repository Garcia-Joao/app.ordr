'use client'

import type { CSSProperties, FormEvent, ReactNode } from 'react'
import { useMemo, useState } from 'react'
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion'
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  User,
  Zap,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

import { login } from '@/lib/api'

const BRAND_ORANGE = '#dd7c12'

export default function LoginPage() {
  const router = useRouter()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [2.5, -2.5]), {
    stiffness: 120,
    damping: 20,
  })
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-2.5, 2.5]), {
    stiffness: 120,
    damping: 20,
  })

  const glowX = useTransform(mouseX, [-0.5, 0.5], ['20%', '80%'])
  const glowY = useTransform(mouseY, [-0.5, 0.5], ['20%', '80%'])
  const cardGlow = useMotionTemplate`radial-gradient(circle at ${glowX} ${glowY}, rgba(221,124,18,0.18), transparent 34%)`

  const canSubmit = useMemo(() => {
    return username.trim().length > 0 && password.trim().length > 0 && !loading
  }, [username, password, loading])

  async function handleLogin() {
    if (!canSubmit) return

    try {
      setLoading(true)
      setError('')

      const result = await login(username.trim(), password)

      localStorage.setItem('ordr-user', JSON.stringify(result.user))
      router.push('/PDV')
    } catch (err) {
      localStorage.removeItem('ordr-user')

      const message =
        err instanceof Error
          ? err.message
          : 'Não foi possível conectar ao servidor.'

      setError(message)
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    handleLogin()
  }

  function handleCardMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5

    mouseX.set(x)
    mouseY.set(y)
  }

  function handleCardMouseLeave() {
    mouseX.set(0)
    mouseY.set(0)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -left-24 top-10 h-72 w-72 rounded-full blur-3xl"
          style={{ backgroundColor: `${BRAND_ORANGE}33` }}
          animate={{
            x: [0, 32, 0],
            y: [0, 24, 0],
            scale: [1, 1.12, 1],
          }}
          transition={{
            duration: 9,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        <motion.div
          className="absolute bottom-0 right-0 h-96 w-96 rounded-full blur-3xl"
          style={{ backgroundColor: `${BRAND_ORANGE}1a` }}
          animate={{
            x: [0, -28, 0],
            y: [0, -24, 0],
            scale: [1, 1.16, 1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        <FloatingParticles />
        <BackgroundBrandMark />

        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at top left, rgba(221,124,18,0.13), transparent 34%), radial-gradient(circle at bottom right, rgba(221,124,18,0.10), transparent 34%)',
          }}
        />

        <motion.div
          className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.35)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.35)_1px,transparent_1px)] bg-[size:54px_54px] opacity-25"
          animate={{
            backgroundPosition: ['0px 0px', '54px 54px'],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </div>

      <div className="relative z-10 grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden min-h-screen flex-col justify-between px-10 py-8 lg:flex xl:px-16">
          <motion.div
            initial={{ opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <FullBrandLogo />
          </motion.div>

          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.08 }}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-2 text-sm text-muted-foreground shadow-sm backdrop-blur-xl"
            >
              <motion.span
                animate={{
                  rotate: [0, 8, -8, 0],
                  scale: [1, 1.12, 1],
                }}
                transition={{
                  duration: 2.6,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <Sparkles className="h-4 w-4" style={{ color: BRAND_ORANGE }} />
              </motion.span>
              Operação mais rápida, organizada e segura
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.16 }}
              className="mt-8 text-6xl font-black leading-none tracking-tight text-foreground xl:text-8xl"
            >
              Venda,
              <br />
              gerencie,
              <br />
              acompanhe.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.24 }}
              className="mt-7 max-w-xl text-xl font-medium leading-8 text-muted-foreground xl:text-2xl xl:leading-9"
            >
              Uma central simples para pedidos, estoque, clientes, eventos e relatórios
              do seu negócio.
            </motion.p>

            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: {
                  transition: {
                    staggerChildren: 0.12,
                    delayChildren: 0.35,
                  },
                },
              }}
              className="mt-10 grid max-w-xl gap-3"
            >
              <FeatureItem
                icon={<PackageCheck className="h-5 w-5" />}
                title="Tudo em um só fluxo"
                description="Do pedido ao relatório, sem precisar trocar de sistema."
              />

              <FeatureItem
                icon={<ShieldCheck className="h-5 w-5" />}
                title="Acessos por permissão"
                description="Cada usuário vê apenas o que precisa para trabalhar."
              />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.44 }}
            className="flex items-center gap-3 text-sm text-muted-foreground"
          >
            <motion.span
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ShieldCheck className="h-5 w-5" style={{ color: BRAND_ORANGE }} />
            </motion.span>
            Seguro. Confiável. Feito para quem move a operação.
          </motion.div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8 lg:px-10">
          <motion.div
            initial={{ opacity: 0, y: 26, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
            className="relative w-full max-w-[500px] [perspective:1000px]"
          >
            <motion.div
              className="absolute -inset-1 rounded-[2rem] blur-2xl"
              style={{ backgroundColor: `${BRAND_ORANGE}33` }}
              animate={{
                opacity: [0.35, 0.65, 0.35],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />

            <motion.div
              onMouseMove={handleCardMouseMove}
              onMouseLeave={handleCardMouseLeave}
              style={{
                rotateX,
                rotateY,
                transformStyle: 'preserve-3d',
              }}
              className="relative overflow-hidden rounded-[2rem] border border-border bg-card/85 p-6 shadow-2xl backdrop-blur-2xl sm:p-8"
            >
              <motion.div className="absolute inset-0" style={{ background: cardGlow }} />

              <div
                className="absolute right-0 top-0 h-40 w-40 rounded-full blur-3xl"
                style={{ backgroundColor: `${BRAND_ORANGE}1a` }}
              />
              <div
                className="absolute bottom-0 left-0 h-40 w-40 rounded-full blur-3xl"
                style={{ backgroundColor: `${BRAND_ORANGE}0d` }}
              />

              <div className="relative" style={{ transform: 'translateZ(38px)' }}>
                <div className="mx-auto flex justify-center">
                  <BrandIcon size="lg" />
                </div>

                <div className="mt-6 text-center">
                  <motion.h2
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.15 }}
                    className="text-3xl font-black tracking-tight text-foreground"
                  >
                    Bem-vindo de volta
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.22 }}
                    className="mt-2 text-sm leading-6 text-muted-foreground"
                  >
                    Entre para continuar gerenciando sua operação.
                  </motion.p>
                </div>

                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  <AnimatedField delay={0.28}>
                    <label className="text-sm font-medium text-foreground">
                      Usuário
                    </label>

                    <div className="group relative">
                      <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground" />

                      <input
                        type="text"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        autoComplete="username"
                        className="h-14 w-full rounded-2xl border border-border bg-background/70 pl-12 pr-4 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:ring-4"
                        style={{ '--tw-ring-color': 'rgba(221,124,18,0.15)' } as CSSProperties}
                        placeholder="Digite seu usuário"
                      />

                      <motion.div
                        className="pointer-events-none absolute inset-0 rounded-2xl border opacity-0 group-focus-within:opacity-100"
                        style={{ borderColor: BRAND_ORANGE }}
                        layout
                      />
                    </div>
                  </AnimatedField>

                  <AnimatedField delay={0.34}>
                    <label className="text-sm font-medium text-foreground">
                      Senha
                    </label>

                    <div className="group relative">
                      <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground" />

                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="current-password"
                        className="h-14 w-full rounded-2xl border border-border bg-background/70 pl-12 pr-12 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:ring-4"
                        style={{ '--tw-ring-color': 'rgba(221,124,18,0.15)' } as CSSProperties}
                        placeholder="Digite sua senha"
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>

                      <motion.div
                        className="pointer-events-none absolute inset-0 rounded-2xl border opacity-0 group-focus-within:opacity-100"
                        style={{ borderColor: BRAND_ORANGE }}
                        layout
                      />
                    </div>
                  </AnimatedField>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                    >
                      {error}
                    </motion.div>
                  )}

                  <motion.button
                    type="submit"
                    disabled={!canSubmit}
                    whileHover={canSubmit ? { scale: 1.015, y: -1 } : undefined}
                    whileTap={canSubmit ? { scale: 0.985 } : undefined}
                    className="group relative flex h-14 w-full items-center justify-center overflow-hidden rounded-2xl font-bold text-white shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      backgroundColor: BRAND_ORANGE,
                      boxShadow: `0 10px 30px ${BRAND_ORANGE}33`,
                    }}
                  >
                    <motion.span
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                      initial={{ x: '-120%' }}
                      animate={{ x: ['-120%', '120%'] }}
                      transition={{
                        duration: loading ? 1.2 : 3,
                        repeat: Infinity,
                        repeatDelay: loading ? 0 : 1.4,
                        ease: 'easeInOut',
                      }}
                    />

                    <span className="relative flex items-center gap-2">
                      {loading ? 'Entrando...' : 'Entrar'}
                      {!loading && (
                        <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                      )}
                    </span>
                  </motion.button>
                </form>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="mt-7 flex items-center justify-center gap-2 text-xs text-muted-foreground"
                >
                  <Zap className="h-3.5 w-3.5" style={{ color: BRAND_ORANGE }} />
                  Login rápido para operação em tempo real.
                </motion.div>
              </div>
            </motion.div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              © {new Date().getFullYear()} ordr. Sistema de gerenciamento de pedidos.
            </p>
          </motion.div>
        </section>
      </div>
    </main>
  )
}

function FloatingParticles() {
  const particles = [
    { left: '11%', top: '22%', size: 5, duration: 15, delay: 0 },
    { left: '18%', top: '72%', size: 4, duration: 18, delay: 1.2 },
    { left: '37%', top: '18%', size: 3, duration: 16, delay: 0.6 },
    { left: '48%', top: '78%', size: 6, duration: 20, delay: 1.8 },
    { left: '71%', top: '14%', size: 4, duration: 17, delay: 0.9 },
    { left: '82%', top: '66%', size: 5, duration: 19, delay: 0.3 },
    { left: '92%', top: '38%', size: 3, duration: 16, delay: 1.5 },
  ]

  return (
    <>
      {particles.map((particle, index) => (
        <motion.span
          key={index}
          className="absolute rounded-full"
          style={{
            left: particle.left,
            top: particle.top,
            width: particle.size,
            height: particle.size,
            backgroundColor: BRAND_ORANGE,
            opacity: 0.22,
            boxShadow: `0 0 20px ${BRAND_ORANGE}`,
          }}
          animate={{
            y: [0, -28, 0],
            x: [0, 12, 0],
            opacity: [0.08, 0.28, 0.08],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </>
  )
}

function BackgroundBrandMark() {
  return (
    <>
      <motion.div
        className="absolute left-[44%] top-[48%] hidden -translate-x-1/2 -translate-y-1/2 lg:block"
        animate={{
          x: [0, 16, 0, -10, 0],
          y: [0, -18, 0, 10, 0],
          rotate: [0, 8, 0, -7, 0],
          scale: [1, 1.04, 1, 0.985, 1],
        }}
        transition={{
          duration: 14,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <BrandShape className="h-[430px] w-[430px]" opacity={0.07} />
      </motion.div>

      <motion.div
        className="absolute left-[50%] top-[52%] hidden -translate-x-1/2 -translate-y-1/2 blur-3xl lg:block"
        animate={{
          x: [0, -10, 0, 12, 0],
          y: [0, 10, 0, -12, 0],
          scale: [1, 1.04, 1],
        }}
        transition={{
          duration: 11,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <BrandShape className="h-[280px] w-[280px]" opacity={0.12} />
      </motion.div>
    </>
  )
}

function FullBrandLogo() {
  return (
    <div className="inline-flex items-center" aria-label="ordr">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 541.4 187.58"
        className="h-16 w-auto text-white xl:h-20"
        role="img"
        aria-label="ordr"
      >
        <g>
          <path
            fill="currentColor"
            d="M250.79,79.14c2.4-8.39,7.19-14.9,14.39-19.53,7.2-4.63,15.24-6.94,24.15-6.94v47.28c-9.77-1.54-18.63.26-26.6,5.4-7.96,5.14-11.95,13.53-11.95,25.18v53.19h-42.65V55.25h42.65v23.9Z"
          />
          <path
            fill="currentColor"
            d="M392.88,3.85h42.65v179.87h-42.65v-11.82c-8.74,10.28-20.9,15.42-36.49,15.42-17.13,0-31.48-6.46-43.04-19.4-11.56-12.93-17.34-29.08-17.34-48.44s5.78-35.5,17.34-48.44c11.56-12.93,25.91-19.4,43.04-19.4,15.59,0,27.75,5.14,36.49,15.42V3.85ZM346.37,139.78c4.97,5.14,11.47,7.71,19.53,7.71s14.56-2.57,19.53-7.71c4.97-5.14,7.45-11.9,7.45-20.3s-2.49-15.16-7.45-20.3c-4.97-5.14-11.48-7.71-19.53-7.71s-14.56,2.57-19.53,7.71c-4.97,5.14-7.45,11.91-7.45,20.3s2.48,15.16,7.45,20.3Z"
          />
          <path
            fill="currentColor"
            d="M502.86,79.14c2.4-8.39,7.19-14.9,14.39-19.53,7.2-4.63,15.25-6.94,24.15-6.94v47.28c-9.76-1.54-18.63.26-26.59,5.4-7.97,5.14-11.95,13.53-11.95,25.18v53.19h-42.65V55.25h42.65v23.9Z"
          />
          <path
            fill={BRAND_ORANGE}
            d="M45.77,109.15c1.02-.59,1.56-1.78,1.3-2.93-.88-3.9-1.33-8.05-1.33-12.43,0-14.22,4.62-25.91,13.88-35.07,9.25-9.16,20.81-13.75,34.69-13.75s25.44,4.58,34.69,13.75c0,0,.01.01.02.02.88.88,2.23,1.07,3.31.45l35.15-20.3c1.46-.84,1.82-2.79.75-4.1-2.16-2.64-4.48-5.2-6.98-7.68C142.99,9.04,120.68,0,94.3,0S45.61,9.04,27.37,27.11C9.12,45.18,0,67.41,0,93.79c0,12.46,2.05,23.99,6.13,34.59.6,1.57,2.47,2.23,3.92,1.39l35.72-20.62Z"
          />
          <path
            fill={BRAND_ORANGE}
            d="M142.84,78.43c-1.02.59-1.56,1.78-1.3,2.93.88,3.9,1.33,8.05,1.33,12.43,0,14.22-4.62,25.91-13.88,35.07-9.25,9.17-20.81,13.75-34.69,13.75s-25.44-4.58-34.69-13.75c0,0-.01-.01-.02-.02-.88-.88-2.23-1.07-3.31-.45l-35.15,20.3c-1.46.84-1.82,2.79-.75,4.1,2.16,2.64,4.48,5.2,6.99,7.68,18.24,18.07,40.55,27.11,66.94,27.11s48.69-9.03,66.94-27.11c18.24-18.07,27.37-40.3,27.37-66.68,0-12.46-2.05-23.99-6.13-34.59-.6-1.57-2.47-2.23-3.92-1.39l-35.72,20.62Z"
          />
        </g>
      </svg>
    </div>
  )
}

function BrandIcon({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const rotate = useMotionValue(0)
  const smoothRotate = useSpring(rotate, {
    stiffness: 180,
    damping: 16,
  })

  const wrapperClass =
    size === 'lg'
      ? 'h-24 w-24 rounded-[1.75rem]'
      : size === 'sm'
        ? 'h-10 w-10 rounded-xl'
        : 'h-14 w-14 rounded-2xl'

  const svgClass =
    size === 'lg'
      ? 'h-16 w-16'
      : size === 'sm'
        ? 'h-7 w-7'
        : 'h-10 w-10'

  return (
    <motion.div
      onHoverStart={() => rotate.set(360)}
      onHoverEnd={() => rotate.set(0)}
      whileHover={{ scale: 1.04 }}
      transition={{ type: 'spring', stiffness: 260, damping: 16 }}
      className={`relative flex shrink-0 items-center justify-center shadow-lg ${wrapperClass}`}
      style={{
        backgroundColor: BRAND_ORANGE,
        boxShadow: `0 10px 30px ${BRAND_ORANGE}33`,
      }}
    >
      <svg
        viewBox="0 0 188.6 187.58"
        className={svgClass}
        aria-hidden="true"
      >
        <motion.g
          style={{
            rotate: smoothRotate,
            originX: '94.3px',
            originY: '93.79px',
          }}
        >
          <BrandShapePaths fill="#ffffff" />
        </motion.g>
      </svg>
    </motion.div>
  )
}

function BrandShape({
  className,
  opacity,
}: {
  className?: string
  opacity?: number
}) {
  return (
    <svg viewBox="0 0 188.6 187.58" className={className} aria-hidden="true">
      <g opacity={opacity ?? 1}>
        <BrandShapePaths fill={BRAND_ORANGE} />
      </g>
    </svg>
  )
}

function BrandShapePaths({ fill }: { fill: string }) {
  return (
    <>
      <path
        fill={fill}
        d="M45.77,109.15c1.02-.59,1.56-1.78,1.3-2.93-.88-3.9-1.33-8.05-1.33-12.43,0-14.22,4.62-25.91,13.88-35.07,9.25-9.16,20.81-13.75,34.69-13.75s25.44,4.58,34.69,13.75c0,0,.01.01.02.02.88.88,2.23,1.07,3.31.45l35.15-20.3c1.46-.84,1.82-2.79.75-4.1-2.16-2.64-4.48-5.2-6.98-7.68C142.99,9.04,120.68,0,94.3,0S45.61,9.04,27.37,27.11C9.12,45.18,0,67.41,0,93.79c0,12.46,2.05,23.99,6.13,34.59.6,1.57,2.47,2.23,3.92,1.39l35.72-20.62Z"
      />
      <path
        fill={fill}
        d="M142.84,78.43c-1.02.59-1.56,1.78-1.3,2.93.88,3.9,1.33,8.05,1.33,12.43,0,14.22-4.62,25.91-13.88,35.07-9.25,9.17-20.81,13.75-34.69,13.75s-25.44-4.58-34.69-13.75c0,0-.01-.01-.02-.02-.88-.88-2.23-1.07-3.31-.45l-35.15,20.3c-1.46.84-1.82,2.79-.75,4.1,2.16,2.64,4.48,5.2,6.99,7.68,18.24,18.07,40.55,27.11,66.94,27.11s48.69-9.03,66.94-27.11c18.24-18.07,27.37-40.3,27.37-66.68,0-12.46-2.05-23.99-6.13-34.59-.6-1.57-2.47-2.23-3.92-1.39l-35.72,20.62Z"
      />
    </>
  )
}

function AnimatedField({
  children,
  delay,
}: {
  children: ReactNode
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
      className="space-y-2"
    >
      {children}
    </motion.div>
  )
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 18, scale: 0.98 },
        visible: { opacity: 1, y: 0, scale: 1 },
      }}
      whileHover={{
        y: -4,
        scale: 1.01,
      }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 18,
      }}
      className="flex items-start gap-4 rounded-3xl border border-border bg-card/70 p-5 shadow-sm backdrop-blur-xl"
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-background"
        style={{ color: BRAND_ORANGE }}
      >
        {icon}
      </div>

      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </motion.div>
  )
}