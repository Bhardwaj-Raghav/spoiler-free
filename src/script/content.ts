"use strict";

/** What the extension does (match manifest / popup): scan video titles for keywords and blur or remove tiles on Home, Search, Subscriptions, Shorts, and channel pages. */

let keywordRegex: RegExp | undefined;
const _settings = {
  title: true,
  subscription: true,
  search: true,
  shorts: true,
  channel: true,
};
let totalBlocked = 0;
let isBlur = true;

let domObserver: MutationObserver | null = null;
let scanDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastPathname = "";

const HOME_GRID_SCAN = {
  querySelecter: [
    "yt-formatted-string.style-scope.ytd-rich-grid-media#video-title",
    "#video-title.style-scope.ytd-rich-grid-slim-media",
  ],
  elementToDeleteSelector: ["ytd-rich-item-renderer.style-scope", "ytd-rich-item-renderer.style-scope"],
} as const;

const SEARCH_GRID_SCAN = {
  querySelecter: [
    "yt-formatted-string.style-scope.ytd-video-renderer",
    "#video-title.style-scope.ytd-reel-item-renderer",
  ],
  elementToDeleteSelector: [
    ".style-scope.ytd-item-section-renderer",
    "ytd-reel-item-renderer.style-scope.yt-horizontal-list-renderer",
  ],
} as const;

function createRegexFromWords(words: string[]): RegExp | undefined {
  const trimmed = words.map((w) => w.trim()).filter(Boolean);
  if (trimmed.length === 0) {
    return undefined;
  }
  const regexPattern =
    "\\b" +
    trimmed.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\b|\\b") +
    "\\b";
  return new RegExp(regexPattern, "i");
}

function disconnectDomObserver(): void {
  domObserver?.disconnect();
  domObserver = null;
}

function scheduleScan(): void {
  if (!keywordRegex) {
    return;
  }
  if (scanDebounceTimer !== null) {
    clearTimeout(scanDebounceTimer);
  }
  scanDebounceTimer = setTimeout(() => {
    scanDebounceTimer = null;
    scanVisibleTiles();
  }, 200);
}

function scanGridTiles(scan: {
  readonly querySelecter: readonly string[];
  readonly elementToDeleteSelector: readonly string[];
}): void {
  for (let i = 0; i < scan.querySelecter.length; i++) {
    const deleteSelector = scan.elementToDeleteSelector[i];
    if (deleteSelector === undefined) {
      continue;
    }
    document.querySelectorAll(scan.querySelecter[i]).forEach((el) => {
      const element = el as HTMLElement;
      if (doesMatchKeyWords(element.innerText)) {
        performActionOnMatch(element, deleteSelector);
      }
    });
  }
}

/** Scan visible tiles for the current route (also used on load / storage updates / SPA navigations). */
function scanVisibleTiles(): void {
  if (!keywordRegex) {
    return;
  }
  const page = currentPage();
  if (page === "title" && _settings.title) {
    scanGridTiles(HOME_GRID_SCAN);
  } else if (page === "subscription" && _settings.subscription) {
    scanGridTiles(HOME_GRID_SCAN);
  } else if (page === "search" && _settings.search) {
    scanGridTiles(SEARCH_GRID_SCAN);
  } else if (page === "channel" && _settings.channel) {
    runSubscriptionPageFunc();
  } else if (page === "shorts" && _settings.shorts) {
    runShortRemoveFunc();
  }
}

function connectDomObserver(): void {
  disconnectDomObserver();
  if (!keywordRegex) {
    return;
  }
  domObserver = new MutationObserver(() => {
    scheduleScan();
  });
  domObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function applyStoragePayload(data: Record<string, unknown>): void {
  const { keywords, settings, blocked, remove } = data;

  if (settings && typeof settings === "object") {
    const s = settings as typeof _settings;
    _settings.title = Boolean(s.title);
    _settings.subscription = Boolean(s.subscription);
    _settings.search = Boolean(s.search);
    _settings.shorts = Boolean(s.shorts);
    _settings.channel = Boolean(s.channel);
  }

  if (Array.isArray(keywords)) {
    keywordRegex = createRegexFromWords(keywords as string[]);
  } else {
    keywordRegex = undefined;
  }

  if (typeof blocked === "number" && Number.isFinite(blocked)) {
    totalBlocked = blocked;
  }

  isBlur = remove !== true;
}

function setupObserversAfterHydrate(): void {
  connectDomObserver();
  requestAnimationFrame(() => {
    scanVisibleTiles();
  });
}

async function hydrateFromStorage(): Promise<void> {
  const data = await chrome.storage.local.get();
  applyStoragePayload(data as Record<string, unknown>);
  setupObserversAfterHydrate();
}

void hydrateFromStorage();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") {
    return;
  }
  const keys = Object.keys(changes);
  if (keys.length === 1 && keys[0] === "blocked") {
    const next = changes.blocked?.newValue;
    if (typeof next === "number" && Number.isFinite(next)) {
      totalBlocked = next;
    }
    return;
  }
  void hydrateFromStorage();
});

function onNavigation(): void {
  if (location.pathname === lastPathname) {
    return;
  }
  lastPathname = location.pathname;
  scheduleScan();
}

lastPathname = location.pathname;
window.addEventListener("popstate", onNavigation);

/** YouTube fires this on in-app navigations (SPA). */
window.addEventListener("yt-navigate-finish", () => {
  onNavigation();
});

/** Fallback if custom events differ between YouTube variants. */
window.setInterval(() => {
  if (location.pathname !== lastPathname) {
    onNavigation();
  }
}, 800);

const runSubscriptionPageFunc = () => {
  document
    .querySelectorAll(".yt-simple-endpoint.style-scope.ytd-grid-video-renderer")
    .forEach((el) => {
      const element = el as HTMLElement;
      if (doesMatchKeyWords(element.innerText)) {
        performActionOnMatch(
          element,
          "ytd-grid-video-renderer.style-scope.yt-horizontal-list-renderer"
        );
      }
    });
  document.querySelectorAll(".style-scope.ytd-reel-item-renderer").forEach((el) => {
    const element = el as HTMLElement;
    if (doesMatchKeyWords(element.innerText)) {
      performActionOnMatch(
        element,
        "ytd-reel-item-renderer.style-scope.yt-horizontal-list-renderer"
      );
    }
  });
  document.querySelectorAll("yt-formatted-string.style-scope.ytd-rich-grid-media").forEach((el) => {
    const element = el as HTMLElement;
    if (doesMatchKeyWords(element.innerText)) {
      performActionOnMatch(element, "ytd-rich-item-renderer.style-scope.ytd-rich-grid-row");
    }
  });
  document.querySelectorAll(".style-scope.ytd-rich-grid-slim-media#video-title").forEach((el) => {
    const element = el as HTMLElement;
    if (doesMatchKeyWords(element.innerText)) {
      performActionOnMatch(element, "ytd-rich-item-renderer.style-scope.ytd-rich-grid-row");
    }
  });
};

const runShortRemoveFunc = () => {
  document
    .querySelectorAll(
      "ytd-reel-video-renderer[is-active].reel-video-in-sequence.style-scope.ytd-shorts yt-formatted-string.style-scope.reel-player-header-renderer"
    )
    .forEach((el) => {
      const element = el as HTMLElement;
      if (doesMatchKeyWords(element.innerText)) {
        performActionOnMatch(
          element,
          "ytd-reel-video-renderer[is-active].reel-video-in-sequence.style-scope.ytd-shorts"
        );
      }
    });
};

const currentPage = (): string => {
  const currentPath: string = window.location.pathname;
  if (currentPath === "/") {
    return "title";
  } else if (currentPath === "/results") {
    return "search";
  } else if (currentPath.includes("/feed")) {
    return "subscription";
  } else if (currentPath.includes("/shorts")) {
    return "shorts";
  } else if (currentPath.includes("/@")) {
    return "channel";
  } else {
    return "";
  }
};

const doesMatchKeyWords = (string: string) => {
  return keywordRegex !== undefined && keywordRegex.test(string);
};

const getMatchedKeywords = (string: string) => {
  if (keywordRegex === undefined) {
    return null;
  }
  return string.match(keywordRegex);
};

const performActionOnMatch = (element: HTMLElement, elementToDeleteSelector: string) => {
  const mainElement = element.closest(elementToDeleteSelector);
  if (!mainElement) {
    return;
  }
  if (!isBlur) {
    mainElement.remove();
    void updateBlockedContentCount();
    return;
  }
  const page = currentPage();
  if (page === "shorts" && _settings.shorts) {
    const shortVideo = document.querySelector<HTMLVideoElement>(
      "video.video-stream.html5-main-video[controlslist='nodownload']"
    );
    shortVideo?.pause();
  }
  if (mainElement.getAttribute("spoiler-free-blured") === "blur") {
    return;
  }
  const matchesFound = getMatchedKeywords(element.innerText);
  if (!matchesFound || matchesFound.length === 0) {
    return;
  }
  const div = document.createElement("div");
  div.className = "spoiler-free-block-video-overlay-container";
  matchesFound.forEach((match) => {
    const badge = document.createElement("span");
    badge.className = "spoiler-free-block-video-badge";
    badge.innerText = match;
    div.appendChild(badge);
  });

  const removeBlurButton = document.createElement("button");
  removeBlurButton.innerText = "Reveal";
  removeBlurButton.className = "spoiler-free-block-video-remove-blur";
  removeBlurButton.onclick = function () {
    div.remove();
  };
  div.appendChild(removeBlurButton);
  mainElement.appendChild(div);
  mainElement.setAttribute("spoiler-free-blured", "blur");
  void updateBlockedContentCount();
};

const updateBlockedContentCount = async () => {
  totalBlocked = totalBlocked + 1;
  await chrome.storage.local.set({ blocked: totalBlocked });
};
