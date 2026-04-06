// ==========================================================
// Category Revenue Growth – Double Aggregation Bar Chart
//
// Overcomes Domo beast-mode double-aggregation limitation
// by performing the FIXED (BY OU_NAME) logic client-side
// after fetching server-side aggregated data via domo.get().
//
// Beast mode being replaced:
//   CASE WHEN variable = 'Season Year' THEN
//     CASE WHEN `SEASON_SPLIT_YEAR_GROUPING` = MAX(MAX(...)) FIXED (BY OU_NAME) THEN  SUM(...)
//          WHEN `SEASON_SPLIT_YEAR_GROUPING` = MIN(MIN(...)) FIXED (BY OU_NAME) THEN -SUM(...)
//     END
//   ... (similar for Season, Calendar Year)
//   END
// ==========================================================

import domo from 'ryuu.js';
import './app.css';

/* global DomoPhoenix */
const { Chart, CHART_TYPE, DATA_TYPE, MAPPING } = DomoPhoenix;

const DATASET_ALIAS = 'revenue';

const COLORS = {
	positive: '#9DC3E6',
	negative: '#C0504D'
};

// Map Domo variable values to the dataset column that determines periods
const VARIABLE_TO_COLUMN = {
	'Season Year': 'SEASON_SPLIT_YEAR_GROUPING',
	Season: 'SEASON_SPLIT_SORT',
	'Calendar Year': 'FISCAL_YEAR'
};

const DEFAULT_VARIABLE = 'Season Year';

// Track current variable so event handlers can access it
let currentVariable = DEFAULT_VARIABLE;
// Cache last rendered data for resize
let cachedData = null;
let cachedTitle = '';
let cachedTotal = 0;

// Phoenix chart instance
let chart = null;

// ----------------------------------------------------------
// Formatting
// ----------------------------------------------------------

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
	return (
		VARIABLE_TO_COLUMN[variableValue] || VARIABLE_TO_COLUMN[DEFAULT_VARIABLE]
	);
}

/**
 * Fetch data using domo.get with server-side aggregation.
 * Groups by OU_NAME + period column, sums TOTAL_AMOUNT_USD.
 */
function fetchData(periodColumn) {
	return domo.get(
		`/data/v1/${DATASET_ALIAS}?fields=OU_NAME,${periodColumn},TOTAL_AMOUNT_USD&groupby=OU_NAME,${periodColumn}&sum=TOTAL_AMOUNT_USD`
	);
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
	if (allPeriods.length === 0) return [];

	const globalMax = allPeriods.reduce((a, b) => (a > b ? a : b));
	const globalMin = allPeriods.reduce((a, b) => (a < b ? a : b));

	if (globalMax === globalMin) return [];

	const results = [];

	Object.keys(groups).forEach((category) => {
		const catRows = groups[category];

		let newerSum = 0;
		let olderSum = 0;

		catRows.forEach((r) => {
			const period = r[periodColumn];
			const amount = +r.TOTAL_AMOUNT_USD || 0;

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
// Phoenix Horizontal Bar Chart
// ----------------------------------------------------------

function renderChart(data) {
	const container = document.getElementById('chart');
	container.innerHTML = '';
	chart = null;

	if (!data || data.length === 0) return;

	const phoenixData = {
		columns: [
			{ type: DATA_TYPE.STRING, name: 'Category', mapping: MAPPING.ITEM },
			{ type: DATA_TYPE.STRING, name: 'Growth Type', mapping: MAPPING.SERIES },
			{ type: DATA_TYPE.DOUBLE, name: 'Revenue Growth', mapping: MAPPING.VALUE }
		],
		rows: data.map((d) => [
			d.category,
			d.value >= 0 ? 'Growth' : 'Decline',
			d.value
		])
	};

	const options = {
		width: container.clientWidth || 600,
		height: container.clientHeight || 400,
		colors: [COLORS.positive, COLORS.negative]
	};

	chart = new Chart(CHART_TYPE.HORIZ_BAR, phoenixData, options);
	container.appendChild(chart.canvas);
	chart.render();
}

// ----------------------------------------------------------
// Process + render pipeline
// ----------------------------------------------------------

function updateHeader(title, total) {
	document.getElementById('chart-title').textContent = title;
	document.getElementById('chart-total').innerHTML =
		'<span class="amount">' +
		formatTotal(total) +
		'</span>' +
		'<span class="label">Total</span>';
}

function processAndRender(rows, variableValue) {
	const periodColumn = getPeriodColumn(variableValue);
	const data = computeGrowth(rows, periodColumn);
	const total = data.reduce((sum, d) => sum + d.value, 0);
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

// Resize: use Phoenix resize from cache (no re-fetch)
let resizeTimer;
window.addEventListener('resize', () => {
	clearTimeout(resizeTimer);
	resizeTimer = setTimeout(() => {
		if (chart) {
			const container = document.getElementById('chart');
			chart.resize(container.clientWidth, container.clientHeight);
		}
	}, 200);
});

// Initial load
loadAndRender();
