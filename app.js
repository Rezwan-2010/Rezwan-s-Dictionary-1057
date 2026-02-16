const STORAGE_KEY = "dictionary:v1";
const RECENTLY_VIEWED_KEY = "recentlyViewed";

const DEFAULT = {
  vacant: { definition: "empty", phonetics: "", category: "Daily Use" },
  apple: { definition: "a fruit that is round and red or green", phonetics: "/ˈæp.əl/", category: "Food" },
  book: { definition: "a set of printed pages bound together", phonetics: "/bʊk/", category: "Daily Use" },
  cat: { definition: "a small domesticated carnivorous mammal", phonetics: "/kæt/", category: "Daily Use" },
  dog: { definition: "a domesticated canid, often kept as a pet", phonetics: "/dɔːɡ/", category: "Daily Use" },
  house: { definition: "a building for human habitation", phonetics: "/haʊs/", category: "Daily Use" },
  car: { definition: "a road vehicle powered by an engine, typically with four wheels", phonetics: "/kɑːr/", category: "Daily Use" },
  tree: { definition: "a perennial plant with an elongated stem, or trunk, supporting branches and leaves", phonetics: "/triː/", category: "Nature" },
  river: { definition: "a large natural stream of water flowing in a channel to the sea, a lake, or another river", phonetics: "/ˈrɪv.ər/", category: "Nature" },
  mountain: { definition: "a large natural elevation of the earth's surface rising abruptly from the surrounding level", phonetics: "/ˈmaʊn.tən/", category: "Nature" },
  sky: { definition: "the region of the atmosphere and outer space seen from the earth", phonetics: "/skaɪ/", category: "Nature" },
  sun: { definition: "the star at the center of our solar system that provides light and heat", phonetics: "/sʌn/", category: "Science" },
  moon: { definition: "the natural satellite that orbits the earth", phonetics: "/muːn/", category: "Science" },
  water: { definition: "a transparent, tasteless, odorless liquid essential for most plant and animal life", phonetics: "/ˈwɔː.tər/", category: "Nature" },
  fire: { definition: "the visible, gaseous part of a combustion process producing heat and light", phonetics: "/faɪər/", category: "Science" },
};

let dict = load();
let recentlyViewed = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY)) || [];
let debounceTimer;

const $ = sel => document.querySelector(sel);
const $list = $("#list");
const $search = $("#search");
const $clearSearch = $("#clear-search");
const $word = $("#word");
const $definition = $("#definition");
const $add = $("#add");
const $exportBtn = $("#export-btn");
const $importBtn = $("#import-btn");
const $importFile = $("#import-file");
const $categoryFilter = $("#category-filter");

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT };
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch (e) {
    console.error("load error", e);
    return { ...DEFAULT };
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dict));
  } catch (e) {
    console.error("save error", e);
  }
}

async function fetchDefinitionFromAPI(word) {
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
    const data = await response.json();

    if (data && data[0]) {
      const meaning = data[0].meanings[0];
      const definition = meaning.definitions[0]?.definition || "Definition not available";
      const phonetics = data[0].phonetics.find(p => p.text)?.text || "";
      return { definition, phonetics, category: "Daily Use" };
    } else {
      return { definition: "Definition not available", phonetics: "", category: "Daily Use" };
    }
  } catch (e) {
    console.error(`Error fetching definition for ${word}:`, e);
    return { definition: "Definition not available", phonetics: "", category: "Daily Use" };
  }
}

async function fetchRandomWord() {
  try {
    const response = await fetch('https://random-word-api.herokuapp.com/word?number=1');
    const [word] = await response.json();
    const { definition, phonetics } = await fetchDefinitionFromAPI(word);
    return { word, definition, phonetics };
  } catch (e) {
    console.error("Error fetching random word:", e);
    return { word: "Word", definition: "Definition not available", phonetics: "" };
  }
}

async function showWordOfTheDay() {
  const { word, definition, phonetics } = await fetchRandomWord();
  const wordOfTheDayElement = document.createElement("div");
  wordOfTheDayElement.className = "word-of-the-day";
  wordOfTheDayElement.innerHTML = `
    <h3>🌟 Word of the Day</h3>
    <div class="word">${word}</div>
    <div class="pronunciation">${phonetics}</div>
    <div class="definition">${definition}</div>
  `;
  document.querySelector("#app").prepend(wordOfTheDayElement);
}

function addToRecentlyViewed(word) {
  if (!recentlyViewed.includes(word)) {
    recentlyViewed.unshift(word);
    if (recentlyViewed.length > 10) recentlyViewed.pop();
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(recentlyViewed));
  }
}

function renderRecentlyViewed() {
  if (recentlyViewed.length === 0) return;

  const container = document.createElement("div");
  container.className = "recently-viewed";
  container.innerHTML = `<h3>🕒 Recently Viewed</h3>`;

  recentlyViewed.forEach(word => {
    const wordElement = document.createElement("div");
    wordElement.textContent = word;
    wordElement.className = "recent-word";
    wordElement.addEventListener("click", () => {
      $search.value = word;
      render(word);
    });
    container.appendChild(wordElement);
  });

  document.querySelector("#app").prepend(container);
}

function speak(word) {
  const utterance = new SpeechSynthesisUtterance(word);
  speechSynthesis.speak(utterance);
}

function exportDictionary() {
  const data = JSON.stringify(dict);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dictionary_backup.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importDictionary(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const importedDict = JSON.parse(e.target.result);
    for (const [key, value] of Object.entries(importedDict)) {
      dict[key] = value;
    }
    save();
    render($search.value.trim());
  };
  reader.readAsText(file);
}

async function render(filter = "") {
  $list.innerHTML = "";
  const keys = Object.keys(dict).sort();
  const categoryFilter = $categoryFilter.value;
  const filtered = keys.filter(k =>
    k.includes(filter.toLowerCase()) &&
    (!categoryFilter || dict[k].category === categoryFilter)
  );

  if (!filtered.length && filter) {
    const loadingElement = document.createElement("div");
    loadingElement.className = "empty";
    loadingElement.textContent = "Loading...";
    $list.appendChild(loadingElement);

    const { definition, phonetics, category } = await fetchDefinitionFromAPI(filter);
    dict[filter] = { definition, phonetics, category };
    save();
    addToRecentlyViewed(filter);
    filtered.push(filter);
    $list.innerHTML = "";
  }

  if (!filtered.length) {
    const el = document.createElement("div");
    el.className = "empty";
    el.textContent = "No words found";
    $list.appendChild(el);
    return;
  }

  filtered.forEach(key => {
    const li = document.createElement("li");
    li.className = "item";

    const w = document.createElement("div");
    w.className = "word";
    w.textContent = key;

    const pronunciation = document.createElement("div");
    pronunciation.className = "pronunciation";
    pronunciation.textContent = dict[key].phonetics || "";

    const d = document.createElement("div");
    d.className = "definition";
    d.textContent = dict[key].definition || dict[key];

    const actions = document.createElement("div");
    actions.className = "actions";

    const speakBtn = document.createElement("button");
    speakBtn.className = "icon-btn speak";
    speakBtn.title = "Pronounce";
    speakBtn.innerHTML = "🔊";
    speakBtn.addEventListener("click", () => speak(key));

    const edit = document.createElement("button");
    edit.className = "icon-btn";
    edit.title = "Edit";
    edit.innerHTML = "✎";
    edit.addEventListener("click", () => {
      $word.value = key;
      $definition.value = dict[key].definition;
      $word.focus();
    });

    const del = document.createElement("button");
    del.className = "icon-btn danger";
    del.title = "Delete";
    del.innerHTML = "🗑";
    del.addEventListener("click", () => {
      if (!confirm(`Delete "${key}"?`)) return;
      delete dict[key];
      save();
      render($search.value.trim());
    });

    actions.appendChild(speakBtn);
    actions.appendChild(edit);
    actions.appendChild(del);

    li.appendChild(w);
    if (pronunciation.textContent) li.appendChild(pronunciation);
    li.appendChild(d);
    li.appendChild(actions);
    $list.appendChild(li);
  });
}

$add.addEventListener("click", () => {
  const w = $word.value.trim();
  const d = $definition.value.trim();
  if (!w || !d) {
    alert("Both word and definition are required.");
    return;
  }
  dict[w.toLowerCase()] = { definition: d, phonetics: "", category: "Daily Use" };
  save();
  addToRecentlyViewed(w);
  $word.value = "";
  $definition.value = "";
  render($search.value.trim());
});

$search.addEventListener("input", async e => {
  const q = e.target.value.trim();
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    await render(q);
  }, 500);
});

$clearSearch.addEventListener("click", () => {
  $search.value = "";
  render("");
});

$exportBtn.addEventListener("click", exportDictionary);
$importBtn.addEventListener("click", () => $importFile.click());
$importFile.addEventListener("change", importDictionary);

$word.addEventListener("keyup", e => {
  if (e.key === "Enter") $definition.focus();
});
$definition.addEventListener("keyup", e => {
  if (e.key === "Enter") $add.click();
});

// Initialize theme toggle
const themeToggle = document.createElement("button");
themeToggle.textContent = "🌙";
themeToggle.style.position = "fixed";
themeToggle.style.top = "10px";
themeToggle.style.right = "10px";
themeToggle.style.background = "var(--card)";
themeToggle.style.border = "1px solid var(--border)";
themeToggle.style.borderRadius = "50%";
themeToggle.style.width = "40px";
themeToggle.style.height = "40px";
themeToggle.style.cursor = "pointer";
themeToggle.style.zIndex = "1000";

themeToggle.addEventListener("click", () => {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  themeToggle.textContent = newTheme === "dark" ? "☀️" : "🌙";
});

document.body.appendChild(themeToggle);

export function initializeApp() {
  showWordOfTheDay();
  renderRecentlyViewed();
  render("");
}
