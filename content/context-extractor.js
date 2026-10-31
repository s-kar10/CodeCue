(() => {
  const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();

  function problemSlug(url = location.href) {
    try {
      const parsed = new URL(url);
      return parsed.origin === 'https://leetcode.com'
        ? parsed.pathname.match(/^\/problems\/([a-z0-9-]+)(?:\/|$)/)?.[1] || ''
        : '';
    } catch {
      return '';
    }
  }

  function descriptionRoot() {
    return document.querySelector('[data-track-load="description_content"]') ||
      document.querySelector('[data-cy="question-content"]') ||
      document.querySelector('[class*="question-content"]');
  }

  function extractTitle(root, slug) {
    const known = root?.querySelector('[data-cy="question-title"], h1') ||
      document.querySelector('[data-cy="question-title"], [data-track-load="question_title"]');
    const title = clean(known?.textContent || document.title.replace(/\s*[-|]\s*LeetCode.*$/i, ''));
    return title || slug.replace(/-/g, ' ');
  }

  function extractDifficulty(root) {
    const selectors = ['[diff]', '[data-difficulty]', '[class*="difficulty"]', '[class*="text-difficulty"]'];
    for (const selector of selectors) {
      const element = root?.querySelector(selector) || document.querySelector(selector);
      const match = clean(element?.textContent || element?.getAttribute('diff') || element?.getAttribute('data-difficulty')).match(/\b(Easy|Medium|Hard)\b/i);
      if (match) return match[1];
    }
    return '';
  }

  function extractStatement(root) {
    if (!root) return '';
    const paragraphs = [];
    for (const element of root.querySelectorAll('p')) {
      const value = clean(element.textContent);
      if (/^(example\s*\d*|constraints?|follow.?up)\s*:/i.test(value)) break;
      if (value && !/^(easy|medium|hard)$/i.test(value)) paragraphs.push(value);
      if (paragraphs.join(' ').length >= 6500) break;
    }
    if (paragraphs.length) return paragraphs.join('\n').slice(0, 6500);
    return clean(root.textContent).slice(0, 6500);
  }

  function extractExamples(root) {
    if (!root) return [];
    const examples = [];
    for (const heading of root.querySelectorAll('strong, b, h3, h4')) {
      if (!/^example\s*\d*\s*:?$/i.test(clean(heading.textContent))) continue;
      const parent = heading.parentElement;
      const next = parent?.nextElementSibling;
      const value = clean(`${parent?.textContent || ''} ${next && /^(PRE|P|DIV)$/.test(next.tagName) ? next.textContent : ''}`);
      if (value) examples.push(value.slice(0, 600));
      if (examples.length === 4) break;
    }
    if (examples.length) return examples;
    return [...root.querySelectorAll('pre')].slice(0, 4).map((node) => clean(node.textContent).slice(0, 600)).filter(Boolean);
  }

  function extractConstraints(root) {
    if (!root) return [];
    for (const heading of root.querySelectorAll('strong, b, h3, h4')) {
      if (!/^constraints?\s*:?$/i.test(clean(heading.textContent))) continue;
      const parent = heading.parentElement;
      const list = parent?.querySelector('ul') || parent?.nextElementSibling?.querySelector('ul') ||
        (parent?.nextElementSibling?.tagName === 'UL' ? parent.nextElementSibling : null);
      if (list) return [...list.querySelectorAll('li')].slice(0, 8).map((item) => clean(item.textContent).slice(0, 300)).filter(Boolean);
    }
    return [];
  }

  function extractContext() {
    const slug = problemSlug();
    const root = descriptionRoot();
    const title = extractTitle(root, slug);
    const statement = extractStatement(root);
    const normalizedTitle = title.toLowerCase().replace(/^\d+\.\s*/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return {
      slug,
      title,
      difficulty: extractDifficulty(root),
      statement,
      constraints: extractConstraints(root),
      examples: extractExamples(root),
      url: location.href,
      ready: !!root && statement.length >= 40 && normalizedTitle === slug
    };
  }

  window.LeetBuddyExtractor = { extractContext, problemSlug };
})();
