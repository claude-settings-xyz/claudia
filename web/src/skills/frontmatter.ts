// Removes a key from the YAML frontmatter at the top of a SKILL.md. Every other line,
// and the body of the skill, stay as they are.
export function removeFrontmatterKey(text: string, key: string): string {
  const match = /^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n---)/.exec(text)
  if (!match) return text
  const [whole, open, body, close] = match
  const line = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}\\s*:`)
  const newline = body.includes('\r\n') ? '\r\n' : '\n'
  const kept = body.split(/\r?\n/).filter((each) => !line.test(each))
  return open + kept.join(newline) + close + text.slice(whole.length)
}
