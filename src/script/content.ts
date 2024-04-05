'use strict';


// function createRegexFromWords(words) {
//     // Escape special characters in each word and join them with '|' to create a regex pattern
//     const regexPattern = words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
//     // Create a RegExp object with the constructed pattern and 'i' flag for case-insensitive matching
//     return new RegExp(regexPattern, 'i');
// }


chrome.storage.local.get().then((test) => {
    console.log({ test });

});

const doesMatchKeyWords = (string) => {
    return /(Spider man)|(Spiderman)|(Spider-man)|(Spider-man 2)|(Spiderman 2)|(Peter)|(Parker)|(Miles)|(morales)|(leak)|(venom)/gi.test(
        string
    );
};



const mutationObserver = (mutation, observer) => {

    document.querySelectorAll("yt-formatted-string.style-scope.ytd-rich-grid-media").forEach((element) => {

        // console.log("Test", element);

    })


    setTimeout(() => {
        observer.disconnect();
    }, 5000);
}

const domLayoutObserver = new MutationObserver(mutationObserver);
domLayoutObserver.observe(document.body, {
    childList: true,
    subtree: true
});
