(() => {
  const escape = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const inline = (value) => escape(value).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  function toHtml(markdown = '') {
    const parts = [];
    let inList = false;
    let inCode = false;
    const closeList = () => { if (inList) { parts.push('</ul>'); inList = false; } };
    for (const raw of String(markdown).split('\n')) {
      const line = raw.trim();
      if (line.startsWith('```')) {
        closeList();
        parts.push(inCode ? '</code></pre>' : '<pre><code>');
        inCode = !inCode;
        continue;
      }
      if (inCode) { parts.push(`${escape(raw)}\n`); continue; }
      if (!line) { closeList(); continue; }
      if (line.startsWith('## ')) { closeList(); parts.push(`<h4>${inline(line.slice(3))}</h4>`); continue; }
      if (/^(?:- |\* |\d+\.\s)/.test(line)) {
        if (!inList) { parts.push('<ul>'); inList = true; }
        parts.push(`<li>${inline(line.replace(/^(?:- |\* |\d+\.\s)/, ''))}</li>`);
        continue;
      }
      closeList();
      parts.push(`<p>${inline(line)}</p>`);
    }
    closeList();
    if (inCode) parts.push('</code></pre>');
    return parts.join('');
  }
  window.CodeCueMarkdown = { toHtml };
})();
