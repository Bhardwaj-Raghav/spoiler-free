"use strict";

/**
 * Spoiler Free — block (cover) or remove tiles when video titles contain saved keywords.
 * YouTube uses shadow DOM and frequently changes classes; we walk light + open shadow
 * trees and match keywords with simple case-insensitive substring search (reliable vs \\b regex).
 */

let keywordsLower: string[] = [];
const _settings = {
  title: true,
  subscription: true,
  search: true,
  watch: true,
  channel: true,
};
let totalBlocked = 0;
let isBlur = true;

let domObserver: MutationObserver | null = null;
let scanDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastHref = "";
let watchPollId: ReturnType<typeof setInterval> | null = null;

function disconnectDomObserver(): void {
  domObserver?.disconnect();
  domObserver = null;
  if (watchPollId !== null) {
    clearInterval(watchPollId);
    watchPollId = null;
  }
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
    "#video-title-link",
    "yt-formatted-string#video-title",
    "yt-formatted-string#video-title-link",
    'a[id="video-title"]',
    'a[id="video-title-link"]',
    "#video-title.link",
    "h3 yt-formatted-string",
    "h3 a",
    /* Watch /search lockup UI (yt-lockup-view-model, ytd-item-section-renderer.lockup) */
    "span.ytAttributedStringHost.ytAttributedStringWhiteSpacePreWrap",
    "yt-attributed-string span.ytAttributedStringHost",
    "span.ytAttributedStringHost",
  ];
  for (const sel of selectors) {
    const hits = queryDeepWithin(sel, host);
    if (hits.length > 0) {
      return hits[0];
    }
  }
  return null;
}

/**
 * Walk ancestors crossing shadow roots (closest() does not escape shadow → host, so tile roots fail
 * for titles rendered inside open shadow trees, e.g. compact recommendations on /watch).
 */
function resolveTileHostFromTitle(titleEl: HTMLElement, knownHost: Element | null): HTMLElement | null {
  if (knownHost instanceof HTMLElement) {
    return knownHost;
  }
  return resolveTileRoot(titleEl);
}

/** True when `el` lives under the watch-page sidebar (Up next), not the main column. */
function isInWatchSidebar(el: Element): boolean {
  let seenSecondary = false;
  let node: Element | null = el;
  for (let i = 0; i < 96 && node; i++) {
    if (node.id === "secondary" || node.id === "secondary-inner") {
      seenSecondary = true;
    }
    if (
      node.tagName === "YTD-WATCH-NEXT-SECONDARY-RESULTS-RENDERER" ||
      node.tagName === "YTD-WATCH-NEXT-COMPACT-LIST-RENDERER" ||
      node.tagName === "YTD-WATCH-NEXT-MIX-RENDERER"
    ) {
      seenSecondary = true;
    }
    if (node.id === "primary" || node.id === "primary-inner") {
      return false;
    }
    if (node.parentElement) {
      node = node.parentElement;
    } else {
      const root = node.getRootNode();
      if (root instanceof ShadowRoot) {
        node = root.host;
      } else {
        break;
      }
    }
  }
  return seenSecondary;
}

/**
 * Up next lives under #secondary inside ytd-app shadow trees; shallow querySelector often misses it.
 */
function deepFindWatchSidebarRoots(): HTMLElement[] {
  const out: HTMLElement[] = [];
  const seen = new WeakSet<HTMLElement>();
  const push = (el: Element): void => {
    if (!(el instanceof HTMLElement)) {
      return;
    }
    if (seen.has(el)) {
      return;
    }
    seen.add(el);
    out.push(el);
  };
  function walk(el: Element): void {
    if (el.id === "secondary" || el.id === "secondary-inner") {
      push(el);
    }
    const tag = el.tagName;
    if (
      tag === "YTD-WATCH-NEXT-SECONDARY-RESULTS-RENDERER" ||
      tag === "YTD-WATCH-NEXT-COMPACT-LIST-RENDERER" ||
      tag === "YTD-WATCH-NEXT-MIX-RENDERER"
    ) {
      push(el);
    }
    if (el.shadowRoot) {
      el.shadowRoot.querySelectorAll("*").forEach((n) => walk(n as Element));
    }
    Array.from(el.children).forEach((c) => walk(c as Element));
  }
  walk(document.documentElement);
  return out;
}

function syncWatchPagePolling(): void {
  if (watchPollId !== null) {
    clearInterval(watchPollId);
    watchPollId = null;
  }
  if (keywordsLower.length === 0 || !_settings.watch) {
    return;
  }
  if (currentPage() !== "watch") {
    return;
  }
  watchPollId = setInterval(() => {
    scheduleScan();
  }, 2000);
}

/** `closest()` stops at shadow roots; titles in lockup shadow trees need composed-parent walk. */
function closestInComposedTree(el: HTMLElement, selector: string): HTMLElement | null {
  let node: Element | null = el;
  for (let depth = 0; depth < 120 && node; depth++) {
    try {
      if (node.matches(selector)) {
        return node as HTMLElement;
      }
    } catch {
      return null;
    }
    if (node.parentElement) {
      node = node.parentElement;
    } else {
      const r = node.getRootNode();
      if (r instanceof ShadowRoot) {
        node = r.host;
      } else {
        break;
      }
    }
  }
  return null;
}

/** Nearest block host for overlays / removal (avoid brittle .style-scope classes). */
function resolveTileRoot(titleEl: HTMLElement): HTMLElement | null {
  if (isShortsViewportExperience()) {
    const reel = titleEl.closest("ytd-reel-video-renderer");
    if (reel) {
      return reel as HTMLElement;
    }
    const reelItem = titleEl.closest("ytd-reel-item-renderer");
    if (reelItem) {
      return reelItem as HTMLElement;
    }
  }
  /* Watch (and similar) Shorts shelf: ytm lockup + attributed-string titles in shadow DOM */
  const shortsLockup =
    closestInComposedTree(titleEl, "ytm-shorts-lockup-view-model") ??
    closestInComposedTree(titleEl, "ytm-shorts-lockup-view-model-v2");
  if (shortsLockup) {
    return shortsLockup;
  }
  const rootSelectors = [
    "yt-lockup-view-model",
    ".yt-lockup-view-model",
    ".ytLockupViewModelWrapper",
    "ytd-item-section-renderer.lockup",
    "ytd-item-section-renderer.ytLockupViewModelWrapper",
    "ytd-item-section-renderer",
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
  for (const sel of rootSelectors) {
    try {
      const host = titleEl.closest(sel);
      if (host) {
        return host as HTMLElement;
      }
    } catch {
      /* invalid selector */
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

/** Home / subscriptions / channel grids: lockups, standard tiles, and Shorts use the same host tags. */
const FEED_TILE_HOST_SELECTORS: readonly string[] = [
  "ytm-shorts-lockup-view-model-v2.shortsLockupViewModelHost",
  "ytm-shorts-lockup-view-model-v2",
  "ytm-shorts-lockup-view-model",
  "yt-lockup-view-model",
  ".yt-lockup-view-model",
  ".ytLockupViewModelWrapper",
  "ytd-item-section-renderer.lockup",
  "ytd-item-section-renderer.ytLockupViewModelWrapper",
  "ytd-grid-video-renderer",
  "ytd-rich-item-renderer",
  "ytd-video-renderer",
  "ytd-compact-video-renderer",
  "ytd-compact-playlist-renderer",
  "ytd-playlist-panel-video-renderer",
  "ytd-reel-item-renderer",
  "ytd-reel-video-renderer",
];

function scanDeepTileHosts(hostSelectors: readonly string[]): void {
  const seen = new WeakSet<Element>();
  for (const sel of hostSelectors) {
    for (const host of queryDeepWithin(sel, document.documentElement)) {
      if (seen.has(host)) {
        continue;
      }
      seen.add(host);
      const titleEl = findVideoTitleIn(host);
      if (!titleEl) {
        continue;
      }
      const text = tileText(titleEl);
      if (doesMatchKeyWords(text)) {
        performActionOnMatch(titleEl, host);
      }
    }
  }
}

function scanHomeOrSubscriptions(): void {
  scanDeepTileHosts(FEED_TILE_HOST_SELECTORS);
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
      performActionOnMatch(titleEl, host);
    }
  };
  document.querySelectorAll("ytd-video-renderer, ytd-compact-video-renderer").forEach(runHost);
  document.querySelectorAll("ytd-reel-item-renderer").forEach(runHost);
  document.querySelectorAll("ytd-rich-item-renderer").forEach(runHost);
}

/**
 * Channel Videos tab is mostly light-DOM grids; Featured (and redesign shelves) often sit under
 * shadow roots and use lockup / ytm Shorts hosts — same patterns as home/watch tiles.
 */
function scanChannel(): void {
  scanDeepTileHosts(FEED_TILE_HOST_SELECTORS);
}

function scanShorts(): void {
  scanDeepTileHosts(["ytd-reel-video-renderer", "ytd-reel-item-renderer"]);
}

/**
 * Watch page: sidebar recommendations + primary-column Shorts shelf (ytm-shorts-lockup-view-model*).
 * Only the ytm Shorts selectors are scanned under #primary so we never cover the main player tile.
 */
function scanWatch(): void {
  const watchPrimaryHostSelectors = [
    "ytm-shorts-lockup-view-model-v2.shortsLockupViewModelHost",
    "ytm-shorts-lockup-view-model-v2",
    "ytm-shorts-lockup-view-model",
  ];
  const hostSelectors = [
    ...watchPrimaryHostSelectors,
    "yt-lockup-view-model",
    ".yt-lockup-view-model",
    ".ytLockupViewModelWrapper",
    "ytd-item-section-renderer.lockup",
    "ytd-item-section-renderer.ytLockupViewModelWrapper",
    "ytd-compact-video-renderer",
    "ytd-video-renderer",
    "ytd-compact-playlist-renderer",
    "ytd-playlist-panel-video-renderer",
    "ytd-rich-item-renderer",
  ];
  const seen = new WeakSet<Element>();
  const runHost = (host: HTMLElement, trustSidebarScope: boolean): void => {
    if (seen.has(host)) {
      return;
    }
    if (!trustSidebarScope && !isInWatchSidebar(host)) {
      return;
    }
    seen.add(host);
    const titleEl = findVideoTitleIn(host);
    if (!titleEl) {
      return;
    }
    const text = tileText(titleEl);
    if (doesMatchKeyWords(text)) {
      performActionOnMatch(titleEl, host);
    }
  };

  const roots = deepFindWatchSidebarRoots();
  if (roots.length > 0) {
    for (const root of roots) {
      for (const sel of hostSelectors) {
        for (const host of queryDeepWithin(sel, root)) {
          runHost(host, true);
        }
      }
    }
  }

  const primary =
    document.querySelector("#primary-inner") ?? document.querySelector("#primary");
  if (primary) {
    for (const sel of watchPrimaryHostSelectors) {
      for (const host of queryDeepWithin(sel, primary)) {
        runHost(host, true);
      }
    }
  }

  if (roots.length === 0) {
    for (const sel of hostSelectors) {
      for (const host of queryDeepWithin(sel, document.documentElement)) {
        runHost(host, false);
      }
    }
  }
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
  } else if (page === "shorts") {
    scanShorts();
  } else if (page === "watch" && _settings.watch) {
    scanWatch();
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
  const obs = domObserver;
  obs.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  const app = document.querySelector("ytd-app");
  if (app?.shadowRoot) {
    try {
      obs.observe(app.shadowRoot, {
        childList: true,
        subtree: true,
      });
    } catch {
      /* ignore */
    }
  }
  syncWatchPagePolling();
}

function applyStoragePayload(data: Record<string, unknown>): void {
  const { keywords, settings, blocked, remove } = data;

  if (settings && typeof settings === "object") {
    const s = settings as typeof _settings;
    _settings.title = Boolean(s.title);
    _settings.subscription = Boolean(s.subscription);
    _settings.search = Boolean(s.search);
    _settings.watch = s.watch !== false;
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
  syncWatchPagePolling();
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

/**
 * Vertical Shorts player chrome: youtube.com/shorts/… or a channel tab like /@handle/shorts.
 * Must not match Shorts *shelves* on home/watch (those paths do not end with /shorts).
 */
function isShortsViewportExperience(): boolean {
  const p = window.location.pathname;
  if (p === "/shorts" || p.startsWith("/shorts/")) {
    return true;
  }
  if (
    p.endsWith("/shorts") &&
    (p.includes("/@") || p.startsWith("/channel/") || p.startsWith("/c/") || p.startsWith("/user/"))
  ) {
    return true;
  }
  return false;
}

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
  if (
    path.includes("/@") ||
    path.startsWith("/channel/") ||
    path.startsWith("/c/") ||
    path.startsWith("/user/")
  ) {
    return "channel";
  }
  if (path === "/shorts" || path.startsWith("/shorts/")) {
    return "shorts";
  }
  if (path === "/watch" || path.startsWith("/watch/")) {
    return "watch";
  }
  if (path === "/live" || path.startsWith("/live/")) {
    return "watch";
  }
  return "";
};

/** User chose Reveal — never re-cover this tile until it leaves the DOM (e.g. scroll recycle). */
const REVEALED_ATTR = "data-spoiler-free-revealed";

const COVERED_STATE = "blocked";

/** Ensures inset:0 overlay is clipped to the tile (set before inserting the overlay). */
const TILE_HOST_CLASS = "spoiler-free-block-tile-host";

/** Match YouTube appearance (html[dark], ytd-app) then fall back to OS preference. */
function isYouTubeDarkTheme(): boolean {
  const html = document.documentElement;
  if (html.hasAttribute("dark")) {
    return true;
  }
  const d = html.getAttribute("dark");
  if (d != null && d !== "false") {
    return true;
  }
  const app = document.querySelector("ytd-app");
  if (app?.hasAttribute("dark")) {
    return true;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

type OverlayWithTeardown = HTMLElement & { sfTeardown?: () => void };

/** Union of meaningful boxes so the Shorts cover spans the video, not only a thumbnail strip. */
function mergeShortsOverlayBox(anchor: HTMLElement): { left: number; top: number; width: number; height: number } {
  const boxes: DOMRect[] = [];
  const push = (el: Element): void => {
    const b = el.getBoundingClientRect();
    if (b.width > 2 && b.height > 2) {
      boxes.push(b);
    }
  };
  push(anchor);
  anchor.querySelectorAll("video, ytd-player").forEach(push);
  if (isShortsViewportExperience()) {
    const mainVid = document.querySelector("video.video-stream.html5-main-video");
    if (mainVid) {
      push(mainVid);
    }
  }
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const b of boxes) {
    left = Math.min(left, b.left);
    top = Math.min(top, b.top);
    right = Math.max(right, b.right);
    bottom = Math.max(bottom, b.bottom);
  }
  if (!Number.isFinite(left)) {
    const fb = anchor.getBoundingClientRect();
    return {
      left: Math.round(fb.left),
      top: Math.round(fb.top),
      width: Math.round(fb.width),
      height: Math.round(fb.height),
    };
  }
  left = Math.max(0, left);
  top = Math.max(0, top);
  right = Math.min(window.innerWidth, right);
  bottom = Math.min(window.innerHeight, bottom);
  return {
    left: Math.round(left),
    top: Math.round(top),
    width: Math.round(Math.max(0, right - left)),
    height: Math.round(Math.max(0, bottom - top)),
  };
}

/**
 * Shorts paints title/metadata in layers above slotted nodes. Pin a viewport-fixed cover to the
 * reel's bounding box so the cover sits above YouTube's bottom chrome.
 */
function attachShortsOverlayToViewport(anchor: HTMLElement, overlay: OverlayWithTeardown): void {
  overlay.classList.add("spoiler-free-block-video-overlay-container--shorts-fixed");

  const sync = (): void => {
    if (!anchor.isConnected) {
      overlay.sfTeardown?.();
      return;
    }
    const r = mergeShortsOverlayBox(anchor);
    overlay.style.setProperty("left", `${r.left}px`, "important");
    overlay.style.setProperty("top", `${r.top}px`, "important");
    overlay.style.setProperty("width", `${r.width}px`, "important");
    overlay.style.setProperty("height", `${r.height}px`, "important");
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

const performActionOnMatch = (titleEl: HTMLElement, knownHost: Element | null = null) => {
  const mainElement = resolveTileHostFromTitle(titleEl, knownHost);
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

  if (isShortsViewportExperience()) {
    const shortVideo = document.querySelector<HTMLVideoElement>(
      "video.video-stream.html5-main-video"
    );
    shortVideo?.pause();
  }

  const covered = mainElement.getAttribute("spoiler-free-blured");
  if (covered === COVERED_STATE || covered === "blur") {
    return;
  }

  const matchesFound = getMatchedKeywords(pageText);
  if (matchesFound.length === 0) {
    return;
  }

  const div = document.createElement("div");
  div.className = "spoiler-free-block-video-overlay-container";
  div.dataset.spoilerFreeTheme = isYouTubeDarkTheme() ? "dark" : "light";
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
    mainElement.classList.remove(TILE_HOST_CLASS);
    mainElement.setAttribute(REVEALED_ATTR, "");
  };
  div.appendChild(removeBlurButton);

  mainElement.classList.add(TILE_HOST_CLASS);
  mainElement.setAttribute("spoiler-free-blured", COVERED_STATE);
  if (isShortsViewportExperience()) {
    attachShortsOverlayToViewport(mainElement, div as OverlayWithTeardown);
  } else {
    mainElement.appendChild(div);
  }
  void updateBlockedContentCount();
};

const updateBlockedContentCount = async () => {
  totalBlocked = totalBlocked + 1;
  await chrome.storage.local.set({ blocked: totalBlocked });
};
