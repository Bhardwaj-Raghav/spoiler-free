"use strict";

/**
 * Spoiler Free — blur/remove tiles when video titles contain saved keywords.
 * YouTube uses shadow DOM and frequently changes classes; we walk light + open shadow
 * trees and match keywords with simple case-insensitive substring search (reliable vs \\b regex).
 */

let keywordsLower: string[] = [];
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
let lastHref = "";

function disconnectDomObserver(): void {
  domObserver?.disconnect();
  domObserver = null;
}

function scheduleScan(): void {
  if (keywordsLower.length === 0) {
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

/** Walk light DOM + open shadow roots; collect elements matching selector from `root` down. */
function queryDeepWithin(selector: string, root: Element): HTMLElement[] {
  const out: HTMLElement[] = [];
  function walk(el: Element): void {
    try {
      if (el.matches(selector)) {
        out.push(el as HTMLElement);
      }
    } catch {
      /* invalid selector */
    }
    if (el.shadowRoot) {
      el.shadowRoot.querySelectorAll("*").forEach((n) => walk(n as Element));
    }
    Array.from(el.children).forEach((c) => walk(c as Element));
  }
  walk(root);
  return out;
}

/** Prefer real video title nodes inside a card/renderer. */
function findVideoTitleIn(host: Element): HTMLElement | null {
  const selectors = [
    "#video-title",
    "yt-formatted-string#video-title",
    'a[id="video-title"]',
    "#video-title.link",
    "h3 yt-formatted-string",
    "h3 a",
  ];
  for (const sel of selectors) {
    const hits = queryDeepWithin(sel, host);
    if (hits.length > 0) {
      return hits[0];
    }
  }
  return null;
}

/** Nearest block host for overlays / removal (avoid brittle .style-scope classes). */
function resolveTileRoot(titleEl: HTMLElement): HTMLElement | null {
  if (window.location.pathname.includes("/shorts")) {
    const reel = titleEl.closest("ytd-reel-video-renderer");
    if (reel) {
      return reel as HTMLElement;
    }
  }
  const tags = [
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-rich-grid-renderer",
    "ytd-grid-video-renderer",
    "ytd-playlist-panel-video-renderer",
    "ytd-reel-item-renderer",
    "ytd-reel-video-renderer",
    "ytd-dismissible-video-renderer",
  ];
  for (const tag of tags) {
    const host = titleEl.closest(tag);
    if (host) {
      return host as HTMLElement;
    }
  }
  return null;
}

function tileText(titleEl: HTMLElement): string {
  return (titleEl.innerText ?? titleEl.textContent ?? "").trim();
}

function doesMatchKeyWords(text: string): boolean {
  if (keywordsLower.length === 0 || !text) {
    return false;
  }
  const t = text.toLowerCase();
  return keywordsLower.some((k) => k.length > 0 && t.includes(k));
}

function getMatchedKeywords(text: string): string[] {
  if (keywordsLower.length === 0 || !text) {
    return [];
  }
  const t = text.toLowerCase();
  return keywordsLower.filter((k) => k.length > 0 && t.includes(k));
}

function scanHomeOrSubscriptions(): void {
  document.querySelectorAll("ytd-rich-item-renderer").forEach((host) => {
    const titleEl = findVideoTitleIn(host);
    if (!titleEl) {
      return;
    }
    const text = tileText(titleEl);
    if (doesMatchKeyWords(text)) {
      performActionOnMatch(titleEl);
    }
  });
}

function scanSearch(): void {
  const seen = new WeakSet<Element>();
  const runHost = (host: Element): void => {
    if (seen.has(host)) {
      return;
    }
    seen.add(host);
    const titleEl = findVideoTitleIn(host);
    if (!titleEl) {
      return;
    }
    const text = tileText(titleEl);
    if (doesMatchKeyWords(text)) {
      performActionOnMatch(titleEl);
    }
  };
  document.querySelectorAll("ytd-video-renderer, ytd-compact-video-renderer").forEach(runHost);
  document.querySelectorAll("ytd-reel-item-renderer").forEach(runHost);
  document.querySelectorAll("ytd-rich-item-renderer").forEach(runHost);
}

function scanChannel(): void {
  document.querySelectorAll("ytd-grid-video-renderer, ytd-rich-item-renderer").forEach((host) => {
    const titleEl = findVideoTitleIn(host);
    if (!titleEl) {
      return;
    }
    const text = tileText(titleEl);
    if (doesMatchKeyWords(text)) {
      performActionOnMatch(titleEl);
    }
  });
  document.querySelectorAll("ytd-reel-item-renderer").forEach((host) => {
    const titleEl = findVideoTitleIn(host);
    if (!titleEl) {
      return;
    }
    const text = tileText(titleEl);
    if (doesMatchKeyWords(text)) {
      performActionOnMatch(titleEl);
    }
  });
}

function scanShorts(): void {
  document.querySelectorAll("ytd-reel-video-renderer").forEach((host) => {
    const titleEl = findVideoTitleIn(host);
    if (!titleEl) {
      return;
    }
    const text = tileText(titleEl);
    if (doesMatchKeyWords(text)) {
      performActionOnMatch(titleEl);
    }
  });
}

function scanVisibleTiles(): void {
  if (keywordsLower.length === 0) {
    return;
  }
  const page = currentPage();
  if (page === "title" && _settings.title) {
    scanHomeOrSubscriptions();
  } else if (page === "subscription" && _settings.subscription) {
    scanHomeOrSubscriptions();
  } else if (page === "search" && _settings.search) {
    scanSearch();
  } else if (page === "channel" && _settings.channel) {
    scanChannel();
  } else if (page === "shorts" && _settings.shorts) {
    scanShorts();
  }
}

function connectDomObserver(): void {
  disconnectDomObserver();
  if (keywordsLower.length === 0) {
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
    keywordsLower = (keywords as unknown[])
      .map((k) => String(k).trim().toLowerCase())
      .filter((k) => k.length > 0);
  } else {
    keywordsLower = [];
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
    requestAnimationFrame(() => scanVisibleTiles());
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
  if (location.href === lastHref) {
    return;
  }
  lastHref = location.href;
  scheduleScan();
}

lastHref = location.href;
window.addEventListener("popstate", onNavigation);

window.addEventListener("yt-navigate-finish", () => {
  onNavigation();
});

window.setInterval(() => {
  if (location.href !== lastHref) {
    onNavigation();
  }
}, 800);

const currentPage = (): string => {
  const path = window.location.pathname;
  if (path === "/") {
    return "title";
  }
  if (path === "/results") {
    return "search";
  }
  if (path.includes("/feed")) {
    return "subscription";
  }
  if (path.includes("/shorts")) {
    return "shorts";
  }
  if (path.includes("/@")) {
    return "channel";
  }
  return "";
};

/** User chose Reveal — never re-blur this tile until it leaves the DOM (e.g. scroll recycle). */
const REVEALED_ATTR = "data-spoiler-free-revealed";

type OverlayWithTeardown = HTMLElement & { sfTeardown?: () => void };

/**
 * Shorts paints title/metadata in layers above slotted nodes. Pin a viewport-fixed cover to the
 * reel's bounding box so blur + scrim sit above YouTube's bottom chrome.
 */
function attachShortsOverlayToViewport(anchor: HTMLElement, overlay: OverlayWithTeardown): void {
  overlay.classList.add("spoiler-free-block-video-overlay-container--shorts-fixed");

  const sync = (): void => {
    if (!anchor.isConnected) {
      overlay.sfTeardown?.();
      return;
    }
    const r = anchor.getBoundingClientRect();
    overlay.style.setProperty("left", `${Math.round(r.left)}px`, "important");
    overlay.style.setProperty("top", `${Math.round(r.top)}px`, "important");
    overlay.style.setProperty("width", `${Math.round(r.width)}px`, "important");
    overlay.style.setProperty("height", `${Math.round(r.height)}px`, "important");
  };

  const ro = new ResizeObserver(() => {
    sync();
  });
  ro.observe(anchor);

  const teardown = (): void => {
    window.removeEventListener("scroll", sync, true);
    window.removeEventListener("resize", sync);
    ro.disconnect();
    overlay.remove();
    overlay.sfTeardown = undefined;
  };

  overlay.sfTeardown = teardown;

  window.addEventListener("scroll", sync, true);
  window.addEventListener("resize", sync);

  document.body.appendChild(overlay);
  sync();
  requestAnimationFrame(sync);
}

const performActionOnMatch = (titleEl: HTMLElement) => {
  const mainElement = resolveTileRoot(titleEl);
  if (!mainElement) {
    return;
  }
  const pageText = tileText(titleEl);

  if (!isBlur) {
    mainElement.remove();
    void updateBlockedContentCount();
    return;
  }

  if (mainElement.hasAttribute(REVEALED_ATTR)) {
    return;
  }

  const page = currentPage();
  if (page === "shorts" && _settings.shorts) {
    const shortVideo = document.querySelector<HTMLVideoElement>(
      "video.video-stream.html5-main-video"
    );
    shortVideo?.pause();
  }

  if (mainElement.getAttribute("spoiler-free-blured") === "blur") {
    return;
  }

  const matchesFound = getMatchedKeywords(pageText);
  if (matchesFound.length === 0) {
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
    (div as OverlayWithTeardown).sfTeardown?.();
    div.remove();
    mainElement.removeAttribute("spoiler-free-blured");
    mainElement.setAttribute(REVEALED_ATTR, "");
  };
  div.appendChild(removeBlurButton);

  if (page === "shorts") {
    attachShortsOverlayToViewport(mainElement, div as OverlayWithTeardown);
  } else {
    mainElement.appendChild(div);
  }
  mainElement.setAttribute("spoiler-free-blured", "blur");
  void updateBlockedContentCount();
};

const updateBlockedContentCount = async () => {
  totalBlocked = totalBlocked + 1;
  await chrome.storage.local.set({ blocked: totalBlocked });
};
