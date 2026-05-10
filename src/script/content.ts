"use strict";

let keywordRegex: RegExp | undefined;
const _settings = {
  title: true,
  subscription: true,
  search: true,
  shorts: true,
  channel: true,
};
let totalBlocked: number = 0;
let isBlur: boolean = true;

function createRegexFromWords(words: string[]) {
  // Escape special characters in each word and join them with '|' to create a regex pattern
  const regexPattern =
    "\\b" +
    words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\b|\\b") +
    "\\b";
  // Create a RegExp object with the constructed pattern and 'i' flag for case-insensitive matching
  return new RegExp(regexPattern, "i");
}

chrome.storage.local.get().then(({ keywords, settings, blocked, remove }) => {
  if (settings) {
    _settings.title = settings.title;
    _settings.subscription = settings.subscription;
    _settings.search = settings.search;
    _settings.shorts = settings.shorts;
    _settings.channel = settings.channel;
  }
  if (keywords && keywords.length) {
    keywordRegex = createRegexFromWords(keywords);
    initFunctions();
  }
  if (blocked) {
    totalBlocked = blocked;
  }
  if (remove) {
    isBlur = false;
  }
});

const initFunctions = () => {
  const mutationObserver = (mutation: MutationRecord[], _observer: MutationObserver) => {
    const page = currentPage();
    requestAnimationFrame(() => {
      if (page === "title" && _settings.title) {
        runRemoveFunc(
          mutation,
          "yt-formatted-string",
          "video-title",
          "style-scope ytd-rich-grid-media",
          [
            "yt-formatted-string.style-scope.ytd-rich-grid-media#video-title",
            "#video-title.style-scope.ytd-rich-grid-slim-media",
          ],
          ["ytd-rich-item-renderer.style-scope", "ytd-rich-item-renderer.style-scope"]
        );
      } else if (page === "subscription" && _settings.subscription) {
        runRemoveFunc(
          mutation,
          "yt-formatted-string",
          "video-title",
          "style-scope ytd-rich-grid-media",
          [
            "yt-formatted-string.style-scope.ytd-rich-grid-media#video-title",
            "#video-title.style-scope.ytd-rich-grid-slim-media",
          ],
          ["ytd-rich-item-renderer.style-scope", "ytd-rich-item-renderer.style-scope"]
        );
      } else if (page === "search" && _settings.search) {
        runRemoveFunc(
          mutation,
          "yt-formatted-string",
          "",
          "style-scope ytd-video-renderer",
          [
            "yt-formatted-string.style-scope.ytd-video-renderer",
            "#video-title.style-scope.ytd-reel-item-renderer",
          ],
          [
            ".style-scope.ytd-item-section-renderer",
            "ytd-reel-item-renderer.style-scope.yt-horizontal-list-renderer",
          ]
        );
      } else if (page === "channel" && _settings.channel) {
        runSubscriptionPageFunc();
      } else if (page === "shorts" && _settings.shorts) {
        runShortRemoveFunc();
      }
    });
  };

  const domLayoutObserver = new MutationObserver(mutationObserver);
  domLayoutObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
};
// Not Optimized
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

const runRemoveFunc = (
  mutation: MutationRecord[],
  tagname: string,
  id: string,
  className: string,
  querySelecter: string[],
  elementToDeleteSelector: string[]
) => {
  let newTitles = false;
  for (let i = 0; i < mutation.length; i++) {
    const target = mutation[i].target;
    if (!(target instanceof HTMLElement)) {
      continue;
    }
    if (
      id === target.id &&
      className === target.className &&
      tagname === target.tagName.toLowerCase()
    ) {
      newTitles = true;
      break;
    }
  }
  if (newTitles) {
    for (let i = 0; i < querySelecter.length; i++) {
      const deleteSelector = elementToDeleteSelector[i];
      if (deleteSelector === undefined) continue;
      document.querySelectorAll(querySelecter[i]).forEach((el) => {
        const element = el as HTMLElement;
        if (doesMatchKeyWords(element.innerText)) {
          performActionOnMatch(element, deleteSelector);
        }
      });
    }
  }
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
    updateBlockedContentCount();
  }
  const page = currentPage();
  if (page === "shorts" && _settings.shorts) {
    const shortVideo = document.querySelector<HTMLVideoElement>(
      "video.video-stream.html5-main-video[controlslist='nodownload']"
    );
    shortVideo?.pause();
  }
  if (mainElement.getAttribute("spoiler-free-blured") == "blur") {
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
  updateBlockedContentCount();
  // Update session list for removed videos (may be)
};

const updateBlockedContentCount = async () => {
  totalBlocked = totalBlocked + 1;
  await chrome.storage.local.set({ blocked: totalBlocked });
};
