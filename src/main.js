import './styles.css';

const app = document.querySelector('#app');
const journalKey = 'outsidein.journal.v1';

app.innerHTML = `
  <main class="container">
    <section class="hero">
      <div>
        <h1>OutsideIn AI</h1>
        <p>Create a quick outdoor mission, then put your phone away and explore.</p>
        <p><strong>Privacy:</strong> reflections stay in your browser only.</p>
      </div>
      <div class="scene" aria-hidden="true">
        <div class="cube">
          <div class="face front">🌿</div>
          <div class="face back">☀️</div>
          <div class="face right">🚶</div>
          <div class="face left">🧭</div>
          <div class="face top">🌳</div>
          <div class="face bottom">🪨</div>
        </div>
      </div>
    </section>

    <section class="card">
      <form id="missionForm">
        <label>
          Environment
          <select name="environment" required>
            <option value="Neighborhood">Neighborhood</option>
            <option value="Park">Park</option>
            <option value="Trail">Trail</option>
            <option value="Beach">Beach</option>
            <option value="City">City</option>
          </select>
        </label>
        <label>
          Available time (minutes)
          <input name="timeMinutes" type="number" min="10" max="240" step="5" value="30" required />
        </label>
        <label>
          Energy level
          <select name="energyLevel" required>
            <option value="Low">Low</option>
            <option value="Medium" selected>Medium</option>
            <option value="High">High</option>
          </select>
        </label>
        <label>
          Activity type
          <select name="activityType" required>
            <option value="Mindful walk">Mindful walk</option>
            <option value="Adventure">Adventure</option>
            <option value="Fitness">Fitness</option>
            <option value="Nature spotting">Nature spotting</option>
            <option value="Creative exploration">Creative exploration</option>
          </select>
        </label>
        <button class="full" type="submit">Generate mission</button>
      </form>
      <div id="status" class="notice" hidden></div>
    </section>

    <section id="missionSection" class="card" hidden></section>
    <section class="card" id="reflectionSection" hidden></section>
  </main>
`;

const missionForm = document.querySelector('#missionForm');
const statusEl = document.querySelector('#status');
const missionSection = document.querySelector('#missionSection');
const reflectionSection = document.querySelector('#reflectionSection');

const setStatus = (text, isError = false) => {
  statusEl.hidden = !text;
  statusEl.textContent = text || '';
  statusEl.className = `notice${isError ? ' error' : ''}`;
};

const toText = (value) => (typeof value === 'string' ? value : '');

const readApiResponse = async (response) => {
  const text = await response.text();
  let data = null;
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `Mission service returned invalid JSON (HTTP ${response.status}).`
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      toText(data?.error) ||
      `Mission service request failed (HTTP ${response.status}).`
    );
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Mission service returned an empty response.');
  }

  return data;
};

const getJournal = () => {
  try {
    const raw = localStorage.getItem(journalKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveJournal = (entries) => {
  localStorage.setItem(journalKey, JSON.stringify(entries));
};

const renderReflections = (missionTitle = '') => {
  const entries = getJournal();
  reflectionSection.hidden = false;
  reflectionSection.replaceChildren();

  const title = document.createElement('h2');
  title.textContent = 'Mission reflection journal';

  const info = document.createElement('p');
  info.textContent = 'Saved only in this browser. Never sent to external AI providers.';

  const form = document.createElement('form');
  form.innerHTML = `
    <label class="full">How did it feel?<textarea name="reflection" required></textarea></label>
    <button class="full" type="submit">Save reflection locally</button>
  `;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const reflection = new FormData(form).get('reflection');
    const value = toText(reflection).trim();
    if (!value) {
      setStatus('Reflection cannot be empty.', true);
      return;
    }
    const next = [{
      missionTitle,
      reflection: value,
      createdAt: new Date().toISOString()
    }, ...getJournal()];
    saveJournal(next.slice(0, 20));
    form.reset();
    setStatus('Reflection saved locally in your browser.');
    renderReflections(missionTitle);
  });

  const listTitle = document.createElement('h3');
  listTitle.textContent = 'Recent reflections';

  const list = document.createElement('ul');
  if (!entries.length) {
    const empty = document.createElement('li');
    empty.textContent = 'No reflections yet. Complete a mission and add one!';
    list.append(empty);
  } else {
    entries.forEach((entry) => {
      const li = document.createElement('li');
      const heading = toText(entry.missionTitle) || 'Untitled mission';
      const when = toText(entry.createdAt).slice(0, 10);
      li.textContent = `${heading} (${when}): ${toText(entry.reflection)}`;
      list.append(li);
    });
  }

  reflectionSection.append(title, info, form, listTitle, list);
};

const renderMission = (mission, sourceLabel) => {
  missionSection.hidden = false;
  missionSection.replaceChildren();

  const source = document.createElement('span');
  source.className = 'badge';
  source.textContent = sourceLabel;

  const title = document.createElement('h2');
  title.textContent = toText(mission.title) || 'Outdoor mission';

  const duration = document.createElement('p');
  duration.textContent = `Duration: ${toText(mission.duration) || 'Flexible'}`;

  const instructionTitle = document.createElement('h3');
  instructionTitle.textContent = 'Instructions';

  const instructionList = document.createElement('ul');
  const instructions = Array.isArray(mission.instructions) ? mission.instructions : [];
  instructions.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = toText(item);
    instructionList.append(li);
  });

  const completion = document.createElement('p');
  completion.textContent = `Completion condition: ${toText(mission.completionCondition)}`;

  const reflection = document.createElement('p');
  const reflectionText = toText(mission.reflectionQuestion);
  reflection.textContent = reflectionText ? `Reflection prompt: ${reflectionText}` : 'Reflection prompt: optional';

  const safetyTitle = document.createElement('h3');
  safetyTitle.textContent = 'Safety reminders';

  const safetyList = document.createElement('ul');
  const safetyTips = Array.isArray(mission.safetyTips) ? mission.safetyTips : [];
  safetyTips.forEach((tip) => {
    const li = document.createElement('li');
    li.textContent = toText(tip);
    safetyList.append(li);
  });

  const away = document.createElement('div');
  away.className = 'notice';
  away.textContent = 'Put your phone away and explore. Return when you are done to reflect.';

  missionSection.append(
    source,
    title,
    duration,
    instructionTitle,
    instructionList,
    completion,
    reflection,
    safetyTitle,
    safetyList,
    away
  );

  renderReflections(toText(mission.title));
};

missionForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('Generating mission...');

  const formData = new FormData(missionForm);
  const payload = {
    environment: toText(formData.get('environment')).trim(),
    timeMinutes: Number(formData.get('timeMinutes')),
    energyLevel: toText(formData.get('energyLevel')).trim(),
    activityType: toText(formData.get('activityType')).trim()
  };

  try {
    const response = await fetch('/api/mission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await readApiResponse(response);
    if (!data.mission) {
      throw new Error('Mission service response did not include a mission.');
    }

    const sourceLabel = data.source === 'ollama'
      ? `AI-generated (Ollama: ${toText(data.model) || 'configured model'})`
      : data.source === 'huggingface'
        ? `AI-generated (Hugging Face: ${toText(data.model) || 'configured model'})`
        : 'Preset mission (AI unavailable)';

    renderMission(data.mission, sourceLabel);
    if (data.note) {
      setStatus(data.note);
    } else {
      setStatus('Mission ready. Enjoy the outdoors!');
    }
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Unknown error while generating mission.', true);
  }
});

renderReflections();
