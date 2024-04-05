
chrome.runtime.onStartup.addListener(
    function () {

        chrome.tabs.create({ url: "https://google.ca" });
        setInterval(() => {
            console.log("This is Test 1");

        }, 1000)
    },
);
