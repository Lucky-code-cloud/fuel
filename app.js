
const DISTRICTS = [
  "Balaka","Blantyre","Chikwawa","Chiradzulu","Chitipa","Dedza","Dowa",
  "Karonga","Kasungu","Likoma","Lilongwe","Machinga","Mangochi","Mchinji",
  "Mulanje","Mwanza","Mzimba","Neno","Nkhata Bay","Nkhotakota","Nsanje",
  "Ntcheu","Ntchisi","Phalombe","Rumphi","Salima","Thyolo","Zomba"
];

let stations = [];
let map;
let markersLayer;

const $ = (id) => document.getElementById(id);

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function formatDate(value) {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHTML(value);
  return date.toLocaleString("en-MW", { dateStyle: "medium", timeStyle: "short" });
}

function statusLabel(value) {
  if (value === "available") return "Available";
  if (value === "unavailable") return "Unavailable";
  return "Not confirmed";
}

function statusClass(value) {
  return ["available", "unavailable"].includes(value) ? value : "unknown";
}

function setupFilters() {
  const select = $("district-filter");
  DISTRICTS.forEach(district => {
    const option = document.createElement("option");
    option.value = district;
    option.textContent = district;
    select.appendChild(option);
  });
  ["search-input", "district-filter", "fuel-filter", "status-filter"].forEach(id => {
    $(id).addEventListener(id === "search-input" ? "input" : "change", render);
  });
}

function setupMap() {
  if (!window.L) {
    $("map").innerHTML = '<div class="empty-state"><p>Map could not load. Station details are still available in the list.</p></div>';
    return;
  }
  map = L.map("map").setView([-13.5, 34.3], 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
}

function stationMatches(station) {
  const query = $("search-input").value.trim().toLowerCase();
  const district = $("district-filter").value;
  const fuel = $("fuel-filter").value;
  const status = $("status-filter").value;
  const searchable = [station.name, station.district, station.area, station.town, station.address]
    .filter(Boolean).join(" ").toLowerCase();

  if (query && !searchable.includes(query)) return false;
  if (district && station.district !== district) return false;
  if (fuel && status && station[fuel] !== status) return false;
  if (fuel && !status && !["available", "unavailable", "unknown"].includes(station[fuel] || "unknown")) return false;
  if (status && !fuel && station.petrol !== status && station.diesel !== status) return false;
  return true;
}

function render() {
  const filtered = stations.filter(stationMatches);
  $("result-count").textContent = `${filtered.length} station${filtered.length === 1 ? "" : "s"}`;

  if (!filtered.length) {
    $("station-list").innerHTML = `<div class="empty-state"><span>⛽</span><h3>${stations.length ? "No matching stations" : "No station reports yet"}</h3><p>${stations.length ? "Try changing your search or filters." : "The directory is ready for verified station information. Check back as reports are added."}</p></div>`;
  } else {
    $("station-list").innerHTML = filtered.map(station => {
      const petrol = station.petrol || "unknown";
      const diesel = station.diesel || "unknown";
      const place = [station.area, station.town, station.district].filter(Boolean).join(", ");
      const coords = Number.isFinite(Number(station.latitude)) && Number.isFinite(Number(station.longitude));
      const directions = coords
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(station.latitude + "," + station.longitude)}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([station.name, place, "Malawi"].filter(Boolean).join(" "))}`;
      return `<article class="station-card">
        <div class="station-top"><div><h3>${escapeHTML(station.name)}</h3><div class="station-location">${escapeHTML(place || "Location not specified")}</div></div></div>
        <div class="status-pills"><span class="pill ${statusClass(petrol)}">Petrol: ${statusLabel(petrol)}</span><span class="pill ${statusClass(diesel)}">Diesel: ${statusLabel(diesel)}</span></div>
        <div class="station-meta"><span>Updated: ${formatDate(station.lastUpdated)}</span><a class="directions" href="${directions}" target="_blank" rel="noopener">Directions ↗</a></div>
      </article>`;
    }).join("");
  }

  if (markersLayer) {
    markersLayer.clearLayers();
    filtered.forEach(station => {
      const lat = Number(station.latitude), lon = Number(station.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      L.marker([lat, lon]).bindPopup(
        `<strong>${escapeHTML(station.name)}</strong><br>Petrol: ${statusLabel(station.petrol)}<br>Diesel: ${statusLabel(station.diesel)}<br>Updated: ${formatDate(station.lastUpdated)}`
      ).addTo(markersLayer);
    });
  }
}

function updateStats() {
  $("total-count").textContent = stations.length;
  $("petrol-count").textContent = stations.filter(s => s.petrol === "available").length;
  $("diesel-count").textContent = stations.filter(s => s.diesel === "available").length;
  const dates = stations.map(s => new Date(s.lastUpdated)).filter(d => !Number.isNaN(d.getTime()));
  $("updated-at").textContent = dates.length
    ? dates.reduce((latest, date) => date > latest ? date : latest).toLocaleDateString("en-MW", { day: "numeric", month: "short" })
    : "—";
}

async function init() {
  $("year").textContent = new Date().getFullYear();
  setupFilters();
  setupMap();
  try {
    const response = await fetch("data/stations.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load station data (${response.status})`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("stations.json must contain a JSON array");
    stations = data;
    updateStats();
    render();
  } catch (error) {
    console.error(error);
    $("station-list").innerHTML = '<div class="empty-state"><span>!</span><h3>Could not load station data</h3><p>Check that data/stations.json exists and contains valid JSON.</p></div>';
  }
}

init();
