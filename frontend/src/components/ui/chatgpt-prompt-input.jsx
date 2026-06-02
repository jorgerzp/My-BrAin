import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'

const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger
const TooltipContent = React.forwardRef(({ className, sideOffset = 4, showArrow = false, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'relative z-50 max-w-[280px] rounded-md bg-popover text-popover-foreground px-1.5 py-1 text-xs animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className
      )}
      {...props}
    >
      {props.children}
      {showArrow && <TooltipPrimitive.Arrow className="-my-px fill-popover" />}
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger
const PopoverContent = React.forwardRef(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 w-64 rounded-xl bg-popover dark:bg-[#303030] p-2 text-popover-foreground dark:text-white shadow-md outline-none animate-in data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

const Dialog = DialogPrimitive.Root
const DialogPortal = DialogPrimitive.Portal
const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-[90vw] md:max-w-[800px] translate-x-[-50%] translate-y-[-50%] gap-4 border-none bg-transparent p-0 shadow-none duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        className
      )}
      {...props}
    >
      <div className="relative bg-card dark:bg-[#303030] rounded-[28px] overflow-hidden shadow-2xl p-1">
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 z-10 rounded-full bg-background/50 dark:bg-[#303030] p-1 hover:bg-accent dark:hover:bg-[#515151] transition-all">
          <XIcon className="h-5 w-5 text-muted-foreground dark:text-gray-200 hover:text-foreground dark:hover:text-white" />
          <span className="sr-only">Cerrar</span>
        </DialogPrimitive.Close>
      </div>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

function PlusIcon(props) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M12 5V19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 12H19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Settings2Icon(props) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M20 7h-9" />
      <path d="M14 17H5" />
      <circle cx="17" cy="17" r="3" />
      <circle cx="7" cy="7" r="3" />
    </svg>
  )
}

function SendIcon(props) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M12 5.25L12 18.75"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.75 12L12 5.25L5.25 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function XIcon(props) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function GlobeIcon(props) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function PencilIcon(props) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  )
}

function PaintBrushIcon(props) {
  return (
    <svg viewBox="0 0 512 512" fill="currentColor" {...props}>
      <path d="M141.176,324.641l25.323,17.833c7.788,5.492,17.501,7.537,26.85,5.67c9.35-1.877,17.518-7.514,22.597-15.569l22.985-36.556l-78.377-55.222l-26.681,33.96c-5.887,7.489-8.443,17.081-7.076,26.511C128.188,310.69,133.388,319.158,141.176,324.641z" />
      <path d="M384.289,64.9c9.527-15.14,5.524-35.06-9.083-45.355l-0.194-0.129c-14.615-10.296-34.728-7.344-45.776,6.705L170.041,228.722l77.067,54.292L384.289,64.9z" />
    </svg>
  )
}

function TelescopeIcon(props) {
  return (
    <svg viewBox="0 0 512 512" fill="currentColor" {...props}>
      <path d="M452.425,202.575l-38.269-23.11c-1.266-10.321-5.924-18.596-13.711-21.947l-86.843-52.444l-0.275,0.598c-3.571-7.653-9.014-13.553-16.212-16.668L166.929,10.412l-0.236,0.543v-0.016c-3.453-2.856-7.347-5.239-11.594-7.08C82.569-10.435,40.76,14.5,21.516,59.203C2.275,103.827,12.82,151.417,45.142,165.36c4.256,1.826,8.669,3.005,13.106,3.556l-0.19,0.464l146.548,40.669c7.19,3.107,15.206,3.004,23.229,0.37l-0.236,0.566L365.55,238.5c7.819,3.366,17.094,1.125,25.502-5.082l42.957,11.909c7.67,3.312,18.014-3.548,23.104-15.362C462.202,218.158,460.11,205.894,452.425,202.575z" />
    </svg>
  )
}

function LightbulbIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M12 7C9.23858 7 7 9.23858 7 12C7 13.3613 7.54402 14.5955 8.42651 15.4972C8.77025 15.8484 9.05281 16.2663 9.14923 16.7482L9.67833 19.3924C9.86537 20.3272 10.6862 21 11.6395 21H12.3605C13.3138 21 14.1346 20.3272 14.3217 19.3924L14.8508 16.7482C14.9472 16.2663 15.2297 15.8484 15.5735 15.4972C16.456 14.5955 17 13.3613 17 12C17 9.23858 14.7614 7 12 7Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M12 4V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 17H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function MicIcon(props) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
    </svg>
  )
}

const toolsList = [
  { id: 'createImage', name: 'Crear una imagen', shortName: 'Imagen', icon: PaintBrushIcon },
  { id: 'searchWeb', name: 'Buscar en la web', shortName: 'Buscar', icon: GlobeIcon },
  { id: 'writeCode', name: 'Redactar o programar', shortName: 'Escribir', icon: PencilIcon },
  { id: 'deepResearch', name: 'Investigación profunda', shortName: 'Investigar', icon: TelescopeIcon },
  { id: 'thinkLonger', name: 'Pensar más tiempo', shortName: 'Pensar', icon: LightbulbIcon },
]

/**
 * @param {object} props
 * @param {string} [props.placeholder]
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.isLoading]
 * @param {(text: string) => void} [props.onSend]
 */
export const PromptBox = React.forwardRef(function PromptBox(
  { className, placeholder = 'Escribe tu mensaje…', disabled = false, isLoading = false, onSend, onChange, ...props },
  ref
) {
  const internalTextareaRef = React.useRef(null)
  const fileInputRef = React.useRef(null)
  const [value, setValue] = React.useState('')
  const [imagePreview, setImagePreview] = React.useState(null)
  const [selectedTool, setSelectedTool] = React.useState(null)
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false)
  const [isImageDialogOpen, setIsImageDialogOpen] = React.useState(false)

  React.useImperativeHandle(ref, () => internalTextareaRef.current)

  React.useLayoutEffect(() => {
    const textarea = internalTextareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    const newHeight = Math.min(textarea.scrollHeight, 140)
    textarea.style.height = `${newHeight}px`
  }, [value])

  const handleInputChange = (e) => {
    setValue(e.target.value)
    onChange?.(e)
  }

  const handlePlusClick = () => fileInputRef.current?.click()

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onloadend = () => setImagePreview(reader.result)
      reader.readAsDataURL(file)
    }
    event.target.value = ''
  }

  const handleRemoveImage = (e) => {
    e.stopPropagation()
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const submitMessage = () => {
    const text = value.trim()
    if (!text || disabled || isLoading) return
    onSend?.(text)
    setValue('')
    onChange?.({ target: { value: '' } })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submitMessage()
    }
    props.onKeyDown?.(e)
  }

  const hasValue = value.trim().length > 0 || imagePreview
  const activeTool = selectedTool ? toolsList.find((t) => t.id === selectedTool) : null
  const ActiveToolIcon = activeTool?.icon
  const blocked = disabled || isLoading
  const iconBtn =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-black/5 focus-visible:outline-none disabled:opacity-40 dark:text-white/90 dark:hover:bg-white/10'

  return (
    <div
      className={cn(
        'flex flex-col rounded-[20px] border border-black/[0.08] bg-white/95 p-1.5 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-[#2f2f2f]/95',
        blocked && 'opacity-75',
        className
      )}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
      />

      {imagePreview && (
        <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
          <div className="relative mb-1 w-fit rounded-[1rem] px-1 pt-1">
            <button type="button" className="transition-transform" onClick={() => setIsImageDialogOpen(true)}>
              <img src={imagePreview} alt="Vista previa" className="h-[58px] w-[58px] rounded-[1rem] object-cover" />
            </button>
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute right-2 top-2 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-white/50 dark:bg-[#303030] text-black dark:text-white transition-colors hover:bg-accent dark:hover:bg-[#515151]"
              aria-label="Quitar imagen"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
          <DialogContent>
            <img
              src={imagePreview}
              alt="Imagen ampliada"
              className="w-full max-h-[95vh] object-contain rounded-[24px]"
            />
          </DialogContent>
        </Dialog>
      )}

      {activeTool && (
        <div className="mb-1 flex items-center gap-1.5 px-1">
          <button
            type="button"
            onClick={() => setSelectedTool(null)}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#2294ff]/10 px-2 py-0.5 text-xs font-medium text-[#1a7ad4] dark:bg-[#99ceff]/15 dark:text-[#99ceff]"
          >
            {ActiveToolIcon && <ActiveToolIcon className="h-3 w-3 shrink-0" />}
            <span className="truncate">{activeTool.shortName}</span>
            <XIcon className="h-3 w-3 shrink-0 opacity-70" />
          </button>
        </div>
      )}

      <TooltipProvider delayDuration={80}>
        <div className="flex items-end gap-0.5 px-0.5">
          <div className="flex shrink-0 items-center gap-0.5 pb-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handlePlusClick}
                  disabled={blocked}
                  className={iconBtn}
                >
                  <PlusIcon className="h-[18px] w-[18px]" />
                  <span className="sr-only">Adjuntar imagen</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" showArrow>
                <p>Adjuntar imagen</p>
              </TooltipContent>
            </Tooltip>

            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={blocked}
                      className={cn(iconBtn, selectedTool && 'bg-black/5 dark:bg-white/10')}
                    >
                      <Settings2Icon className="h-[17px] w-[17px]" />
                      <span className="sr-only">Herramientas</span>
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" showArrow>
                  <p>Explorar herramientas</p>
                </TooltipContent>
              </Tooltip>
              <PopoverContent side="top" align="start">
                <div className="flex flex-col gap-1">
                  {toolsList.map((tool) => (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => {
                        setSelectedTool(tool.id)
                        setIsPopoverOpen(false)
                      }}
                      className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-accent dark:hover:bg-[#515151]"
                    >
                      <tool.icon className="h-4 w-4 shrink-0" />
                      <span>{tool.name}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

          </div>

          <textarea
            ref={internalTextareaRef}
            rows={1}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={blocked}
            className="custom-scrollbar min-h-[40px] max-h-[140px] flex-1 resize-none border-0 bg-transparent py-2.5 pl-1 pr-1 text-[0.9375rem] leading-snug text-foreground placeholder:text-muted-foreground focus:ring-0 focus-visible:outline-none disabled:cursor-not-allowed dark:text-white dark:placeholder:text-gray-400"
            {...props}
          />

          <div className="flex shrink-0 items-center gap-0.5 pb-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    disabled={blocked}
                    className={iconBtn}
                    aria-label="Voz (próximamente)"
                  >
                    <MicIcon className="h-[17px] w-[17px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" showArrow>
                  <p>Voz (próximamente)</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={submitMessage}
                    disabled={!hasValue || blocked}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--apple-black)] text-white transition-opacity hover:opacity-90 disabled:bg-black/25 disabled:text-white/50 dark:bg-white dark:text-black dark:disabled:bg-white/20"
                  >
                    <SendIcon className="h-[17px] w-[17px]" />
                    <span className="sr-only">Enviar</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" showArrow>
                  <p>{isLoading ? 'Enviando…' : 'Enviar'}</p>
                </TooltipContent>
              </Tooltip>
          </div>
        </div>
      </TooltipProvider>
    </div>
  )
})

PromptBox.displayName = 'PromptBox'
