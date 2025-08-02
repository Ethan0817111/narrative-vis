const svg = d3.select("svg");
const width = +svg.attr("width");
const height = +svg.attr("height");
const margin = { top: 50, right: 50, bottom: 50, left: 60 };
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

let rawData = [];
let dataByCity = new Map();
let currentCity = null;
let currentScene = 1;

const tryParsers = [
  d3.utcParse("%Y-%m-%d"),
  d3.utcParse("%Y/%m/%d"),
  d3.utcParse("%Y-%m"),
  d3.utcParse("%Y/%m"),
  d3.utcParse("%Y%m"),
  d3.utcParse("%Y")
];
function parseDateSmart(v) {
  if (v instanceof Date) return v;
  const s = String(v).trim();
  for (const p of tryParsers) {
    const d = p(s);
    if (d) return d;
  }
  const d2 = new Date(s);
  return isNaN(+d2) ? null : d2;
}

d3.csv("cities-month-NSA.csv").then(rows => {
  if (!rows || !rows.length) {
    console.error("CSV is empty.");
    return;
  }

  const keys = Object.keys(rows[0]);
  const dateCol = keys.find(k => k.toLowerCase() === "date");
  if (!dateCol) {
    console.error("No 'Date' column found. Headers:", keys);
    return;
  }
  const cityCols = keys.filter(k => k !== dateCol);

  const long = [];
  for (const row of rows) {
    const dDate = parseDateSmart(row[dateCol]);
    if (!dDate) continue;
    for (const col of cityCols) {
      const val = row[col];
      const idx = val === null || val === undefined || val === "" ? NaN : +val;
      if (!isNaN(idx)) long.push({ City: col.trim(), Date: dDate, Index: idx });
    }
  }
  if (!long.length) {
    console.error("After pivot, no valid rows.");
    return;
  }

  long.sort((a, b) => d3.ascending(+a.Date, +b.Date) || d3.ascending(a.City, b.City));
  rawData = long;
  dataByCity = d3.group(rawData, d => d.City);
  dataByCity.forEach(arr => arr.sort((a, b) => d3.ascending(+a.Date, +b.Date)));

  const cityList = Array.from(dataByCity.keys()).sort(d3.ascending);
  const select = d3.select("#city-select");
  select.selectAll("option.city")
    .data(cityList)
    .enter()
    .append("option")
    .attr("value", d => d)
    .attr("class", "city")
    .text(d => d);

  const prefer = ["NY-New York", "CA-Los Angeles", "IL-Chicago", "Composite-20", "National-US"];
  currentCity = prefer.find(c => dataByCity.has(c)) || cityList[0];
  select.property("value", currentCity);

  setScene(1);
}).catch(err => console.error("Failed to load CSV:", err));

function setScene(sceneNum) {
  currentScene = sceneNum;
  svg.selectAll("*").remove();
  if (sceneNum === 1) drawScene1();
  else if (sceneNum === 2) drawScene2();
  else if (sceneNum === 3) drawScene3();
}

function updateSelectedCity() {
  const selected = document.getElementById("city-select").value;
  if (selected && dataByCity.has(selected)) {
    currentCity = selected;
    setScene(currentScene);
  }
}


function addAxes(g, x, y) {
  g.append("g").call(d3.axisLeft(y).ticks(6));
  g.append("g").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x));
}

function drawScene1() {
  const prefer = ["NY-New York", "CA-Los Angeles", "IL-Chicago", "Composite-20", "National-US"];
  const existing = prefer.filter(c => dataByCity.has(c));
  const rest = Array.from(dataByCity.keys()).filter(c => !existing.includes(c));
  const cities = existing.concat(rest).slice(0, 3);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const x = d3.scaleTime().domain(d3.extent(rawData, d => d.Date)).range([0, innerWidth]);
  const y = d3.scaleLinear()
    .domain([d3.min(rawData, d => d.Index) * 0.95, d3.max(rawData, d => d.Index) * 1.05])
    .nice().range([innerHeight, 0]);

  addAxes(g, x, y);

  const color = d3.scaleOrdinal(d3.schemeCategory10).domain(cities);
  const line = d3.line().x(d => x(d.Date)).y(d => y(d.Index));

  cities.forEach(city => {
    const cityData = dataByCity.get(city);
    if (!cityData) return;
    g.append("path")
      .datum(cityData)
      .attr("fill", "none")
      .attr("stroke", color(city))
      .attr("stroke-width", 2)
      .attr("d", line);

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

function drawScene2() {
  const latestData = Array.from(dataByCity, ([city, values]) => {
    const rec = values[values.length - 1];
    return { city, index: rec.Index, date: rec.Date };
  });

  const N = 15;
  let top = latestData.sort((a, b) => d3.descending(a.index, b.index)).slice(0, N);

  if (currentCity) {
    const cur = latestData.find(d => d.city === currentCity);
    if (cur && !top.some(d => d.city === currentCity)) {
      top = top.concat(cur);
    }
  }

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const domainCities = Array.from(new Set(top.map(d => d.city)));
  const x = d3.scaleBand().domain(domainCities).range([0, innerWidth]).padding(0.2);
  const y = d3.scaleLinear().domain([0, d3.max(top, d => d.index)]).nice().range([innerHeight, 0]);

  g.append("g").call(d3.axisLeft(y));
  const gx = g.append("g").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x));
  gx.selectAll("text").attr("transform", "rotate(-40)").style("text-anchor", "end");

  g.selectAll("rect")
    .data(top)
    .enter()
    .append("rect")
    .attr("x", d => x(d.city))
    .attr("y", d => y(d.index))
    .attr("width", x.bandwidth())
    .attr("height", d => innerHeight - y(d.index))
    .attr("fill", d => d.city === currentCity ? "tomato" : "steelblue")
    .attr("stroke", d => d.city === currentCity ? "black" : "none");

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

  g.append("text")
    .text(`Scene 2: Most Recent Index — Top Cities${currentCity ? " (highlight: " + currentCity + ")" : ""}`)
    .attr("x", 0)
    .attr("y", -20)
    .attr("font-size", 18)
    .attr("font-weight", "bold");
}

function drawScene3() {
  if (!currentCity || !dataByCity.has(currentCity)) return;
  const cityData = dataByCity.get(currentCity);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const x = d3.scaleTime().domain(d3.extent(cityData, d => d.Date)).range([0, innerWidth]);
  const y = d3.scaleLinear().domain(d3.extent(cityData, d => d.Index)).nice().range([innerHeight, 0]);

  addAxes(g, x, y);

  g.append("path")
    .datum(cityData)
    .attr("fill", "none")
    .attr("stroke", "orange")
    .attr("stroke-width", 2)
    .attr("d", d3.line().x(d => x(d.Date)).y(d => y(d.Index)));

  const first = cityData[0], last = cityData[cityData.length - 1];
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
