# Dashboards

A responsive sample analytics website built with plain HTML, CSS and JavaScript, ready for GitHub Pages.

## Preview locally

Open `index.html` in your browser. No dependencies, installation or build step are required. You can also use a local static file server if you prefer.

## Publish with GitHub Pages

1. Open this repository on GitHub and go to **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch **`main`** and folder **`/ (root)`**, then click **Save**.
4. After GitHub finishes publishing, your site should be available at **https://ricardogv2.github.io/dashboards/**. Check the Pages settings for the confirmed URL and deployment status.

The site uses relative asset URLs (`./styles.css` and `./script.js`), so it works from the `/dashboards/` project path.

## Customize it

- **`index.html`** — page layout, copy and sections.
- **`styles.css`** — colors (edit the `:root` variables), layout and responsive styles.
- **`script.js`** — demo data in `DEMO` and `ACTIVITIES`, navigation, chart rendering, theme and CSV export.

Everything displayed is **illustrative sample data**, not real visitor, revenue or conversion analytics. The time range scales example values; it does not fetch date-specific analytics. To show real data, replace the demo objects or adapt the rendering code to fetch from your own API. GitHub Pages hosts static content, so any private keys, credentials or sensitive data must stay on a separate, secured backend—not in this public repository.

## Features

- Four sample views: Overview, Audience, Revenue and Performance.
- Responsive cards, a trend chart and breakdown bars.
- 7-, 30- and 90-day example ranges.
- Recent-activity search and per-view CSV export.
- Dark-mode toggle, remembered locally when browser storage is available.

No framework, dependency or tracking script is included.
