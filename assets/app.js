const STORAGE_KEY = "calgary-itinerary";

const state = {
  places: [],
  selectedIds: [],
  markers: new Map(),
  map: null,
  markerLayer: null,
  plus15Layer: null,
  adventure: null
};

const hubNames = {
  downtown: "The Business Powerhouse: Downtown Core",
  beltline: "Patio City: Beltline",
  "east-village-inglewood": "Confluence of Past and Present: East Village and Inglewood",
  "eau-claire-river": "The Urban Oasis: Eau Claire and the River Walk",
  "heritage-park-glenmore": "Living History: Heritage Park and Glenmore Reservoir",
  "parks-in-the-city": "Preserved Wilderness: Parks in the City",
  "other-attractions": "Other Things to Do and Attractions"
};

const hubDescriptions = {
  downtown: "Calgary's bustling commercial heart, featuring soaring skyscrapers, historic Stephen Avenue pedestrian walk, the extensive underground and above-ground Plus 15 skywalk network, and iconic landmarks like the Calgary Tower.",
  beltline: "A vibrant, walkable urban neighbourhood just south of downtown known for its lively restaurant and patio culture, trendy coffee shops, craft breweries, and eclectic nightlife.",
  "east-village-inglewood": "Where Calgary's oldest historic neighbourhood meets futuristic urban design. Explore indie boutiques, antique shops, craft makers, the striking Central Library, and Studio Bell along the river.",
  "eau-claire-river": "A scenic natural corridor along the Bow River featuring Prince's Island Park, the architectural masterpiece Peace Bridge, and miles of picturesque pathways ideal for walking and cycling.",
  "heritage-park-glenmore": "Step back in time at Western Canada's largest living history museum, surrounded by the scenic waters and recreational trails of the Glenmore Reservoir.",
  "parks-in-the-city": "Expansive natural parks, river valleys, and serene green spaces offering a tranquil escape into nature right within the city limits.",
  "other-attractions": "A collection of unique cultural destinations, museums, and notable attractions scattered across Calgary."
};

const elements = {
  hubFilter: document.querySelector("#hub-filter"),
  typeFilter: document.querySelector("#type-filter"),
  search: document.querySelector("#search"),
  placeList: document.querySelector("#place-list"),
  resultsHeading: document.querySelector("#results-heading"),
  hubDescription: document.querySelector("#hub-description"),
  resultsCount: document.querySelector("#results-count"),
  itineraryCount: document.querySelector("#itinerary-count"),
  itineraryPanel: document.querySelector("#itinerary-panel"),
  itineraryList: document.querySelector("#itinerary-list"),
  overlay: document.querySelector("#overlay"),
  travelMode: document.querySelector("#travel-mode"),
  panelStatus: document.querySelector("#panel-status"),
  exportLinks: document.querySelector("#export-links"),
  plannerPrompt: document.querySelector("#planner-prompt"),
  plannerTimeOptions: document.querySelector("#planner-time-options"),
  plannerPreferenceOptions: document.querySelector("#planner-preference-options"),
  plannerSummary: document.querySelector("#planner-summary"),
  plannerSummaryText: document.querySelector("#planner-summary-text")
};

async function init() {
  const [placesData, foodData] = await Promise.all([
    fetch("data/places.json").then(response => {
      if (!response.ok) throw new Error("Could not load place data");
      return response.json();
    }),
    fetch("data/food.json").then(response => {
      if (!response.ok) throw new Error("Could not load food data");
      return response.json();
    })
  ]);

  state.places = [
    ...placesData.map(p => ({ ...p, type: "attraction" })),
    ...foodData.map(f => ({ ...f, type: "food" }))
  ];

  restoreItinerary();
  state.map = L.map("map").setView([51.045, -114.07], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(state.map);
  state.markerLayer = L.layerGroup().addTo(state.map);
  await loadPlus15Overlay();

  populateHubFilter();
  createMarkers();
  renderPlaces();
  renderItinerary();
  bindEvents();
}

function restoreItinerary() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("itinerary");
  let ids = fromUrl ? fromUrl.split(",") : [];

  if (!fromUrl) {
    try {
      ids = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      ids = [];
    }
  }

  const validIds = new Set(state.places.map(place => place.id));
  state.selectedIds = [...new Set(ids)].filter(id => validIds.has(id));
  persistItinerary();
}

function persistItinerary() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.selectedIds));
}

async function loadPlus15Overlay() {
  const liveUrl = "https://services1.arcgis.com/AVP60cs0Q9PEA8rH/arcgis/rest/services/Downtown_Plus_15_Network/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson";
  let geojson;
  try {
    const response = await fetch(liveUrl);
    if (!response.ok) throw new Error("Live Plus 15 layer unavailable");
    geojson = await response.json();
  } catch (error) {
    console.warn("Using local Plus 15 snapshot", error);
    const response = await fetch("data/plus15.geojson");
    geojson = await response.json();
  }

  state.plus15Layer = L.geoJSON(geojson, {
    style: {
      color: "#b45309",
      weight: 2,
      opacity: 0.9,
      fillColor: "#f59e0b",
      fillOpacity: 0.34
    },
    onEachFeature: (feature, layer) => {
      const properties = feature.properties || {};
      const name = properties.BRIDGE_NAME || "Plus 15 walkway";
      const location = properties.LOCATION || properties.CROSS_LOC || "Downtown Calgary";
      const status = properties.STATUS || "Not specified";
      layer.bindPopup(`<strong>${escapeHtml(name)}</strong><br>${escapeHtml(location)}<br><small>Status: ${escapeHtml(status)}</small>`);
    }
  }).addTo(state.map);
}

function populateHubFilter() {
  const hubs = [...new Set(state.places.map(place => place.hub))];
  hubs.forEach(hub => {
    const option = document.createElement("option");
    option.value = hub;
    option.textContent = hubNames[hub] || hub;
    elements.hubFilter.append(option);
  });
}

function createMarkers() {
  state.places.forEach(place => {
    const isFood = place.type === "food";
    const iconHtml = isFood ? '🍴' : '🏛️';
    const iconClass = isFood ? 'map-pin food' : 'map-pin attraction';

    const customIcon = L.divIcon({
      className: '',
      html: `<div class="${iconClass}" title="${escapeHtml(place.name)}">${iconHtml}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16]
    });

    const marker = L.marker([place.latitude, place.longitude], { icon: customIcon });
    const imageUrl = place.imageUrl || 'https://images.unsplash.com/photo-1508873696983-2df5c92091c7?auto=format&fit=crop&w=800&q=80';
    marker.bindPopup(`
      <div class="popup-card">
        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(place.name)}" class="popup-thumb" loading="lazy">
        <div class="popup-body">
          <strong>${escapeHtml(place.name)}</strong>
          <div class="popup-actions">
            <button class="popup-details" type="button" data-place-id="${place.id}">View details</button>
            <button class="popup-add" type="button" data-place-id="${place.id}">Add to itinerary</button>
          </div>
        </div>
      </div>
    `);
    marker.on("popupopen", () => {
      const detailsButton = document.querySelector(`.popup-details[data-place-id="${place.id}"]`);
      const addButton = document.querySelector(`.popup-add[data-place-id="${place.id}"]`);
      detailsButton?.addEventListener("click", () => showPlaceDetails(place.id));
      addButton?.addEventListener("click", () => addToItinerary(place.id));
    });
    state.markers.set(place.id, marker);
  });
}

function getFilteredPlaces() {
  const hub = elements.hubFilter.value;
  const type = elements.typeFilter ? elements.typeFilter.value : "all";
  const query = elements.search.value.trim().toLowerCase();
  return state.places.filter(place => {
    const matchesHub = hub === "all" || place.hub === hub;
    const matchesType = type === "all" || place.type === type;
    const matchesAdventure = !state.adventure || state.adventure.hubs.includes(place.hub);
    const searchable = [place.name, place.description, ...(place.category || [])].join(" ").toLowerCase();
    return matchesHub && matchesType && matchesAdventure && (!query || searchable.includes(query));
  });
}

function renderPlaces() {
  const places = getFilteredPlaces();
  const selectedHub = elements.hubFilter.value;
  elements.resultsHeading.textContent = state.adventure
    ? `Recommended: ${state.adventure.preferenceLabel}`
    : selectedHub === "all" ? "All places & dining" : hubNames[selectedHub];

  const hubDesc = (!state.adventure && selectedHub !== "all") ? hubDescriptions[selectedHub] : "";
  if (hubDesc && elements.hubDescription) {
    elements.hubDescription.textContent = hubDesc;
    elements.hubDescription.hidden = false;
  } else if (elements.hubDescription) {
    elements.hubDescription.hidden = true;
    elements.hubDescription.textContent = "";
  }

  elements.resultsCount.textContent = `${places.length} place${places.length === 1 ? "" : "s"}`;
  elements.placeList.replaceChildren();
  state.markerLayer.clearLayers();
  places.forEach(place => state.markers.get(place.id).addTo(state.markerLayer));

  if (!places.length) {
    elements.placeList.innerHTML = `<p class="empty-state">No places or dining match your search.</p>`;
    return;
  }
  places.forEach(place => elements.placeList.append(createPlaceCard(place)));
}

function createPlaceCard(place) {
  const card = document.createElement("article");
  const isFood = place.type === "food";
  card.className = isFood ? "place-card food-card" : "place-card";
  card.id = `place-card-${place.id}`;
  const isSelected = state.selectedIds.includes(place.id);
  const imageUrl = place.imageUrl || 'https://images.unsplash.com/photo-1508873696983-2df5c92091c7?auto=format&fit=crop&w=800&q=80';
  const eyebrowHtml = isFood ? `<p class="eyebrow food-eyebrow">🍽️ Dining</p>` : '';
  card.innerHTML = `
    <div class="place-card-image">
      <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(place.name)}" loading="lazy">
    </div>
    <div class="place-card-content">
      ${eyebrowHtml}
      <h3 tabindex="-1">${escapeHtml(place.name)}</h3>
      <p>${escapeHtml(place.description)}</p>
      <p class="personal-note"><strong>Personal note:</strong> ${escapeHtml(place.personalNote)}</p>
      <div class="place-meta"><span>${escapeHtml(place.bestTime)}</span><span>${escapeHtml(place.duration)}</span></div>
      <div class="card-actions">
        <button class="primary-button add-button" type="button" data-place-id="${place.id}">
          ${isSelected ? "Added to itinerary" : "Add to itinerary"}
        </button>
        <button class="secondary-button map-button" type="button" data-place-id="${place.id}">Show on map</button>
        <a href="${escapeHtml(place.tourismCalgaryUrl)}" target="_blank" rel="noopener">${isFood ? "Dining Info ↗" : "Tourism Calgary ↗"}</a>
      </div>
    </div>
  `;
  card.querySelector(".add-button").addEventListener("click", () => addToItinerary(place.id));
  card.querySelector(".map-button").addEventListener("click", () => showPlaceOnMap(place.id));
  card.addEventListener("mouseenter", () => focusPlace(place.id));
  return card;
}

function focusPlace(placeId) {
  const place = state.places.find(item => item.id === placeId);
  const marker = state.markers.get(placeId);
  if (!place || !marker) return;
  state.map.setView([place.latitude, place.longitude], 14, { animate: true });
  marker.openPopup();
}

function showPlaceOnMap(placeId) {
  focusPlace(placeId);
  document.querySelector("#map")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function showPlaceDetails(placeId) {
  const card = document.querySelector(`#place-card-${placeId}`);
  if (!card) return;
  state.map.closePopup();
  card.classList.add("place-card-highlight");
  card.scrollIntoView({ behavior: "smooth", block: "start" });
  card.querySelector("h3")?.focus({ preventScroll: true });
  window.setTimeout(() => card.classList.remove("place-card-highlight"), 1800);
}

function focusHub(hub) {
  if (hub === "all") {
    state.map.setView([51.045, -114.07], 12, { animate: true });
    return;
  }

  const places = state.places.filter(place => place.hub === hub);
  if (!places.length) return;

  const bounds = L.latLngBounds(places.map(place => [place.latitude, place.longitude]));
  state.map.fitBounds(bounds, {
    padding: [30, 30],
    maxZoom: 14,
    animate: true
  });
}

function addToItinerary(placeId) {
  if (!state.selectedIds.includes(placeId)) state.selectedIds.push(placeId);
  persistItinerary();
  renderItinerary();
  renderPlaces();
}

function removeFromItinerary(placeId) {
  state.selectedIds = state.selectedIds.filter(id => id !== placeId);
  persistItinerary();
  renderItinerary();
  renderPlaces();
}

function moveStop(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= state.selectedIds.length) return;
  [state.selectedIds[index], state.selectedIds[newIndex]] = [state.selectedIds[newIndex], state.selectedIds[index]];
  persistItinerary();
  renderItinerary();
}

function renderItinerary() {
  const selectedPlaces = state.selectedIds
    .map(id => state.places.find(place => place.id === id))
    .filter(Boolean);
  elements.itineraryCount.textContent = selectedPlaces.length;
  elements.itineraryList.replaceChildren();
  elements.exportLinks.replaceChildren();

  if (!selectedPlaces.length) {
    elements.itineraryList.innerHTML = `<li class="empty-state">Your itinerary is empty. Add places from the guide.</li>`;
    return;
  }

  selectedPlaces.forEach((place, index) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <span>${escapeHtml(place.name)}</span>
      <span class="stop-controls">
        <button class="move-button" type="button" data-index="${index}" data-direction="-1" aria-label="Move ${escapeHtml(place.name)} up">↑</button>
        <button class="move-button" type="button" data-index="${index}" data-direction="1" aria-label="Move ${escapeHtml(place.name)} down">↓</button>
        <button class="remove-button" type="button" data-place-id="${place.id}">Remove</button>
      </span>
    `;
    item.querySelector(".remove-button").addEventListener("click", () => removeFromItinerary(place.id));
    item.querySelectorAll(".move-button").forEach(button => {
      button.addEventListener("click", () => moveStop(Number(button.dataset.index), Number(button.dataset.direction)));
    });
    elements.itineraryList.append(item);
  });
}

function buildGoogleMapsUrl(stops, travelMode) {
  const params = new URLSearchParams({
    api: "1",
    origin: stops[0].address,
    destination: stops[stops.length - 1].address,
    travelmode: travelMode
  });
  const waypoints = stops.slice(1, -1).map(stop => stop.address).join("|");
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function getRouteSegments(stops, maxStops = 10) {
  if (stops.length <= maxStops) return [stops];
  const segments = [];
  let start = 0;
  while (start < stops.length - 1) {
    const end = Math.min(start + maxStops - 1, stops.length - 1);
    segments.push(stops.slice(start, end + 1));
    start = end;
  }
  return segments;
}

function exportItinerary() {
  const stops = state.selectedIds.map(id => state.places.find(place => place.id === id)).filter(Boolean);
  if (stops.length < 2) {
    setStatus("Add at least two places before exporting a route.");
    return;
  }

  const segments = getRouteSegments(stops);
  const links = segments.map((segment, index) => ({
    label: segments.length === 1 ? "Open route in Google Maps ↗" : `Open route segment ${index + 1} in Google Maps ↗`,
    url: buildGoogleMapsUrl(segment, elements.travelMode.value)
  }));
  elements.exportLinks.innerHTML = links.map(link => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener">${escapeHtml(link.label)}</a>`).join("");
  window.open(links[0].url, "_blank", "noopener");
  setStatus(segments.length === 1 ? "Route opened in a new tab." : "The first segment opened. Additional segments are listed below.");
}

async function shareItinerary() {
  if (!state.selectedIds.length) {
    setStatus("Add at least one place before creating a share link.");
    return;
  }
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("itinerary", state.selectedIds.join(","));
  try {
    await navigator.clipboard.writeText(url.toString());
    setStatus("Share link copied to your clipboard.");
  } catch {
    window.prompt("Copy this itinerary link:", url.toString());
  }
}

function setStatus(message) {
  elements.panelStatus.textContent = message;
  window.clearTimeout(setStatus.timer);
  setStatus.timer = window.setTimeout(() => { elements.panelStatus.textContent = ""; }, 5000);
}

function openItinerary() {
  elements.itineraryPanel.hidden = false;
  elements.overlay.hidden = false;
  document.querySelector("#itinerary-toggle").setAttribute("aria-expanded", "true");
}

function closeItinerary() {
  elements.itineraryPanel.hidden = true;
  elements.overlay.hidden = true;
  document.querySelector("#itinerary-toggle").setAttribute("aria-expanded", "false");
}

const adventurePreferences = {
  "few-hours": [
    { id: "urban", label: "Iconic buildings and city energy", hubs: ["downtown", "eau-claire-river"] },
    { id: "culture", label: "Arts, music, and local vibes", hubs: ["east-village-inglewood"] },
    { id: "river", label: "River views and scenic walks", hubs: ["eau-claire-river"] }
  ],
  "full-day": [
    { id: "history", label: "History and heritage", hubs: ["heritage-park-glenmore", "east-village-inglewood"] },
    { id: "nature", label: "Nature and spacious park paths", hubs: ["parks-in-the-city"] },
    { id: "local", label: "A relaxed local day out", hubs: ["downtown", "eau-claire-river", "east-village-inglewood"] }
  ],
  "multiple-days": [
    { id: "mix", label: "A balanced mix of city highlights", hubs: ["downtown", "east-village-inglewood", "eau-claire-river"] },
    { id: "outdoors", label: "Parks, water, and outdoor adventures", hubs: ["parks-in-the-city", "eau-claire-river", "other-attractions"] },
    { id: "everything", label: "A little of everything", hubs: [...new Set(Object.keys(hubNames))] }
  ]
};

function showAdventurePreferences(time) {
  elements.plannerTimeOptions.hidden = true;
  elements.plannerPreferenceOptions.hidden = false;
  elements.plannerPrompt.textContent = "What kind of experience sounds best?";
  elements.plannerPreferenceOptions.replaceChildren();
  adventurePreferences[time].forEach(preference => {
    const button = document.createElement("button");
    button.className = "planner-option";
    button.type = "button";
    button.innerHTML = `<strong>${escapeHtml(preference.label)}</strong><small>Show the places we would prioritize</small>`;
    button.addEventListener("click", () => chooseAdventure(time, preference));
    elements.plannerPreferenceOptions.append(button);
  });
}

function chooseAdventure(time, preference) {
  state.adventure = { time, preferenceLabel: preference.label, hubs: preference.hubs };
  elements.hubFilter.value = "all";
  elements.search.value = "";
  elements.plannerPreferenceOptions.hidden = true;
  elements.plannerSummary.hidden = false;
  elements.plannerSummaryText.textContent = `${preference.label} · ${time === "few-hours" ? "A few hours" : time === "full-day" ? "A full day" : "More than one day"}`;
  renderPlaces();
  const places = getFilteredPlaces();
  if (places.length) {
    state.map.fitBounds(L.latLngBounds(places.map(place => [place.latitude, place.longitude])), { padding: [30, 30], maxZoom: 13, animate: true });
  }
}

function resetAdventure() {
  state.adventure = null;
  elements.plannerTimeOptions.hidden = false;
  elements.plannerPreferenceOptions.hidden = true;
  elements.plannerSummary.hidden = true;
  elements.plannerPrompt.textContent = "How much time do you have to explore?";
  renderPlaces();
}

function bindEvents() {
  elements.hubFilter.addEventListener("change", () => {
    state.adventure = null;
    resetAdventure();
    focusHub(elements.hubFilter.value);
  });
  elements.typeFilter.addEventListener("change", renderPlaces);
  elements.search.addEventListener("input", renderPlaces);
  elements.plannerTimeOptions.querySelectorAll("[data-time]").forEach(button => {
    button.addEventListener("click", () => showAdventurePreferences(button.dataset.time));
  });
  document.querySelector("#reset-planner").addEventListener("click", resetAdventure);
  document.querySelector("#itinerary-toggle").addEventListener("click", openItinerary);
  document.querySelector("#close-itinerary").addEventListener("click", closeItinerary);
  elements.overlay.addEventListener("click", closeItinerary);
  document.querySelector("#clear-itinerary").addEventListener("click", () => {
    state.selectedIds = [];
    persistItinerary();
    renderItinerary();
    renderPlaces();
  });
  document.querySelector("#export-itinerary").addEventListener("click", exportItinerary);
  document.querySelector("#share-itinerary").addEventListener("click", shareItinerary);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

init().catch(error => {
  console.error(error);
  document.querySelector("#place-list").innerHTML = `<p class="empty-state">The guide could not load its place data. Please run it through a local web server.</p>`;
});
