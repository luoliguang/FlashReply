export function parseVariables(content = '') {
  const matches = content.match(/\{\{(.+?)\}\}/g) || []
  return [...new Set(matches.map((m) => m.slice(2, -2).trim()))]
}

export function fillVariables(content = '', vars = {}) {
  return content.replace(/\{\{(.+?)\}\}/g, (_, key) => vars[key.trim()] ?? '')
}
