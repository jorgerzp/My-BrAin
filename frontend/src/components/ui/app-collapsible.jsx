import { Collapsible } from '@ark-ui/react/collapsible'
import { ChevronDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const contentAnim =
  'overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1'

/**
 * Desplegable accesible (Ark UI) con chevron animado.
 * Soporta modo controlado (`open` + `onOpenChange`) o no controlado (`defaultOpen`).
 */
export function AppCollapsible({
  trigger,
  children,
  open,
  defaultOpen,
  onOpenChange,
  disabled = false,
  className,
  triggerClassName,
  contentClassName,
  contentInnerClassName,
  showIndicator = true,
  indicatorClassName,
  id,
}) {
  const controlled = open !== undefined

  const rootProps = {
    id,
    disabled,
    className: cn('w-full', className),
    onOpenChange: (details) => onOpenChange?.(details.open),
    ...(controlled ? { open } : defaultOpen !== undefined ? { defaultOpen } : {}),
  }

  return (
    <Collapsible.Root {...rootProps}>
      <Collapsible.Trigger
        disabled={disabled}
        className={cn(
          'inline-flex w-full items-center gap-2 text-left text-sm font-medium text-gray-900 transition-all duration-200',
          'dark:text-gray-100',
          'disabled:cursor-not-allowed disabled:opacity-60',
          triggerClassName
        )}
      >
        {typeof trigger === 'string' ? <span className="min-w-0 flex-1">{trigger}</span> : trigger}
        {showIndicator && <AppCollapsibleChevron className={indicatorClassName} />}
      </Collapsible.Trigger>

      <Collapsible.Content className={cn(contentAnim, contentClassName)}>
        <div className={contentInnerClassName}>{children}</div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}

/** Chevron para usar dentro de `trigger` cuando `showIndicator={false}`. */
export function AppCollapsibleChevron({ className }) {
  return (
    <Collapsible.Indicator
      className={cn(
        'flex shrink-0 items-center justify-center transition-transform duration-200 data-[state=open]:rotate-180',
        className
      )}
    >
      <ChevronDownIcon className="h-4 w-4 text-current opacity-70" aria-hidden />
    </Collapsible.Indicator>
  )
}
