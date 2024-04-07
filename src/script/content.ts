'use strict';

let keywordRegex: RegExp;
let _settings = {
    title: true,
    subscription: true,
    search: true,
    shorts: true,
    channel: true,
};

function createRegexFromWords(words: string[]) {
    // Escape special characters in each word and join them with '|' to create a regex pattern
    const regexPattern = '\\b' + words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\b|\\b') + '\\b';
    // Create a RegExp object with the constructed pattern and 'i' flag for case-insensitive matching
    return new RegExp(regexPattern, 'i');
}


chrome.storage.local.get().then(({ keywords, settings }) => {
    if (settings) {
        _settings.title = settings.title;
        _settings.subscription = settings.subscription;
        _settings.search = settings.search;
        _settings.shorts = settings.shorts;
        _settings.channel = settings.channel;
    }
    if (keywords && keywords.length) {
        keywordRegex = createRegexFromWords(keywords);
        const page = currentPage();
        if (
            (page === "title" && _settings.title) ||
            (page === "subscription" && _settings.subscription) ||
            (page === "search" && _settings.search) ||
            (page === "shorts" && _settings.shorts) ||
            (page === "channel" && _settings.channel)
        ) {
            initFunctions();
        }
    }
    console.log(keywords, keywordRegex);
});

const initFunctions = () => {
    const mutationObserver = (mutation, observer) => {
        requestAnimationFrame(() => {
            if (_settings.title) {
                let newTitles = false;
                for (let i = 0; i < mutation.length; i++) {
                    if ('video-title' == mutation[i].target.id && 'style-scope ytd-rich-grid-media' == mutation[i].target.className) {
                        newTitles = true;
                        console.log("newTitles");
                        break;
                    }
                }
                if (newTitles) {
                    document.querySelectorAll("yt-formatted-string.style-scope.ytd-rich-grid-media#video-title").forEach((element: HTMLElement) => {
                        const title = element.innerText;
                        if (doesMatchKeyWords(title)) {
                            console.log(title);
                            element.closest("ytd-rich-item-renderer.style-scope").remove();
                            // Update session list for removed videos (may be)
                        }
                    });
                }
            }
        });
    }

    const domLayoutObserver = new MutationObserver(mutationObserver);
    domLayoutObserver.observe(document.body, {
        childList: true,
        subtree: true
    });

}

const currentPage = (): string => {
    const currentPath: string = window.location.pathname;
    console.log(currentPath);
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
}

const doesMatchKeyWords = (string) => {
    return keywordRegex.test(string);
};
