import Fuse from 'fuse.js'

const FUSE_OPTIONS = {
  keys: [
    { name: 'title', weight: 0.6 },
    { name: 'tags', weight: 0.3 },
    { name: 'content', weight: 0.1 }
  ],
  threshold: 0.35,
  minMatchCharLength: 1
}

let fuse = null

export function buildSearch(answers) {
  fuse = new Fuse(answers, FUSE_OPTIONS)
}

export function searchAnswers(answers, query) {
  if (!query.trim()) {
    return [...answers].sort((a, b) => (b.useCount || 0) - (a.useCount || 0))
  }
  if (!fuse) buildSearch(answers)
  return fuse.search(query).map((r) => r.item)
}
