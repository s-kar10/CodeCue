# Recruiter demo (about 3 minutes)

1. Open `chrome://extensions` and show **LeetCode Student Buddy** loaded from this repository. Open the popup: point out key status, model, and the test button. A live connection test needs your own Gemini key and may incur usage.
2. Open `https://leetcode.com/problems/two-sum/`. Click **Open Student Buddy**. Show the detected title, description snapshot, examples, and constraints. If the page is still hydrating, wait until hint 1 enables.
3. Optionally enter what you tried. Request hint 1 and read its question and next action. Request hints 2 and 3 to show the increasing detail. The actual wording varies with Gemini.
4. Show that the full solution remains disabled. Acknowledge the warning, wait 12 seconds from hint 3, and request hint 4. Navigate to another problem and show the title and progression reset.
5. Explain the trust boundary: the worker tracks progress, the key stays in local extension storage, and requests send problem context and notes to Gemini.

Without a key or live site access, open `docs/demo-preview.html` in Chrome to show the panel with sample data. Label it as a mock; it does not validate extension injection, Gemini output, or the live gate.
