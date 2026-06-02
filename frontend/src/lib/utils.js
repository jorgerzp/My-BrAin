import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Utilidad estándar shadcn/ui para combinar clases Tailwind */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
