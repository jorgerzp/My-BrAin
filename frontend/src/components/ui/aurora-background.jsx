import { cn } from '@/lib/utils'

/**
 * Fondo animado tipo aurora. El contenido de la app (sidebar, main, tarjetas)
 * se renderiza encima en el wrapper z-10.
 */
export function AuroraBackground({
  className,
  children,
  showRadialGradient = true,
  ...props
}) {
  return (
    <div
      className={cn(
        'relative flex min-h-screen w-full flex-col items-stretch justify-start bg-transparent text-slate-950 transition-[background]',
        className
      )}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className={cn(
            `[--white-gradient:repeating-linear-gradient(100deg,var(--white)_0%,var(--white)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--white)_16%)]
            [--dark-gradient:repeating-linear-gradient(100deg,var(--black)_0%,var(--black)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--black)_16%)]
            [--aurora:repeating-linear-gradient(100deg,var(--blue-500)_10%,var(--indigo-300)_15%,var(--blue-300)_20%,var(--violet-200)_25%,var(--blue-400)_30%)]
            [background-image:var(--white-gradient),var(--aurora)]
            dark:[background-image:var(--dark-gradient),var(--aurora)]
            [background-size:300%,_200%]
            [background-position:50%_50%,50%_50%]
            absolute -inset-[10px] opacity-50 blur-[10px] invert filter dark:invert-0
            will-change-transform
            after:pointer-events-none
            after:absolute after:inset-0
            after:animate-aurora
            after:mix-blend-difference
            after:content-['']
            after:[background-attachment:fixed]
            after:[background-image:var(--white-gradient),var(--aurora)]
            after:dark:[background-image:var(--dark-gradient),var(--aurora)]
            after:[background-size:200%,_100%]`,
            showRadialGradient &&
              '[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,var(--transparent)_70%)]'
          )}
        />
      </div>
      <div className="relative z-10 flex min-h-screen w-full flex-1 flex-col">{children}</div>
    </div>
  )
}
