const HEADINGS = ['Hint', 'Why', 'Next Action', 'Check Yourself'];
const LIMITS = { tier1: 900, tier2: 1400, tier3: 2200 };

export function validateHintResponse(text, tier) {
  if (typeof text !== 'string' || !text.trim()) return false;
  if (tier === 'tier4') return /```[a-zA-Z0-9+#-]*\n[\s\S]+?```/.test(text) && /\btime\b/i.test(text) && /\bspace\b/i.test(text);
  if (!LIMITS[tier] || text.length > LIMITS[tier]) return false;

  const headings = [...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => match[1].trim());
  if (headings.length !== HEADINGS.length || headings.some((heading, i) => heading !== HEADINGS[i])) return false;

  const sections = text.split(/^##\s+[^\n]+$/gm).slice(1);
  if (sections.length !== 4 || sections.some((section) => !section.trim())) return false;

  // This catches obvious code and answer dumps; semantic leaks in prose remain possible.
  if (/```|`[^`]+`|\b(?:class|def|function|const|let|public static|return)\s+\w*\s*[=(]|\b(?:full solution|complete solution)\b/i.test(text)) return false;
  if (tier === 'tier1' && /^\s*(?:\d+[.)]|step\s+\d+)/im.test(text)) return false;
  return true;
}
