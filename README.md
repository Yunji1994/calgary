# Calgary Local Exploration Guide

A static, data-driven Calgary guide intended for GitHub Pages.

## Current stage

This first scaffold includes:

- A responsive guide layout
- Leaflet map with OpenStreetMap tiles
- Attraction data in `data/places.json`
- Hub filtering and text search
- Attraction cards with personal notes
- Tourism Calgary links
- Add/remove itinerary selections in the browser
- Persistent itinerary storage with `localStorage`
- Up/down stop reordering
- Shareable itinerary URLs
- Google Maps route export with walking, driving, and bicycling modes
- Automatic route splitting for longer itineraries
- Responsive itinerary drawer
- Plus 15 Skywalk Network overlay from City of Calgary open data
- Plus 15 local GeoJSON fallback in `data/plus15.geojson`

Photo galleries and R2 integration are planned next.

## Run locally

Because the app loads JSON with `fetch`, serve the project through a local web server rather than opening `index.html` directly.

With Python:

```bash
python -m http.server 8000
```

Then visit <http://localhost:8000>.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository.
2. In **Settings → Pages**, select **Deploy from a branch**.
3. Select the main branch and `/ (root)`.
4. Open the generated Pages URL.

## Content model

Add or edit attractions in `data/places.json`. Each place currently has:

- `id`
- `name`
- `hub`
- `description`
- `personalNote`
- `latitude` and `longitude`
- `address`
- `bestTime`
- `duration`
- `tourismCalgaryUrl`

Keep IDs stable: itinerary URLs and saved selections depend on them.

## Map attribution

This scaffold uses OpenStreetMap tiles. Review the OpenStreetMap tile usage policy before deploying a high-traffic public site. For a larger audience, switch the tile layer to a dedicated provider such as MapTiler or Stadia Maps and add the required API key and attribution.

The Plus 15 data comes from the City of Calgary's public `Downtown Plus 15 Network` ArcGIS Feature Service. The app requests its current GeoJSON representation at load time, then falls back to the checked-in snapshot if the live service is unavailable. The City describes this as a public view layer updated nightly on an as-needed basis. The browser uses GeoJSON rather than raw shapefile files because Leaflet can render GeoJSON directly.
