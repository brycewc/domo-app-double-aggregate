// ==========================================================
// Category Revenue Growth – Double Aggregation Bar Chart
//
// Overcomes Domo beast-mode double-aggregation limitation
// by performing the FIXED (BY OU_NAME) logic client-side
// after fetching server-side aggregated data via @domoinc/query.
//
// Beast mode being replaced:
//   CASE WHEN variable = 'Season Year' THEN
//     CASE WHEN `Season Split Year Grouping` = MAX(MAX(...)) FIXED (BY OU_NAME) THEN  SUM(...)
//          WHEN `Season Split Year Grouping` = MIN(MIN(...)) FIXED (BY OU_NAME) THEN -SUM(...)
//     END
//   ... (similar for Season, Calendar Year)
//   END
// ==========================================================

import domo from 'ryuu.js';
import Query from '@domoinc/query';
import * as d3 from 'd3';
import './app.css';

const DATASET_ALIAS = 'revenue';

const COLORS = {
  positive: '#9DC3E6',
  negative: '#C0504D',
};

// Map Domo variable values to the dataset column that determines periods
const VARIABLE_TO_COLUMN = {
  'Season Year': 'Season Split Year Grouping',
  'Season': 'Season Split Sort',
  'Calendar Year': 'Fiscal Year',
};

const DEFAULT_VARIABLE = 'Season Year';

// Track current variable so event handlers can access it
let currentVariable = DEFAULT_VARIABLE;
// Cache last rendered data for resize
let cachedData = null;
let cachedTitle = '';
let cachedTotal = 0;

// ----------------------------------------------------------
// Formatting
// ----------------------------------------------------------

function formatValue(value) {
  const abs = Math.abs(value);
  let str;
  if (abs >= 1e6) str = (abs / 1e6).toFixed(2) + 'M';
  else if (abs >= 1e3) str = (abs / 1e3).toFixed(2) + 'K';
  else str = abs.toFixed(2);

  // Remove trailing zeros: 1.00M → 1M, 1.20M → 1.2M
  str = str.replace(/\.?0+([MKB])$/, '$1');

  return value < 0 ? '(' + str + ')' : str;
}

function formatAxisTick(value) {
  const abs = Math.abs(value);
  if (abs >= 1e6) return '$' + (abs / 1e6).toFixed(0) + 'M';
  if (abs >= 1e3) return '$' + (abs / 1e3).toFixed(0) + 'K';
  return '$' + abs.toFixed(0);
}

function formatTotal(value) {
  const abs = Math.abs(value);
  if (abs >= 1e9) return '$' + (abs / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return '$' + (abs / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return '$' + (abs / 1e3).toFixed(2) + 'K';
  return '$' + abs.toFixed(2);
}

// ----------------------------------------------------------
// Data: query + double-aggregation logic
// ----------------------------------------------------------

function getPeriodColumn(variableValue) {
  return VARIABLE_TO_COLUMN[variableValue] || VARIABLE_TO_COLUMN[DEFAULT_VARIABLE];
}

/**
 * Fetch data using @domoinc/query with server-side aggregation.
 * Groups by OU_NAME + period column, sums TOTAL_AMOUNT_USD.
 */
function fetchData(periodColumn) {
  return new Query()
    .select(['OU_NAME', periodColumn, 'TOTAL_AMOUNT_USD'])
    .groupBy('OU_NAME')
    .groupBy(periodColumn, { TOTAL_AMOUNT_USD: 'sum' })
    .fetch(DATASET_ALIAS);
}

/**
 * Client-side FIXED (BY OU_NAME) logic:
 *   For each category (OU_NAME):
 *     - Find global MAX period → "newer" period → positive sum
 *     - Find global MIN period → "older" period → negative sum
 *     - Growth = newer - older
 *
 * This replaces the beast mode's double-aggregation that Domo can't handle.
 */
function computeGrowth(rows, periodColumn) {
  // Group by OU_NAME
  const groups = {};
  rows.forEach((row) => {
    const cat = row.OU_NAME;
    if (!cat) return;
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(row);
  });

  // Find global max and min period across ALL categories
  const allPeriods = rows.map((r) => r[periodColumn]).filter(Boolean);
  const globalMax = d3.max(allPeriods);
  const globalMin = d3.min(allPeriods);

  if (globalMax === globalMin) return [];

  const results = [];

  Object.keys(groups).forEach((category) => {
    const catRows = groups[category];

    let newerSum = 0;
    let olderSum = 0;

    catRows.forEach((r) => {
      const period = r[periodColumn];
      const amount = +(r.TOTAL_AMOUNT_USD) || 0;

      if (period === globalMax) newerSum += amount;
      else if (period === globalMin) olderSum += amount;
    });

    results.push({ category, value: newerSum - olderSum });
  });

  // Sort by absolute value descending (largest bars at top)
  results.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  return results;
}

// ----------------------------------------------------------
// Chart title
// ----------------------------------------------------------

function buildTitle(variableValue, rows, periodColumn) {
  const seen = {};
  const periods = [];
  rows.forEach((r) => {
    const p = r[periodColumn];
    if (p && !seen[p]) {
      seen[p] = true;
      periods.push(p);
    }
  });
  periods.sort();

  const minP = periods[0] || '?';
  const maxP = periods[periods.length - 1] || '?';
  const prefix = variableValue || 'Season Years';

  return prefix + ' ' + minP + ' vs ' + maxP + ' Category Revenue Growth';
}

// ----------------------------------------------------------
// D3 Horizontal Bar Chart
// ----------------------------------------------------------

function renderChart(data) {
  d3.select('#chart').selectAll('*').remove();
  if (!data || data.length === 0) return;

  const container = document.getElementById('chart');
  const containerWidth = container.clientWidth || 600;

  const labelWidth = 130;
  const barHeight = 36;
  const barGap = 14;
  const topAxisHeight = 30;
  const rightPadding = 80;

  const totalHeight = topAxisHeight + data.length * (barHeight + barGap) + 10;

  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('width', containerWidth)
    .attr('height', totalHeight);

  // X scale – symmetric around 0
  const maxAbs = d3.max(data, (d) => Math.abs(d.value)) || 1;
  const domainMax = maxAbs * 1.25;

  const xScale = d3
    .scaleLinear()
    .domain([-domainMax, domainMax])
    .range([labelWidth, containerWidth - rightPadding]);

  // Top axis with grid lines
  const xAxis = d3
    .axisTop(xScale)
    .ticks(5)
    .tickFormat((d) => formatAxisTick(d))
    .tickSize(-(totalHeight - topAxisHeight));

  svg
    .append('g')
    .attr('class', 'axis-top')
    .attr('transform', 'translate(0,' + topAxisHeight + ')')
    .call(xAxis);

  // Zero line
  svg
    .append('line')
    .attr('class', 'zero-line')
    .attr('x1', xScale(0))
    .attr('x2', xScale(0))
    .attr('y1', topAxisHeight)
    .attr('y2', totalHeight);

  // Bar groups
  const bars = svg
    .selectAll('.bar-group')
    .data(data)
    .enter()
    .append('g')
    .attr('class', 'bar-group')
    .attr('transform', (d, i) => {
      return 'translate(0,' + (topAxisHeight + i * (barHeight + barGap) + barGap / 2) + ')';
    });

  // Category labels
  bars
    .append('text')
    .attr('class', 'bar-label')
    .attr('x', labelWidth - 10)
    .attr('y', barHeight / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', 'end')
    .text((d) => d.category);

  // Bar rectangles
  bars
    .append('rect')
    .attr('x', (d) => (d.value >= 0 ? xScale(0) : xScale(d.value)))
    .attr('y', 2)
    .attr('width', (d) => Math.max(1, Math.abs(xScale(d.value) - xScale(0))))
    .attr('height', barHeight - 4)
    .attr('fill', (d) => (d.value >= 0 ? COLORS.positive : COLORS.negative))
    .attr('rx', 1);

  // Value labels beside bars
  bars
    .append('text')
    .attr('class', 'bar-value')
    .attr('x', (d) => (d.value >= 0 ? xScale(d.value) + 6 : xScale(d.value) - 6))
    .attr('y', barHeight / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', (d) => (d.value >= 0 ? 'start' : 'end'))
    .text((d) => formatValue(d.value));
}

// ----------------------------------------------------------
// Process + render pipeline
// ----------------------------------------------------------

function updateHeader(title, total) {
  document.getElementById('chart-title').textContent = title;
  document.getElementById('chart-total').innerHTML =
    '<span class="amount">' + formatTotal(total) + '</span>' +
    '<span class="label">Total</span>';
}

function processAndRender(rows, variableValue) {
  const periodColumn = getPeriodColumn(variableValue);
  const data = computeGrowth(rows, periodColumn);
  const total = d3.sum(data, (d) => d.value);
  const title = buildTitle(variableValue, rows, periodColumn);

  cachedData = data;
  cachedTitle = title;
  cachedTotal = total;

  updateHeader(title, total);
  renderChart(data);
}

function loadAndRender() {
  const periodColumn = getPeriodColumn(currentVariable);
  fetchData(periodColumn).then((rows) => {
    processAndRender(rows, currentVariable);
  });
}

// ----------------------------------------------------------
// Init: event listeners + first load
// ----------------------------------------------------------

// Listen for Domo variable changes (Season/Year/Fiscal_DL)
domo.onVariablesUpdated((variables) => {
  if (variables && variables['Season/Year/Fiscal_DL']) {
    currentVariable = variables['Season/Year/Fiscal_DL'];
  }
  loadAndRender();
});

// Listen for page filter changes – re-fetch (Query API respects page filters)
domo.onFiltersUpdated(() => {
  loadAndRender();
});

// Resize: re-render from cache (no re-fetch)
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (cachedData) {
      updateHeader(cachedTitle, cachedTotal);
      renderChart(cachedData);
    }
  }, 200);
});

// Initial load
loadAndRender();
