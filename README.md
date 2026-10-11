# WattFigures

**[wattfigures.com](https://wattfigures.com)** — home energy costs made concrete. Instead of generic saving tips,
it answers specific questions with numbers: *how much does my dryer cost per year? Does a heat pump pay off
against a gas boiler? When do solar panels pay for themselves?*

Bilingual: English at the root, Spanish mirror under `/es/`.

## What's inside

| Section | What it offers |
|---|---|
| **Calculators** | Interactive tools: electricity cost, EV home charging, solar payback, heat pump vs gas boiler, air conditioning, laundry, standby power, LED vs halogen. |
| **Appliance pages** | 30+ "How much does a X cost to run" pages (dishwasher, desktop PC, dehumidifier, coffee machine…), each with power, typical use, yearly cost and its own mini calculator. |
| **Electricity prices** | Price pages by country and by US state. |
| **Guides** | Editorial guides that link to the calculators and appliance pages. |

## How it works

### Data-driven pages
The appliance pages, price tables and calculator scenarios are not written by hand. They are generated
from JSON datasets (`data/*.json`) and HTML templates (`templates/`) by Node.js scripts in `tools/`.
Adding an appliance means adding one entry to the dataset and running the build.

### Static and secure
Plain HTML styled with **Tailwind CSS**, with a strict Content Security Policy: no inline JavaScript.
The calculators run entirely in the browser. **Pagefind** provides client-side search, and the build also
generates the RSS feed, sitemap and Open Graph images.

### Automated guide publishing (n8n + Telegram + AI)
An **n8n** workflow publishes a new guide every 2 days, with a human in the loop:
1. **Idea** — picks the next topic from a prioritised queue and sends it to a **Telegram** group with
   ✅ / 👎 buttons.
2. **Writing** — once approved, an LLM (Gemini) drafts the guide in English and Spanish as structured JSON.
   Code validates it (length, allowed HTML tags, FAQ, slug) and adds related links to two guides and two
   calculators stored in **Supabase**.
3. **Publishing** — fills the HTML templates, commits the pages and index cards through the GitHub API,
   records them in Supabase and confirms in Telegram.

### Continuous build and tests
A **GitHub Actions** workflow rebuilds the generated files after each publication, so new guides show up in
search, feeds and the sitemap right away. Unit tests run with Node's built-in test runner.

## Tech stack

`HTML` · `Tailwind CSS` · `Node.js` · `Pagefind` · `n8n` · `Gemini` · `Telegram Bot API` · `Supabase` ·
`GitHub Actions` · `Google Search Console`

## Run locally

```bash
npm install
npm run build
npm test
```
Then serve the folder with any static server (e.g. `npx serve .`).

## Credits

Built by Oscar Sierra together with Daniel Asensio.
