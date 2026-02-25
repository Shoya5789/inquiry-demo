export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function urgencyLabel(u: string, locale = 'ja'): string {
  const map: Record<string, Record<string, string>> = {
    HIGH: { ja: '高', en: 'High' },
    MED: { ja: '中', en: 'Med' },
    LOW: { ja: '低', en: 'Low' },
  }
  return map[u]?.[locale] ?? u
}

export function urgencyColor(u: string): string {
  if (u === 'HIGH') return 'bg-red-100 text-red-800'
  if (u === 'MED') return 'bg-yellow-100 text-yellow-800'
  return 'bg-green-100 text-green-800'
}

export function importanceColor(u: string): string {
  if (u === 'HIGH') return 'bg-purple-100 text-purple-800'
  if (u === 'MED') return 'bg-blue-100 text-blue-800'
  return 'bg-gray-100 text-gray-800'
}

export function statusLabel(s: string, locale = 'ja'): string {
  const map: Record<string, Record<string, string>> = {
    NEW: { ja: '新着', en: 'New' },
    IN_PROGRESS: { ja: '対応中', en: 'In Progress' },
    ANSWERED: { ja: '回答済', en: 'Answered' },
  }
  return map[s]?.[locale] ?? s
}

export function statusColor(s: string): string {
  if (s === 'NEW') return 'bg-blue-100 text-blue-800'
  if (s === 'IN_PROGRESS') return 'bg-yellow-100 text-yellow-800'
  return 'bg-green-100 text-green-800'
}

export function parseTags(tags: string): string[] {
  try {
    const parsed = JSON.parse(tags)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
  }
}

export function channelLabel(c: string): string {
  const map: Record<string, string> = { web: 'Webフォーム', email: 'メール', phone: '電話' }
  return map[c] ?? c
}
