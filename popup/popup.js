const apiKey = document.getElementById('apiKey');
const model = document.getElementById('model');
const strictness = document.getElementById('strictness');
const keyStatus = document.getElementById('keyStatus');
const message = document.getElementById('message');
const buttons = ['saveBtn', 'testBtn', 'clearKeyBtn'].map((id) => document.getElementById(id));

function busy(value) { buttons.forEach((button) => { button.disabled = value; }); }
function status(text, tone = '') {
  message.textContent = text;
  message.className = `message ${tone}`;
}
function send(payload) {
  return new Promise((resolve, reject) => chrome.runtime.sendMessage(payload, (response) => {
    if (chrome.runtime.lastError) return reject(new Error('Extension connection lost. Reopen the popup.'));
    if (!response?.success) return reject(new Error(response?.error || 'Request failed.'));
    resolve(response.data);
  }));
}

async function load() {
  busy(true);
  try {
    const settings = await send({ type: 'GET_SETTINGS' });
    keyStatus.textContent = settings.apiKey ? 'Key configured. Leave blank to keep it.' : 'No key configured.';
    model.value = settings.model;
    strictness.value = settings.strictness;
  } catch (error) { status(error.message, 'error'); }
  finally { busy(false); }
}

async function save() {
  busy(true);
  status('Saving…');
  const settings = { model: model.value.trim(), strictness: strictness.value };
  if (apiKey.value.trim()) settings.apiKey = apiKey.value.trim();
  try {
    await send({ type: 'SAVE_SETTINGS', settings });
    if (settings.apiKey) { apiKey.value = ''; keyStatus.textContent = 'Key configured. Leave blank to keep it.'; }
    status('Settings saved.', 'success');
  } catch (error) { status(error.message, 'error'); }
  finally { busy(false); }
}

async function test() {
  busy(true);
  status('Connecting to Gemini…');
  try { status(await send({ type: 'TEST_GEMINI' }), 'success'); }
  catch (error) { status(error.message, 'error'); }
  finally { busy(false); }
}

async function clear() {
  busy(true);
  try {
    await send({ type: 'SAVE_SETTINGS', settings: { apiKey: '' } });
    apiKey.value = '';
    keyStatus.textContent = 'No key configured.';
    status('Key cleared.', 'success');
  } catch (error) { status(error.message, 'error'); }
  finally { busy(false); }
}

document.addEventListener('DOMContentLoaded', load);
buttons[0].addEventListener('click', save);
buttons[1].addEventListener('click', test);
buttons[2].addEventListener('click', clear);
