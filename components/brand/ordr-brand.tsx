'use client'

import type { CSSProperties } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

export const ORDR_BRAND_ORANGE = '#dd7c12'

type OrdrIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

type OrdrIconProps = {
  size?: OrdrIconSize
  rotateOnHover?: boolean
  spin?: boolean
  className?: string
  ariaLabel?: string
}

const iconSizeClasses: Record<OrdrIconSize, { wrapper: string; svg: string }> = {
  xs: { wrapper: 'h-8 w-8 rounded-lg', svg: 'h-5 w-5' },
  sm: { wrapper: 'h-10 w-10 rounded-xl', svg: 'h-7 w-7' },
  md: { wrapper: 'h-12 w-12 rounded-2xl', svg: 'h-9 w-9' },
  lg: { wrapper: 'h-20 w-20 rounded-[1.5rem]', svg: 'h-14 w-14' },
  xl: { wrapper: 'h-24 w-24 rounded-[1.75rem]', svg: 'h-16 w-16' },
}

export function OrdrIcon({
  size = 'md',
  rotateOnHover = false,
  spin = false,
  className = '',
  ariaLabel,
}: OrdrIconProps) {
  const rotate = useMotionValue(0)
  const smoothRotate = useSpring(rotate, {
    stiffness: 180,
    damping: 16,
  })

  const sizeClass = iconSizeClasses[size]

  return (
    <motion.div
      onHoverStart={() => {
        if (rotateOnHover && !spin) rotate.set(360)
      }}
      onHoverEnd={() => {
        if (rotateOnHover && !spin) rotate.set(0)
      }}
      whileHover={rotateOnHover && !spin ? { scale: 1.04 } : undefined}
      transition={{ type: 'spring', stiffness: 260, damping: 16 }}
      className={`relative flex shrink-0 items-center justify-center overflow-hidden shadow-sm ${sizeClass.wrapper} ${className}`}
      style={{
        backgroundColor: ORDR_BRAND_ORANGE,
        boxShadow: `0 10px 30px ${ORDR_BRAND_ORANGE}33`,
      }}
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
    >
      <svg
        viewBox="0 0 188.6 187.58"
        className={sizeClass.svg}
        aria-hidden={ariaLabel ? undefined : true}
      >
        <motion.g
          animate={spin ? { rotate: 360 } : undefined}
          transition={
            spin
              ? {
                  duration: 1.05,
                  repeat: Infinity,
                  ease: 'linear',
                }
              : undefined
          }
          style={
            {
              rotate: spin ? undefined : smoothRotate,
              transformOrigin: '94.3px 93.79px',
            } as CSSProperties
          }
        >
          <path
            fill="#ffffff"
            d="M45.77,109.15c1.02-.59,1.56-1.78,1.3-2.93-.88-3.9-1.33-8.05-1.33-12.43,0-14.22,4.62-25.91,13.88-35.07,9.25-9.16,20.81-13.75,34.69-13.75s25.44,4.58,34.69,13.75c0,0,.01.01.02.02.88.88,2.23,1.07,3.31.45l35.15-20.3c1.46-.84,1.82-2.79.75-4.1-2.16-2.64-4.48-5.2-6.98-7.68C142.99,9.04,120.68,0,94.3,0S45.61,9.04,27.37,27.11C9.12,45.18,0,67.41,0,93.79c0,12.46,2.05,23.99,6.13,34.59.6,1.57,2.47,2.23,3.92,1.39l35.72-20.62Z"
          />
          <path
            fill="#ffffff"
            d="M142.84,78.43c-1.02.59-1.56,1.78-1.3,2.93.88,3.9,1.33,8.05,1.33,12.43,0,14.22-4.62,25.91-13.88,35.07-9.25,9.17-20.81,13.75-34.69,13.75s-25.44-4.58-34.69-13.75c0,0-.01-.01-.02-.02-.88-.88-2.23-1.07-3.31-.45l-35.15,20.3c-1.46.84-1.82,2.79-.75,4.1,2.16,2.64,4.48,5.2,6.99,7.68,18.24,18.07,40.55,27.11,66.94,27.11s48.69-9.03,66.94-27.11c18.24-18.07,27.37-40.3,27.37-66.68,0-12.46-2.05-23.99-6.13-34.59-.6-1.57-2.47-2.23-3.92-1.39l-35.72,20.62Z"
          />
        </motion.g>
      </svg>
    </motion.div>
  )
}

export function OrdrFullLogo({
  className = 'h-14 w-auto',
  textClassName = 'text-current',
}: {
  className?: string
  textClassName?: string
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 541.4 187.58"
      className={`${className} ${textClassName}`}
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
          fill={ORDR_BRAND_ORANGE}
          d="M45.77,109.15c1.02-.59,1.56-1.78,1.3-2.93-.88-3.9-1.33-8.05-1.33-12.43,0-14.22,4.62-25.91,13.88-35.07,9.25-9.16,20.81-13.75,34.69-13.75s25.44,4.58,34.69,13.75c0,0,.01.01.02.02.88.88,2.23,1.07,3.31.45l35.15-20.3c1.46-.84,1.82-2.79.75-4.1-2.16-2.64-4.48-5.2-6.98-7.68C142.99,9.04,120.68,0,94.3,0S45.61,9.04,27.37,27.11C9.12,45.18,0,67.41,0,93.79c0,12.46,2.05,23.99,6.13,34.59.6,1.57,2.47,2.23,3.92,1.39l35.72-20.62Z"
        />
        <path
          fill={ORDR_BRAND_ORANGE}
          d="M142.84,78.43c-1.02.59-1.56,1.78-1.3,2.93.88,3.9,1.33,8.05,1.33,12.43,0,14.22-4.62,25.91-13.88,35.07-9.25,9.17-20.81,13.75-34.69,13.75s-25.44-4.58-34.69-13.75c0,0-.01-.01-.02-.02-.88-.88-2.23-1.07-3.31-.45l-35.15,20.3c-1.46.84-1.82,2.79-.75,4.1,2.16,2.64,4.48,5.2,6.99,7.68,18.24,18.07,40.55,27.11,66.94,27.11s48.69-9.03,66.94-27.11c18.24-18.07,27.37-40.3,27.37-66.68,0-12.46-2.05-23.99-6.13-34.59-.6-1.57-2.47-2.23-3.92-1.39l-35.72,20.62Z"
        />
      </g>
    </svg>
  )
}

export function OrdrBackgroundMark({ className = '' }: { className?: string }) {
  return (
    <motion.svg
      viewBox="0 0 188.6 187.58"
      className={className}
      aria-hidden="true"
      animate={{
        x: [0, 16, 0, -10, 0],
        y: [0, -18, 0, 10, 0],
        rotate: [0, 5, 0, -4, 0],
        scale: [1, 1.03, 1, 0.985, 1],
      }}
      transition={{
        duration: 14,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <g opacity="0.07">
        <path
          fill={ORDR_BRAND_ORANGE}
          d="M45.77,109.15c1.02-.59,1.56-1.78,1.3-2.93-.88-3.9-1.33-8.05-1.33-12.43,0-14.22,4.62-25.91,13.88-35.07,9.25-9.16,20.81-13.75,34.69-13.75s25.44,4.58,34.69,13.75c0,0,.01.01.02.02.88.88,2.23,1.07,3.31.45l35.15-20.3c1.46-.84,1.82-2.79.75-4.1-2.16-2.64-4.48-5.2-6.98-7.68C142.99,9.04,120.68,0,94.3,0S45.61,9.04,27.37,27.11C9.12,45.18,0,67.41,0,93.79c0,12.46,2.05,23.99,6.13,34.59.6,1.57,2.47,2.23,3.92,1.39l35.72-20.62Z"
        />
        <path
          fill={ORDR_BRAND_ORANGE}
          d="M142.84,78.43c-1.02.59-1.56,1.78-1.3,2.93.88,3.9,1.33,8.05,1.33,12.43,0,14.22-4.62,25.91-13.88,35.07-9.25,9.17-20.81,13.75-34.69,13.75s-25.44-4.58-34.69-13.75c0,0-.01-.01-.02-.02-.88-.88-2.23-1.07-3.31-.45l-35.15,20.3c-1.46.84-1.82,2.79-.75,4.1,2.16,2.64,4.48,5.2,6.99,7.68,18.24,18.07,40.55,27.11,66.94,27.11s48.69-9.03,66.94-27.11c18.24-18.07,27.37-40.3,27.37-66.68,0-12.46-2.05-23.99-6.13-34.59-.6-1.57-2.47-2.23-3.92-1.39l-35.72,20.62Z"
        />
      </g>
    </motion.svg>
  )
}
