/** Shared button styles (Tailwind class strings). */
const base =
  'rounded-lg px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50'

export const buttonPrimary = `${base} bg-amber-400 font-semibold text-stone-950 hover:bg-amber-300 focus-visible:ring-amber-200`
export const buttonSecondary = `${base} border border-stone-600 text-stone-200 hover:border-stone-400 focus-visible:ring-stone-400`
export const buttonDanger = `${base} bg-red-500/90 font-semibold text-white hover:bg-red-500 focus-visible:ring-red-300`

export const inputText =
  'w-full min-w-0 rounded-md border border-stone-700 bg-stone-950 px-2 py-1 text-sm text-stone-100 placeholder:text-stone-600 focus-visible:border-amber-400 focus-visible:outline-none'
