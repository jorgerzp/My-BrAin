import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../components/DashboardLayout'
import { PromptBox } from '@/components/ui/chatgpt-prompt-input'
import { readJsonResponse } from '../utils/readJsonResponse'

const SUGGESTIONS = [
  '¿Qué categoría de gasto fue la más alta este mes?',
  'Resume mi menú de esta semana',
  '¿Cuánto he gastado vs el mes pasado?',
  'Consejo de ahorro según mis datos',
]

export default function MiAsistente() {
  const { user } = useAuth()
  const userId = user?.id
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [aiOk, setAiOk] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    fetch('/api/ai/status')
      .then((r) => r.json())
      .then((d) => setAiOk(!!d.groq))
      .catch(() => setAiOk(false))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = useCallback(
    async (text) => {
      const trimmed = String(text || '').trim()
      if (!userId || !trimmed || loading) return
      setError('')
      const historyForApi = messages.map(({ role, content }) => ({ role, content }))
      setMessages((prev) => [...prev, { role: 'user', content: trimmed }])
      setLoading(true)
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, message: trimmed, history: historyForApi }),
        })
        const data = await readJsonResponse(res)
        if (!res.ok) throw new Error(data.error || 'Error en el chat')
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply || '' }])
      } catch (e) {
        setMessages((prev) => prev.slice(0, -1))
        setError(e.message || 'Error de red')
      } finally {
        setLoading(false)
      }
    },
    [userId, loading, messages]
  )

  return (
    <DashboardLayout className="flex flex-1 flex-col items-center justify-center px-4 py-6">
        {error && (
          <p
            className="mb-3 w-full max-w-xl shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            role="alert"
          >
            {error}
          </p>
        )}

        {aiOk === false && (
          <p
            className="mb-3 w-full max-w-xl shrink-0 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs text-amber-900"
            role="status"
          >
            IA no disponible: configura <code className="rounded bg-black/5 px-1">GROQ_API_KEY</code>.
          </p>
        )}

        <section className="flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <header className="shrink-0 border-b border-black/[0.05] px-4 py-3 text-center">
            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              Mi Asistente
            </p>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-[var(--color-text)]">
              ¿En qué puedo ayudarte?
            </h1>
          </header>

          <div className="custom-scrollbar min-h-[200px] max-h-[min(42vh,380px)] flex-1 overflow-y-auto px-3 py-4 sm:px-4">
            {messages.length === 0 && !loading && (
              <ul className="mb-3 flex flex-col gap-1.5">
                {SUGGESTIONS.map((q) => (
                  <li key={q}>
                    <button
                      type="button"
                      onClick={() => sendMessage(q)}
                      disabled={!userId || loading || aiOk === false}
                      className="w-full rounded-xl border border-black/[0.06] bg-white/60 px-3 py-2 text-left text-xs text-[var(--color-text)] transition hover:bg-white hover:shadow-sm disabled:opacity-50"
                    >
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-col gap-3">
              {messages.map((m, i) => (
                <div
                  key={`${i}-${m.role}`}
                  className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      m.role === 'user'
                        ? 'bg-[var(--apple-black)] text-white'
                        : 'border border-black/[0.06] bg-white/90 text-[var(--color-text)]'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl border border-black/[0.06] bg-white/90 px-3 py-2 text-xs text-[var(--color-text-muted)]">
                    <span className="inline-flex gap-0.5" aria-hidden>
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:120ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:240ms]" />
                    </span>
                    Pensando…
                  </div>
                </div>
              )}
              <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
            </div>
          </div>

          <footer className="shrink-0 border-t border-black/[0.05] bg-white/50 p-2.5 backdrop-blur-sm sm:p-3">
            <PromptBox
              onSend={sendMessage}
              disabled={!userId || aiOk === false}
              isLoading={loading}
              placeholder="Mensaje…"
            />
          </footer>
        </section>
    </DashboardLayout>
  )
}
