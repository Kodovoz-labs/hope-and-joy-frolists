# Hope & Joy Florists

A cinematic single-page floral storefront for Hope & Joy Florists, based in Maasai Mall, Ongata Rongai, Kenya. The site combines a story-driven landing experience with a modern e-commerce style product showcase and direct WhatsApp ordering links.

## Overview

This repository contains a static marketing website for a florist business. It is designed to feel premium and editorial, using layered animations, scroll-driven storytelling, and a warm floral palette to present bouquets, gifts, and event styling services.

## Features

- Scroll-based immersive landing page
- Animated 3D floral visuals with Three.js
- Product and occasion showcase sections
- WhatsApp order links for direct customer inquiries
- Delivery and location information
- Contact/social links for Instagram, Facebook, and TikTok
- Fully static HTML/CSS/JS implementation

## Project structure

```text
.
├── index.html          # Main storefront page and embedded CSS/JS
├── LICENSE             # MIT License
└── README.md           # Project documentation
```

## Local development

Because this project is a static website, you can run it with any simple local web server.

### Option 1: Open directly

- Open `Index.html` in a browser.

### Option 2: Serve locally

From the repository root:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## Deployment

This project is suitable for static hosting providers such as:

- GitHub Pages
- Netlify
- Vercel
- any basic web server or CDN

Since the site is plain HTML, there is no build step or dependency installation required.

## Customization

Key values you may want to update:

- Store name and branding text
- WhatsApp phone number and order links
- Business address and hours
- Social media URLs
- Floral colors and section copy

Most of these are embedded directly inside `Index.html` in the HTML and script sections.

## Notes

- The page relies on external CDNs for Google Fonts and Three.js.
- WebGL should be enabled in the browser for the animated floral background to render properly.
- The site is designed primarily for desktop and mobile browsing with responsive behaviour built in.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for the full text.

## Contact

For business inquiries or updates to the storefront, use the WhatsApp contact listed on the page or edit the links in `Index.html`.
