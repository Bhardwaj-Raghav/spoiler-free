'use strict';

let keywordRegex: RegExp;
let _settings = {
    title: true,
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
    if (keywords.keywords) {
        keywordRegex = createRegexFromWords(keywords.keywords);
        initFunctions();
    }
    if (settings) {
        _settings.title = settings.title;
        _settings.search = settings.search;
        _settings.shorts = settings.shorts;
        _settings.channel = settings.channel;
    }
    console.log(keywords, keywordRegex);

});

const initFunctions = () => {


    const mutationObserver = (mutation, observer) => {
        requestAnimationFrame(() => {
            if (_settings.title) {
                document.querySelectorAll("yt-formatted-string.style-scope.ytd-rich-grid-media#video-title").forEach((element: HTMLElement) => {
                    const title = element.innerText;
                    if (doesMatchKeyWords(title)) {
                        console.log(title);
                        element.closest("ytd-rich-item-renderer.style-scope").remove();
                        // Update session list for removed videos (may be)
                    }

                });
            }
        });
    }
    const domLayoutObserver = new MutationObserver(mutationObserver);
    domLayoutObserver.observe(document.body, {
        childList: true,
        subtree: true
    });

}

const doesMatchKeyWords = (string) => {
    return keywordRegex.test(string);
};
