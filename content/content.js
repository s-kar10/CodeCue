(() => {
  if (window.__leetBuddyInjected) return;
  window.__leetBuddyInjected = true;

  const state = {
    slug: '', context: null, sessionId: '', version: 0, completedTiers: [],
    confirmed: false, cooldownUntil: 0, loading: false, panelOpen: false
  };
  const order = ['tier1', 'tier2', 'tier3', 'tier4'];
  const shell = document.createElement('div');
  shell.id = 'lsb-shell';
  shell.innerHTML = `
    <button id="lsb-fab" type="button" aria-controls="lsb-panel" aria-expanded="false">Open Student Buddy</button>
    <aside id="lsb-panel" aria-labelledby="lsb-problem-title" hidden>
      <header class="lsb-header">
        <div><p class="lsb-eyebrow">LeetCode Student Buddy</p><h2 id="lsb-problem-title">Loading problem…</h2><p id="lsb-problem-meta"></p></div>
        <button id="lsb-close" type="button" aria-label="Close Student Buddy">×</button>
      </header>
      <div class="lsb-panel-content">
        <section class="lsb-section" aria-labelledby="lsb-context-heading">
          <h3 id="lsb-context-heading">Problem snapshot</h3>
          <p id="lsb-summary"></p>
          <details><summary>Constraints</summary><ul id="lsb-constraints"></ul></details>
          <details><summary>Examples</summary><ul id="lsb-examples"></ul></details>
        </section>
        <details class="lsb-section lsb-reflection">
          <summary id="lsb-reflection-heading">Your approach <span class="lsb-muted">(optional)</span></summary>
          <label for="lsb-tried">What have you tried?</label>
          <textarea id="lsb-tried" rows="2" maxlength="800" placeholder="I tried a brute-force loop…"></textarea>
          <label for="lsb-stuck">Where are you stuck?</label>
          <textarea id="lsb-stuck" rows="2" maxlength="800" placeholder="I’m unsure how to avoid repeated work…"></textarea>
        </details>
        <section class="lsb-section" aria-labelledby="lsb-tiers-heading">
          <h3 id="lsb-tiers-heading">Choose a hint</h3>
          <p class="lsb-muted">Each level unlocks after the previous hint is shown.</p>
          <div class="lsb-tier-grid">
            <button type="button" data-tier="tier1">1 · Conceptual nudge</button>
            <button type="button" data-tier="tier2">2 · Strategy and insight</button>
            <button type="button" data-tier="tier3">3 · Plan and edge cases</button>
            <button type="button" data-tier="tier4">4 · Full solution</button>
          </div>
          <div class="lsb-gate">
            <label for="lsb-confirm"><input id="lsb-confirm" type="checkbox" disabled /> I understand the full solution may reduce my independent practice.</label>
            <p id="lsb-cooldown-text" class="lsb-muted"></p>
          </div>
        </section>
        <section class="lsb-section lsb-output" aria-labelledby="lsb-output-title">
          <div class="lsb-output-heading"><h3 id="lsb-output-title">Hint</h3><span id="lsb-status" role="status" aria-live="polite"></span></div>
          <article id="lsb-output-body"><p>Start with the first hint when the problem description is ready.</p></article>
        </section>
      </div>
    </aside>`;
  document.body.appendChild(shell);

  const get = (selector) => shell.querySelector(selector);
  const panel = get('#lsb-panel');
  const fab = get('#lsb-fab');
  const close = get('#lsb-close');
  const title = get('#lsb-problem-title');
  const meta = get('#lsb-problem-meta');
  const summary = get('#lsb-summary');
  const constraints = get('#lsb-constraints');
  const examples = get('#lsb-examples');
  const outputTitle = get('#lsb-output-title');
  const output = get('#lsb-output-body');
  const status = get('#lsb-status');
  const confirm = get('#lsb-confirm');
  const cooldown = get('#lsb-cooldown-text');
  const tried = get('#lsb-tried');
  const stuck = get('#lsb-stuck');
  const tierButtons = [...shell.querySelectorAll('[data-tier]')];

  function send(payload) {
    return new Promise((resolve, reject) => chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) return reject(new Error('Extension connection lost. Reload the page and retry.'));
      if (!response?.success) return reject(new Error(response?.error || 'Request failed. Retry.'));
      resolve(response.data);
    }));
  }

  function setStatus(message, tone = '') {
    status.textContent = message;
    status.className = tone ? `lsb-${tone}` : '';
  }

  function showOutput(message, markdown = false) {
    if (markdown) output.innerHTML = window.LeetBuddyMarkdown.toHtml(message);
    else output.textContent = message;
  }

  function setPanelOpen(open) {
    state.panelOpen = open;
    panel.hidden = !open;
    fab.hidden = open || !state.slug;
    fab.setAttribute('aria-expanded', String(open));
    if (open) close.focus();
    else fab.focus();
  }

  function remainingSeconds() {
    return Math.max(0, Math.ceil((state.cooldownUntil - Date.now()) / 1000));
  }

  function canRequest(tier) {
    if (!state.sessionId || !state.context?.ready || state.loading) return false;
    const missing = order.slice(0, order.indexOf(tier)).some((required) => !state.completedTiers.includes(required));
    return !missing && (tier !== 'tier4' || (state.confirmed && remainingSeconds() === 0));
  }

  function syncControls() {
    for (const button of tierButtons) {
      const tier = button.dataset.tier;
      button.disabled = !canRequest(tier);
      button.classList.toggle('lsb-done', state.completedTiers.includes(tier));
      button.setAttribute('aria-label', `${button.textContent.trim()}${state.completedTiers.includes(tier) ? ', viewed' : ''}`);
    }
    const firstThreeDone = state.completedTiers.includes('tier3');
    confirm.disabled = !firstThreeDone || state.loading;
    confirm.checked = state.confirmed;
    cooldown.textContent = !firstThreeDone
      ? 'The full solution unlocks after hints 1–3, acknowledgement, and a short pause.'
      : remainingSeconds() > 0
        ? `Full solution available in ${remainingSeconds()} seconds after acknowledgement.`
        : state.confirmed ? 'Full solution is unlocked.' : 'Pause complete. Acknowledge above to unlock the solution.';
    output.setAttribute('aria-busy', String(state.loading));
  }

  function listInto(element, items, empty) {
    element.replaceChildren();
    for (const item of items?.length ? items : [empty]) {
      const li = document.createElement('li');
      li.textContent = item;
      element.appendChild(li);
    }
  }

  function renderContext() {
    const context = state.context;
    title.textContent = context.title || 'LeetCode problem';
    meta.textContent = context.difficulty ? `${context.difficulty} · ${context.slug}` : context.slug;
    summary.textContent = context.ready ? context.statement.slice(0, 500) : 'Waiting for the problem description to load…';
    listInto(constraints, context.constraints, 'No constraints detected.');
    listInto(examples, context.examples, 'No examples detected.');
    if (!context.ready) setStatus('Waiting for problem description…', 'info');
    else if (state.sessionId && !state.loading && !state.completedTiers.length) setStatus('Ready for hint 1.', 'info');
  }

  function saveReflection() {
    if (state.slug) void send({ type: 'SAVE_REFLECTION', slug: state.slug, note: { tried: tried.value, stuck: stuck.value } })
      .catch(() => setStatus('Could not save your notes.', 'error'));
  }
  async function loadReflection(slug, version) {
    try {
      const note = await send({ type: 'GET_REFLECTION', slug });
      if (state.version !== version) return;
      if (!tried.value) tried.value = note.tried || '';
      if (!stuck.value) stuck.value = note.stuck || '';
    } catch { if (state.version === version) setStatus('Could not load your notes.', 'error'); }
  }

  async function startProblem(context) {
    saveReflection();
    const version = ++state.version;
    state.slug = context.slug;
    state.context = context;
    state.sessionId = '';
    state.completedTiers = [];
    state.confirmed = false;
    state.cooldownUntil = 0;
    state.loading = false;
    tried.value = '';
    stuck.value = '';
    outputTitle.textContent = 'Hint';
    showOutput('Start with the first hint when the problem description is ready.');
    renderContext();
    syncControls();
    loadReflection(context.slug, version);
    try {
      const data = await send({ type: 'START_SESSION' });
      if (state.version !== version) return;
      state.sessionId = data.sessionId;
      syncControls();
      renderContext();
    } catch (error) {
      if (state.version === version) setStatus(error.message, 'error');
    }
  }

  function checkProblem() {
    const context = window.LeetBuddyExtractor.extractContext();
    fab.hidden = !context.slug || state.panelOpen;
    if (!context.slug) {
      if (state.slug) {
        saveReflection();
        state.slug = '';
        state.sessionId = '';
        ++state.version;
        setPanelOpen(false);
      }
      return;
    }
    if (context.slug !== state.slug) {
      void startProblem(context);
      return;
    }
    if (JSON.stringify(context) !== JSON.stringify(state.context)) {
      state.context = context;
      renderContext();
      syncControls();
    }
  }

  async function requestTier(tier) {
    if (!canRequest(tier)) return;
    const version = state.version;
    const sessionId = state.sessionId;
    state.loading = true;
    outputTitle.textContent = `Loading hint ${order.indexOf(tier) + 1}…`;
    showOutput('Asking Gemini for a focused hint…');
    setStatus('Generating…', 'info');
    syncControls();
    try {
      const data = await send({
        type: 'GET_HINT', tier, sessionId, context: state.context,
        reflection: { tried: tried.value, stuck: stuck.value }
      });
      if (state.version !== version || state.sessionId !== sessionId) return;
      state.completedTiers = data.completedTiers;
      state.confirmed = data.confirmed;
      state.cooldownUntil = data.cooldownUntil;
      outputTitle.textContent = data.tierLabel;
      showOutput(data.content, true);
      setStatus('Hint ready', 'success');
      saveReflection();
    } catch (error) {
      if (state.version !== version) return;
      outputTitle.textContent = 'Hint unavailable';
      showOutput(error.message);
      setStatus(error.message, 'error');
    } finally {
      if (state.version === version) {
        state.loading = false;
        syncControls();
      }
    }
  }

  async function acknowledgeSolution() {
    if (state.confirmed) { confirm.checked = true; return; }
    if (!confirm.checked) return;
    const version = state.version;
    confirm.disabled = true;
    try {
      const data = await send({ type: 'CONFIRM_SOLUTION', sessionId: state.sessionId });
      if (state.version !== version) return;
      state.confirmed = data.confirmed;
      state.cooldownUntil = data.cooldownUntil;
      setStatus('Acknowledged.', 'success');
    } catch (error) {
      if (state.version !== version) return;
      confirm.checked = false;
      setStatus(error.message, 'error');
    } finally {
      if (state.version === version) syncControls();
    }
  }

  fab.addEventListener('click', () => setPanelOpen(!state.panelOpen));
  close.addEventListener('click', () => setPanelOpen(false));
  panel.addEventListener('keydown', (event) => { if (event.key === 'Escape') setPanelOpen(false); });
  tierButtons.forEach((button) => button.addEventListener('click', () => void requestTier(button.dataset.tier)));
  confirm.addEventListener('change', () => void acknowledgeSolution());
  tried.addEventListener('blur', saveReflection);
  stuck.addEventListener('blur', saveReflection);
  checkProblem();
  window.setInterval(checkProblem, 800);
  window.setInterval(syncControls, 500);
})();
