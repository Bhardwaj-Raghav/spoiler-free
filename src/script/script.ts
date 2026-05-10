"use strict";

type ThemeSetting = "dark" | "light";

function isExtensionContext(): boolean {
  try {
    return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

function requireEl<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Spoiler Free: missing required element #${id}`);
  }
  return node as T;
}

const PREVIEW_STORAGE_KEY = "spoiler-free-preview";

/** Mirrors `chrome.storage.local` for opening `index.html` in a normal tab (design preview). */
async function storageLocalGet(
  keys?: string | string[] | Record<string, unknown> | null
): Promise<Record<string, unknown>> {
  if (isExtensionContext()) {
    const result = await chrome.storage.local.get(keys as never);
    return result as Record<string, unknown>;
  }
  let all: Record<string, unknown> = {};
  try {
    const raw = localStorage.getItem(PREVIEW_STORAGE_KEY);
    if (raw) all = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    all = {};
  }
  if (keys == null) return all;
  if (typeof keys === "string") {
    return keys in all ? { [keys]: all[keys] } : {};
  }
  if (Array.isArray(keys)) {
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      if (k in all) out[k] = all[k];
    }
    return out;
  }
  return { ...all, ...(keys as Record<string, unknown>) };
}

async function storageLocalSet(items: Record<string, unknown>): Promise<void> {
  if (isExtensionContext()) {
    await chrome.storage.local.set(items);
    return;
  }
  const all = (await storageLocalGet()) as Record<string, unknown>;
  Object.assign(all, items);
  localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(all));
}

function showPreviewBanner(): void {
  if (isExtensionContext()) return;
  const bar = document.createElement("div");
  bar.setAttribute("role", "status");
  bar.textContent =
    "Design preview — run npm run dev and open http://localhost:5173. Settings stay in this browser only (localStorage).";
  bar.style.cssText =
    "font:12px/1.4 system-ui,sans-serif;padding:8px 12px;background:#31363f;color:#eee;text-align:center";
  document.body.prepend(bar);
}

const themeToggle = requireEl<HTMLInputElement>("theme-toggle");
const bodyElement: HTMLElement = document.body;
const form = requireEl<HTMLElement>("add-keyword-form");
const input = requireEl<HTMLInputElement>("keyword-input");
const closeList = requireEl<HTMLButtonElement>("close-keyword-list");
const keywordListPage = requireEl<HTMLElement>("edit-keywords-list");
const openList = requireEl<HTMLButtonElement>("open-keywords-list");
const keywordList = requireEl<HTMLElement>("keyword-list");
const settingToggles: HTMLCollectionOf<HTMLInputElement> = document.getElementsByClassName(
  "settings-toggle"
) as HTMLCollectionOf<HTMLInputElement>;
const totalKeywords = requireEl<HTMLElement>("total-keywords-added");
const totalBlockedCount = requireEl<HTMLElement>("total-blocked-videos");
const blurToggle = requireEl<HTMLInputElement>("block-content-toggle");

let localKeywords: string[] = [];
const localSettings = {
  title: true,
  subscription: true,
  search: true,
  shorts: true,
  channel: true,
};

showPreviewBanner();

storageLocalGet().then(({ mode, keywords, settings, blocked, remove }) => {
  if (mode === "dark") {
    bodyElement.classList.add("dark-theme");
    themeToggle.setAttribute("checked", "checked");
  }
  if (keywords) {
    localKeywords = keywords as string[];
    localKeywords.forEach((keyword) => {
      createKeywordListItem(keyword);
    });
  }
  totalKeywords.innerText = formatCount(localKeywords.length);
  if (settings) {
    const s = settings as typeof localSettings;
    localSettings.title = s.title;
    localSettings.subscription = s.subscription;
    localSettings.search = s.search;
    localSettings.shorts = s.shorts;
    localSettings.channel = s.channel;
  }
  for (const key in settingToggles) {
    if (Object.prototype.hasOwnProperty.call(settingToggles, key)) {
      const element = settingToggles[key];
      element.checked = localSettings[element.value as keyof typeof localSettings];
      element.onchange = async function () {
        localSettings[element.value as keyof typeof localSettings] = element.checked;
        await storageLocalSet({ settings: localSettings });
      };
    }
  }
  if (blocked) {
    totalBlockedCount.innerText = formatCount(blocked as number);
  }
  if (!remove) {
    blurToggle.checked = true;
  }
});

openList.addEventListener("click", function () {
  keywordListPage.classList.add("is-open");
});

closeList.addEventListener("click", function () {
  keywordListPage.classList.remove("is-open");
});

themeToggle.addEventListener("change", async function () {
  bodyElement.classList.toggle("dark-theme");
  const isDark = (await storageLocalGet("mode")).mode as ThemeSetting | undefined;
  await storageLocalSet({
    mode: isDark === "dark" ? "light" : "dark",
  });
});

blurToggle.addEventListener("change", async function () {
  await storageLocalSet({ remove: !this.checked });
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const keyword: string = input.value.toLowerCase();
  if (localKeywords.indexOf(keyword) !== -1) {
    return alert("Keyword already added");
  }
  input.value = "";
  const newKeywords = [...localKeywords, keyword];
  localKeywords = newKeywords;
  await storageLocalSet({ keywords: localKeywords });
  createKeywordListItem(keyword);
  totalKeywords.innerText = formatCount(localKeywords.length);
});

const createKeywordListItem = (keyword: string) => {
  const listItem = document.createElement("li");

  const label = document.createElement("span");
  label.className = "keyword-label";
  label.innerText = keyword;

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-keyword";
  deleteButton.value = keyword;
  deleteButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
            <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z" />
        </svg>`;
  deleteButton.onclick = async function () {
    listItem.remove();
    const newKeywords = localKeywords.filter((v) => {
      return v !== keyword;
    });
    localKeywords = newKeywords;
    await storageLocalSet({ keywords: localKeywords });
    totalKeywords.innerText = formatCount(localKeywords.length);
  };

  listItem.appendChild(label);
  listItem.appendChild(deleteButton);
  keywordList.appendChild(listItem);
};

const formatCount = (number: number) => {
  let formattedNumber = number.toString();
  if (number < 10_000) {
    formattedNumber = new Intl.NumberFormat().format(number);
  } else if (number >= 10_000 && number < 1_000_000) {
    formattedNumber = `${new Intl.NumberFormat().format(number / 1000)}K`;
  } else if (number >= 1_000_000 && number < 1_000_000_000) {
    formattedNumber = `${new Intl.NumberFormat().format(number / 1000)}M`;
  } else if (number >= 1_000_000_000 && number < 1_000_000_000_000) {
    formattedNumber = `${new Intl.NumberFormat().format(number / 1000)}B`;
  } else if (number >= 1_000_000_000_000) {
    formattedNumber = `${new Intl.NumberFormat().format(number / 1000)}T`;
  }
  return formattedNumber;
};
