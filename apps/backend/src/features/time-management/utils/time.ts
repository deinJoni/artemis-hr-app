export function parseIso(input: string | null | undefined): Date | null {
  if (!input) return null
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? null : d
}

export function startOfWeekUtc(d: Date): Date {
  const dt = new Date(d)
  const day = dt.getUTCDay()
  const diffToMonday = (day + 6) % 7
  dt.setUTCDate(dt.getUTCDate() - diffToMonday)
  dt.setUTCHours(0, 0, 0, 0)
  return dt
}

export function endOfWeekUtc(d: Date): Date {
  const start = startOfWeekUtc(d)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 7)
  return end
}

export function clampNonNegative(n: number): number {
  return n < 0 ? 0 : n
}

export function formatTimeDisplay(minutes: number | null): string {
  if (minutes === null) return '—'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins.toString().padStart(2, '0')}m`
}

export function parseIsoDate(dateString: string | null | undefined): Date | null {
  if (!dateString) return null
  const date = new Date(dateString)
  return Number.isNaN(date.getTime()) ? null : date
}
