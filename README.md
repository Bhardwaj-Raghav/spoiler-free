### Spoiler Free Google Chrome Extension

---

#### Description:

The "Spoiler Free" Google Chrome Extension is designed to enhance your browsing experience on YouTube by blocking videos and shorts that may contain spoilers. Whether you're trying to avoid plot reveals, sports match outcomes, or any other type of spoiler content, this extension has you covered. Say goodbye to accidental reveals and enjoy a spoiler-free YouTube journey.

---

#### Development

- **Requirements:** [Node.js](https://nodejs.org/) 20+ and npm.
- **Install:** `npm install`
- **Build:** `npm run build` compiles TypeScript + Sass into **`assets/`** at the project root, then copies **`manifest.json`**, **`index.html`**, and the full **`assets/`** tree into **`extension/`** (same layout Chrome expects when you zip for the store). Generated files are not committed — always build after clone.
- **Dist / zip:** `npm run dist` runs the same as **`npm run build`**. Zip **`extension/`** for upload. That folder is **gitignored** on purpose.
- **Develop** (recommended): `npm run dev` — watches TS/Sass/HTML/manifest and keeps **`extension/`** in sync, plus serves [http://localhost:5173](http://localhost:5173) for popup preview. Reload the extension in Chrome after changes.
- **Watch only** (no local server): `npm run watch`
- **`npm run preview`** is the same as **`npm run dev`** (alias).
- **Load the extension:** Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → choose the **`extension`** folder inside this repo (after `npm run build`), so manifest, popup, and compiled CSS/JS stay aligned. You can also load the repo root if `manifest.json` and `assets/` are present there — both work after a build.
- **Lint / format:** `npm run lint`, `npm run format`

---

#### Features:

- **Spoiler Blocking:** Automatically blocks videos and shorts on YouTube that may contain spoilers based on customizable keywords.
- **Customizable Settings:** Tailor the extension to your preferences by adding specific keywords that you want to block.
- **Content Management:** Choose to either remove the video entirely or blur it with keywords that indicate why it was blurred. You can click the reveal button to view the video if you choose to.
- **User-Friendly Interface:** Intuitive design makes it easy to manage your spoiler settings and browse YouTube without worry.

---

#### How to Use:

1. **Install Extension:** Add the "Spoiler Free" extension to your Google Chrome browser from the Chrome Web Store.
2. **Access Settings:** Click on the extension icon in the browser toolbar to access the settings menu.
3. **Add Keywords:** Enter keywords related to spoilers that you want the extension to block.
4. **Manage Spoilers:** Choose between removing the video or blurring it with explanations for why it was blocked. Use the reveal button to view the video.
5. **Enjoy Spoiler-Free Browsing:** Start exploring YouTube without the fear of stumbling upon unwanted spoilers.

---

#### Compatibility:

- This extension is compatible with Google Chrome browsers on desktop platforms.

---

#### Feedback and Support:

We are constantly working to improve the "Spoiler Free" extension. If you have any feedback, suggestions, or encounter any issues or For code contributions and feedback, visit my GitHub repository: [GitHub - Bhardwaj-Raghav/spoiler-free](https://github.com/Bhardwaj-Raghav/spoiler-free/)

---

#### About Us:

The "Spoiler Free" extension is developed by Raghav Bhardwaj. It started as a personal project during the hype for God of War Ragnarok and updated to cover various games, movies, and TV shows that were famous at the time. I used this extension personally for two years, refining it based on my own needs and feedback. After two years of personal use, I decided to release it for public use.

My goal is to make browsing the web more enjoyable and stress-free for everyone.

---

#### Disclaimer:

This extension is provided as-is and does not guarantee 100% effectiveness in blocking spoiler content. Users are encouraged to actively manage their settings and exercise caution while browsing YouTube to avoid spoilers.

---

#### Privacy Policy:

Your privacy is important to us. This extension do not collect any personal information through the "Spoiler Free" extension.

---

#### Spread the Word:

Help others enjoy spoiler-free browsing on YouTube! Share this extension with your friends and fellow internet users.

---

Thank you for choosing the "Spoiler Free" Google Chrome Extension. Happy browsing! 🚫🎥
