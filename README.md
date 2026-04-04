# MikroTik Network Configurator

A web application for intelligently building MikroTik networks. Browse routers and switches, check hardware compatibility, design network topologies, and estimate costs — all with 100% hardware compatibility validation.

## Features

- **Product Catalog** — Browse 25+ MikroTik routers and switches with detailed specs, filtering by category, port types, PoE support, and price range
- **Compatibility Engine** — Validates physical port compatibility (SFP/SFP+/SFP28/QSFP+/QSFP28/Ethernet), PoE standard matching, and throughput calculations
- **Network Builder** — Visual drag-and-drop topology designer with real-time validation
- **Pricing Summary** — Total cost breakdown with CSV export for bill of materials
- **Data Scraper** — Python scraper for refreshing product data from mikrotik.com

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173/mikrotik-configurator/ in your browser.

## Build for Production

```bash
npm run build
npm run preview
```

## Deployment

The app deploys automatically to GitHub Pages on push to `main` via the included GitHub Actions workflow. Visit the deployed site at:

https://jstephenperry.github.io/mikrotik-configurator

## Refreshing Product Data

The product data lives in `public/data/products.json`. To refresh it from mikrotik.com:

```bash
cd scraper
pip install -r requirements.txt
python scrape_mikrotik.py --output ../public/data/products.json
# Use --use-selenium if the site blocks requests
```

## Project Structure

```
├── .github/workflows/deploy.yml  # GitHub Pages deployment
├── public/data/
│   ├── products.json              # MikroTik product database (25 products)
│   └── compatibility.json         # Port & PoE compatibility reference
├── scraper/
│   ├── scrape_mikrotik.py         # Python product scraper
│   └── requirements.txt
├── src/
│   ├── components/                # React components
│   ├── hooks/useProducts.js       # Product data loader
│   ├── utils/compatibility.js     # Compatibility engine
│   ├── pages/                     # Route pages
│   ├── App.jsx                    # Root component
│   └── main.jsx                   # Entry point (HashRouter)
├── vite.config.js                 # Vite config with GitHub Pages base
└── package.json
```

## Tech Stack

- **React 19** + **Vite 8** — Fast build, modern React
- **react-router-dom** — HashRouter for GitHub Pages compatibility
- **lucide-react** — Icon library
- **Python** (scraper) — requests, BeautifulSoup4, Selenium fallback

## Disclaimer

Yes, this application is 100% vibe-coded. No, I do not care what your opinion is on vibe coding or your opinions on the utilization of AI in software development. I'm a software engineering professional that has other hobbies and interests outside of programming all the time. Use this tool if you think you might find any kind of value from it, or don't. I'm not trying to create something revolutionary here, but rather something functional.
