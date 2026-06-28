const TAG_PALETTE = [
  { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa' },
  { bg: 'rgba(236,72,153,0.15)', color: '#f472b6' },
  { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
  { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
  { bg: 'rgba(239,68,68,0.15)', color: '#f87171' }
]

export function getTagColor(tag = '') {
  let hash = 0
  for (const c of tag) {
    hash = (hash * 31 + c.charCodeAt(0)) % TAG_PALETTE.length
  }
  return TAG_PALETTE[hash]
}
