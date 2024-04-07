'use strict';

type ThemeSetting = 'dark' | 'light';

const themeToggle: HTMLElement = document.getElementById("theme-toggle")!;
const bodyElement: HTMLElement = document.body;
const form: HTMLElement = document.getElementById("add-keyword-form");
const input: HTMLInputElement = document.getElementById("keyword-input") as HTMLInputElement;
const closeList: HTMLButtonElement = document.getElementById("close-keyword-list") as HTMLButtonElement;
const keywordListPage: HTMLElement = document.getElementById("edit-keywords-list");
const openList: HTMLButtonElement = document.getElementById("open-keywords-list") as HTMLButtonElement;
const keywordList: HTMLElement = document.getElementById("keyword-list");
const settingToggles: HTMLCollectionOf<HTMLInputElement> = document.getElementsByClassName("settings-toggle") as HTMLCollectionOf<HTMLInputElement>;
const totalKeywords: HTMLElement = document.getElementById("total-keywords-added");
const totalBlockedCount: HTMLElement = document.getElementById("total-blocked-videos");

let localKeywords: string[] = [];
let localSettings = {
    title: true,
    subscription: true,
    search: true,
    shorts: true,
    channel: true,
};

chrome.storage.local.get().then(({ mode, keywords, settings, blocked }) => {
    if (mode === 'dark') {
        bodyElement.classList.add("dark-theme");
        themeToggle.setAttribute("checked", "checked");
    }
    if (keywords) {
        localKeywords = keywords;
        localKeywords.forEach(keyword => {
            createKeywordListItem(keyword);
        });
    }
    totalKeywords.innerText = formatCount(localKeywords.length);
    if (settings) {
        localSettings.title = settings.title;
        localSettings.subscription = settings.subscription;
        localSettings.search = settings.search;
        localSettings.shorts = settings.shorts;
        localSettings.channel = settings.channel;
    }
    for (const key in settingToggles) {
        if (Object.prototype.hasOwnProperty.call(settingToggles, key)) {
            const element = settingToggles[key];
            element.checked = localSettings[element.value];
            element.onchange = async function () {
                localSettings[element.value] = element.checked;
                await chrome.storage.local.set({ settings: localSettings });
            }
        }
    }
    if (blocked) {
        totalBlockedCount.innerText = formatCount(blocked);
    }
});

openList.addEventListener("click", function () {
    keywordListPage.classList.add("is-open");
})

closeList.addEventListener("click", function () {
    keywordListPage.classList.remove("is-open");
})

themeToggle.addEventListener("change", async function () {
    bodyElement.classList.toggle("dark-theme");
    const isDark: ThemeSetting = (await chrome.storage.local.get("mode")).mode;
    await chrome.storage.local.set({
        "mode": isDark === 'dark' ? "light" : "dark"
    });
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
    await chrome.storage.local.set({ keywords: newKeywords });
    createKeywordListItem(keyword);
});


const createKeywordListItem = (keyword: string) => {
    const listItem = document.createElement("li");

    const label = document.createElement('span');
    label.className = "keyword-label";
    label.innerText = keyword;

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-keyword";
    deleteButton.value = keyword;
    deleteButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
            <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z" />
        </svg>`;
    deleteButton.onclick = async function (e) {
        listItem.remove();
        const newKeywords = localKeywords.filter((v, i) => {
            return v !== keyword;
        });
        localKeywords = newKeywords;
        await chrome.storage.local.set({ keywords: newKeywords });
    }

    listItem.appendChild(label);
    listItem.appendChild(deleteButton);
    keywordList.appendChild(listItem);
}

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
}