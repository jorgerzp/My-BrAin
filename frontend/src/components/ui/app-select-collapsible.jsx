import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Collapsible } from '@ark-ui/react/collapsible'
import { cn } from '@/lib/utils'
import { AppCollapsibleChevron } from '@/components/ui/app-collapsible'

function normalizeOptions(options) {
  if (!options?.length) return []
  if (typeof options[0] === 'string') return options.map((s) => ({ value: s, label: s }))
  return options
}

/**
 * Desplegable tipo select (Ark Collapsible): trigger + lista en portal (no se recorta).
 */
export function AppSelectCollapsible({
  value,
  onChange,
  options = [],
  placeholder = 'Seleccionar',
  disabled = false,
  className,
  triggerClassName,
  menuClassName,
  ariaLabel,
  id,
}) {
  const [open, setOpen] = useState(false)
  const [menuRect, setMenuRect] = useState(null)
  const triggerWrapRef = useRef(null)
  const menuRef = useRef(null)

  const opts = normalizeOptions(options)
  const selected = opts.find((o) => o.value === value)
  const label = selected?.label ?? placeholder
  const isPlaceholder = !selected

  const updateMenuPosition = useCallback(() => {
    const el = triggerWrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setMenuRect({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setMenuRect(null)
      return
    }
    updateMenuPosition()
    const onScrollOrResize = () => updateMenuPosition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, updateMenuPosition, opts.length])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      const t = e.target
      if (triggerWrapRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const menu =
    open &&
    menuRect &&
    createPortal(
      <ul
        ref={menuRef}
        className={cn('fin-select-menu fin-select-menu--portal', menuClassName)}
        role="listbox"
        aria-label={ariaLabel}
        style={{
          position: 'fixed',
          top: menuRect.top,
          left: menuRect.left,
          width: menuRect.width,
          zIndex: 9999,
        }}
      >
        {opts.map((opt) => (
          <li key={opt.value} role="none">
            <button
              type="button"
              role="option"
              aria-selected={value === opt.value}
              className={cn(
                'fin-select-option w-full px-3.5 py-2.5 text-left text-sm transition-colors',
                value === opt.value && 'fin-select-option--active'
              )}
              onClick={() => {
                onChange?.(opt.value)
                setOpen(false)
              }}
            >
              {opt.label}
            </button>
          </li>
        ))}
      </ul>,
      document.body
    )

  return (
    <>
      <Collapsible.Root
        id={id}
        open={open}
        onOpenChange={(d) => setOpen(d.open)}
        disabled={disabled}
        className={cn('fin-select-collapsible w-full', className)}
      >
        <div ref={triggerWrapRef} className="w-full">
          <Collapsible.Trigger
            type="button"
            aria-label={ariaLabel}
            aria-haspopup="listbox"
            aria-expanded={open}
            className={cn(
              'fin-select-trigger box-border inline-flex w-full min-h-[42px] items-center justify-between gap-2 text-left text-sm font-medium transition-all duration-200',
              'border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text)]',
              'hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60',
              isPlaceholder && 'text-[var(--color-text-muted)]',
              triggerClassName
            )}
          >
            <span className="min-w-0 flex-1 leading-snug">{label}</span>
            <AppCollapsibleChevron className="shrink-0 opacity-60" />
          </Collapsible.Trigger>
        </div>
        {/* Contenedor oculto para estado Ark; el menú visible va en portal */}
        <Collapsible.Content className="sr-only" aria-hidden>
          <span />
        </Collapsible.Content>
      </Collapsible.Root>
      {menu}
    </>
  )
}
