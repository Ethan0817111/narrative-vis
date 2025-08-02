const svg = d3.select("svg");
const width = +svg.attr("width");
const height = +svg.attr("height");
const margin = { top: 50, right: 50, bottom: 50, left: 60 };
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

let rawData, dataByCity, currentCity = "New York", currentScene = 1;

d3.csv("cities-month-NSA.csv", d3.autoType).then(data => {
  rawData = data.filter(d => d.City && d.Date && d.Index);
  dataByCity = d3.group(rawData, d => d.City);

  // Populate city dropdown
  d3.select("#city-select")
    .selectAll("option.city")
    .data(Array.from(dataByCity.keys()))
    .enter()
    .append("option")
    .attr("value", d => d)
    .attr("class", "city")
    .text(d => d);

  setScene(1);
});

function setScene(sceneNum) {
  currentScene = sceneNum;
  svg.selectAll("*").remove();
  if (sceneNum === 1) drawScene1();
  else if (sceneNum === 2) drawScene2();
  else if (sceneNum === 3) drawScene3();
}

function updateSelectedCity() {
  const selected = document.getElementById("city-select").value;
  if (selected) {
    currentCity = selected;
    if (currentScene === 3) drawScene3();
  }
}

function drawScene1() {
  const cities = ["New York", "Los Angeles", "Chicago"];
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleTime()
    .domain(d3.extent(rawData, d => d.Date))
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([d3.min(rawData, d => d.Index) * 0.9, d3.max(rawData, d => d.Index) * 1.1])
    .range([innerHeight, 0]);

  g.append("g").call(d3.axisLeft(y));
  g.append("g").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x));

  const color = d3.scaleOrdinal(d3.schemeCategory10);

  cities.forEach(city => {
    const cityData = dataByCity.get(city);
    g.append("path")
      .datum(cityData)
      .attr("fill", "none")
      .attr("stroke", color(city))
      .attr("stroke-width", 2)
      .attr("d", d3.line()
        .x(d => x(d.Date))
        .y(d => y(d.Index))
      );

    g.append("text")
      .attr("x", innerWidth - 100)
      .attr("y", y(cityData.at(-1).Index))
      .text(city)
      .attr("fill", color(city))
      .attr("font-size", "12px");
  });

  g.append("text")
    .text("Scene 1: House Price Trends in Three Cities")
    .attr("x", 0)
    .attr("y", -20)
    .attr("font-size", "18px")
    .attr("font-weight", "bold");
}

function drawScene2() {
  const latestMonth = d3.max(rawData, d => d.Date);
  const latestData = Array.from(dataByCity, ([city, values]) => {
    const record = values.find(d => +d.Date === +latestMonth);
    return record ? { city, index: record.Index } : null;
  }).filter(d => d);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand()
    .domain(latestData.map(d => d.city).slice(0, 15))
    .range([0, innerWidth])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, d3.max(latestData, d => d.index)])
    .range([innerHeight, 0]);

  g.append("g").call(d3.axisLeft(y));
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-40)")
    .style("text-anchor", "end");

  g.selectAll("rect")
    .data(latestData.slice(0, 15))
    .enter()
    .append("rect")
    .attr("x", d => x(d.city))
    .attr("y", d => y(d.index))
    .attr("width", x.bandwidth())
    .attr("height", d => innerHeight - y(d.index))
    .attr("fill", "steelblue");

  g.append("text")
    .text("Scene 2: Latest Index for Top Cities")
    .attr("x", 0)
    .attr("y", -20)
    .attr("font-size", "18px")
    .attr("font-weight", "bold");
}

function drawScene3() {
  const cityData = dataByCity.get(currentCity);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleTime()
    .domain(d3.extent(cityData, d => d.Date))
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain(d3.extent(cityData, d => d.Index))
    .range([innerHeight, 0]);

  g.append("g").call(d3.axisLeft(y));
  g.append("g").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x));

  g.append("path")
    .datum(cityData)
    .attr("fill", "none")
    .attr("stroke", "orange")
    .attr("stroke-width", 2)
    .attr("d", d3.line()
      .x(d => x(d.Date))
      .y(d => y(d.Index))
    );

  g.append("text")
    .text(`Scene 3: House Price Trend in ${currentCity}`)
    .attr("x", 0)
    .attr("y", -20)
    .attr("font-size", "18px")
    .attr("font-weight", "bold");
}
