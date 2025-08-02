// --- SVG & Layout ---
const svg = d3.select("svg");
const width = +svg.attr("width");
const height = +svg.attr("height");
const margin = { top: 50, right: 50, bottom: 50, left: 60 };
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

// --- Global state ---
let rawData = [];
let dataByCity = new Map();
let currentCity = null;
let currentScene = 1;

// --- Robust column detection helpers ---
function findKey(keys, candidates) {
  const lower = keys.map(k => ({ raw: k, low: k.toLowerCase() }));
  for (const cand of candidates) {
    const i = lower.findIndex(o => o.low === cand || o.low.includes(cand));
    if (i !== -1) return lower[i].raw;
  }
  return null;
}

const tryParsers = [
  d3.utcParse("%Y-%m-%d"),
  d3.utcParse("%Y/%m/%d"),
  d3.utcParse("%Y-%m"),
  d3.utcParse("%Y/%m"),
  d3.utcParse("%Y%m"),
  d3.utcParse("%Y") // fallback
];

function parseDateSmart(v) {
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    // treat YYYYMM or YYYY as number
    const s = String(v);
    for (const p of tryParsers) {
      const d = p(s.length === 6 ? s : s.padEnd(7, "-01")); // crude help
      if (d) return d;
    }
  }
  const s = String(v).trim();
  for (const p of tryParsers) {
    const d = p(s);
    if (d) return d;
  }
  // last resort: Date constructor (may be timezone dependent)
  const d2 = new Date(s);
  return isNaN(+d2) ? null : d2;
}

// --- Load data (robust to different headers) ---
d3.csv("cities-month-NSA.csv").then(rows => {
  if (!rows || !rows.length) {
    console.error("CSV is empty or failed to load.");
    return;
  }

  const keys = Object.keys(rows[0]);

  // Try to detect column names
  const cityKey  = findKey(keys, ["city", "regionname", "region", "metro", "location"]);
  const dateKey  = findKey(keys, ["date", "month", "time", "period", "year_month"]);
  const indexKey = findKey(keys, ["index", "value", "hpi", "price", "priceindex", "nsa", "house_price_index"]);

  if (!cityKey || !dateKey || !indexKey) {
    console.error("Cannot detect column names. Found keys: ", keys);
    return;
  }

  // Normalize data -> {City, Date, Index}
  rawData = rows.map(r => {
    const City = String(r[cityKey]).trim();
    const DateObj = parseDateSmart(r[dateKey]);
    const Index = +r[indexKey];
    return { City, Date: DateObj, Index };
  }).filter(d => d.City && d.Date instanceof Date && !isNaN(d.Index));

  if (!rawData.length) {
    console.error("After parsing, no valid rows.");
    return;
  }

  // Sort by date per city for clean lines
  dataByCity = d3.group(rawData, d => d.City);
  dataByCity.forEach(arr => arr.sort((a, b) => d3.ascending(+a.Date, +b.Date)));

  // Populate city dropdown
  const cityList = Array.from(dataByCity.keys()).sort(d3.ascending);
  const select = d3.select("#city-select");
  select.selectAll("option.city")
    .data(cityList)
    .enter()
    .append("option")
    .attr("value", d => d)
    .attr("class", "city")
    .text(d => d);

  // Choose default city
  const preferred = ["New York", "Los Angeles", "Chicago"];
  currentCity = preferred.find(c => dataByCity.has(c)) || cityList[0];
  select.property("value", currentCity);

  // Initial scene
  setScene(1);
}).catch(err => {
  console.error("Failed to load CSV:", err);
});

// --- Scene switcher ---
function setScene(sceneNum) {
  currentScene = sceneNum;
  svg.selectAll("*").remove();
  if (sceneNum === 1) drawScene1();
  else if (sceneNum === 2) drawScene2();
  else if (sceneNum === 3) drawScene3();
}

// --- UI trigger ---
function updateSelectedCity() {
  const selected = document.getElementById("city-select").value;
  if (selected && dataByCity.has(selected)) {
    currentCity = selected;
    if (currentScene === 3) drawScene3();
  }
}

// --- Common axis builders ---
function addAxes(g, x, y) {
  g.append("g").call(d3.axisLeft(y).ticks(6));
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x));
}

// --- Scene 1: Three-city trend (fallbacks to first three cities) ---
function drawScene1() {
  const cities = (() => {
    const preferred = ["New York", "Los Angeles", "Chicago"].filter(c => dataByCity.has(c));
    if (preferred.length >= 3) return preferred.slice(0, 3);
    const rest = Array.from(dataByCity.keys()).filter(c => !preferred.includes(c));
    return preferred.concat(rest).slice(0, 3);
  })();

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleTime()
    .domain(d3.extent(rawData, d => d.Date))
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([
      d3.min(rawData, d => d.Index) * 0.95,
      d3.max(rawData, d => d.Index) * 1.05
    ])
    .nice()
    .range([innerHeight, 0]);

  addAxes(g, x, y);

  const color = d3.scaleOrdinal(d3.schemeCategory10).domain(cities);

  const line = d3.line()
    .x(d => x(d.Date))
    .y(d => y(d.Index));

  cities.forEach(city => {
    const cityData = dataByCity.get(city);
    if (!cityData) return;
    g.append("path")
      .datum(cityData)
      .attr("fill", "none")
      .attr("stroke", color(city))
      .attr("stroke-width", 2)
      .attr("d", line);

    // right-end label
    const last = cityData[cityData.length - 1];
    g.append("text")
      .attr("x", innerWidth - 4)
      .attr("y", y(last.Index))
      .attr("dy", "0.32em")
      .attr("text-anchor", "end")
      .attr("fill", color(city))
      .attr("font-size", 12)
      .text(city);
  });

  g.append("text")
    .text("Scene 1: House Price Trends in Three Cities")
    .attr("x", 0)
    .attr("y", -20)
    .attr("font-size", 18)
    .attr("font-weight", "bold");
}

// --- Scene 2: Latest month bar chart (top N cities) ---
function drawScene2() {
  // Find latest month present across all data
  const latestMonth = d3.max(rawData, d => +d.Date);
  const latestData = Array.from(dataByCity, ([city, values]) => {
    // values is sorted by Date
    const rec = values.find(v => +v.Date === latestMonth) || values[values.length - 1];
    return { city, index: rec.Index, date: rec.Date };
  });

  // Sort by index desc and take top N for legibility
  const N = 15;
  const top = latestData.sort((a, b) => d3.descending(a.index, b.index)).slice(0, N);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand()
    .domain(top.map(d => d.city))
    .range([0, innerWidth])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, d3.max(top, d => d.index)]).nice()
    .range([innerHeight, 0]);

  addAxes(g, x, y);

  g.selectAll("rect")
    .data(top)
    .enter()
    .append("rect")
    .attr("x", d => x(d.city))
    .attr("y", d => y(d.index))
    .attr("width", x.bandwidth())
    .attr("height", d => innerHeight - y(d.index))
    .attr("fill", "steelblue");

  g.selectAll("text.value")
    .data(top)
    .enter()
    .append("text")
    .attr("class", "value")
    .attr("x", d => x(d.city) + x.bandwidth() / 2)
    .attr("y", d => y(d.index) - 4)
    .attr("text-anchor", "middle")
    .attr("font-size", 10)
    .text(d => d3.format(".0f")(d.index));

  // rotate x labels for readability
  g.selectAll("g.x.axis text")
    .attr("transform", "rotate(-40)")
    .style("text-anchor", "end");

  g.append("text")
    .text("Scene 2: Latest (or Most Recent) Index — Top Cities")
    .attr("x", 0)
    .attr("y", -20)
    .attr("font-size", 18)
    .attr("font-weight", "bold");
}

// --- Scene 3: Drill-down line for selected city ---
function drawScene3() {
  if (!currentCity || !dataByCity.has(currentCity)) return;

  const cityData = dataByCity.get(currentCity);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleTime()
    .domain(d3.extent(cityData, d => d.Date))
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain(d3.extent(cityData, d => d.Index)).nice()
    .range([innerHeight, 0]);

  addAxes(g, x, y);

  g.append("path")
    .datum(cityData)
    .attr("fill", "none")
    .attr("stroke", "orange")
    .attr("stroke-width", 2)
    .attr("d", d3.line()
      .x(d => x(d.Date))
      .y(d => y(d.Index))
    );

  // simple annotation: mark first & last
  const first = cityData[0];
  const last = cityData[cityData.length - 1];
  g.append("circle").attr("cx", x(first.Date)).attr("cy", y(first.Index)).attr("r", 3).attr("fill", "orange");
  g.append("circle").attr("cx", x(last.Date)).attr("cy", y(last.Index)).attr("r", 3).attr("fill", "orange");
  g.append("text").attr("x", x(first.Date)).attr("y", y(first.Index) - 8).attr("font-size", 10).text(d3.timeFormat("%Y-%m")(first.Date));
  g.append("text").attr("x", x(last.Date)).attr("y", y(last.Index) - 8).attr("font-size", 10).attr("text-anchor", "end").text(d3.timeFormat("%Y-%m")(last.Date));

  g.append("text")
    .text(`Scene 3: House Price Trend — ${currentCity}`)
    .attr("x", 0)
    .attr("y", -20)
    .attr("font-size", 18)
    .attr("font-weight", "bold");
}
