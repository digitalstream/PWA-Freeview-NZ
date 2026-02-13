# NZ Freeview PWA

A private Progressive Web App (PWA) for browsing New Zealand Freeview channels and TV listings.

This is an intentionally lightweight PWA.

> **Note:** This repository is **private** and intended for personal use only.

## Features

- **TV Guide:** Browse upcoming programs for major NZ channels (TVNZ 1, TVNZ 2, Three, Prime, Whakaata Maori, etc.).
- **Live Streaming:** Direct access to official channel streams (where supported).
- **PWA Capabilities:**
  - Installable on Mobile (iOS/Android) and Desktop.
  - Offline fallback support.
  - Fast loading and touch-optimized interface.

## Tech Stack

- **Framework:** [React / Vue / Svelte]
- **Build Tool:** [Vite / Webpack]
- **Styling:** [Tailwind CSS / CSS]
- **Deployment:** [Vercel / Netlify / GitHub Pages]

## Getting Started

### Prerequisites

- Node.js (Latest LTS recommended)
- npm or yarn

### Installation

1. Clone the repository:

   git clone https://github.com/digitalstream/PWA-Freeview-NZ.git
   cd PWA-NZ-Freeview

2. Install dependencies:

   npm install

3. Run the local development server:

   npm run dev

### Building for Production

To create the production build (generating the dist or build folder):

    npm run build

## How to Install (PWA)

- **Desktop (Chrome/Edge):** Click the "Install" icon on the right side of the address bar.
- **iOS (iPhone/iPad):** Open in Safari -> Tap the "Share" button -> Select "Add to Home Screen".
- **Android:** Open in Chrome -> Tap the three-dot menu -> Select "Install App".

## Roadmap

- [ ] Add Search functionality for specific shows.
- [ ] Implement "Favorites" channel list.
- [ ] Dark Mode toggle.

## Disclaimer

This project is for educational and personal private use only. All channel logos, EPG data, and stream content remain the property of their respective broadcasters (TVNZ, Warner Bros. Discovery NZ, etc.).
