# Category Revenue Growth – Domo Custom App

A horizontal bar chart that shows per-category revenue growth between two time periods. It overcomes the **double-aggregation limitation** in Domo beast modes by moving the `FIXED (BY ...)` / `MAX(MAX(...))` logic into client-side JavaScript while still leveraging server-side aggregation for performance.

## What problem does this solve?

Domo beast modes cannot nest aggregate functions (e.g. `MAX(MAX(col)) FIXED (BY group)`). The standard card produces duplicate rows instead of a single growth value per category. This app replaces that beast mode entirely:

1. **Server-side** — `@domoinc/query` groups by `OU_NAME` + period column with `SUM(TOTAL_AMOUNT_USD)`, returning ~2 rows per category instead of raw detail rows.
2. **Client-side** — For each category, the app finds the global MAX period (newer) and MIN period (older), then computes `growth = newer_sum - older_sum`.
3. **Result** — One bar per category, positive (light blue) or negative (red), sorted by absolute value.

## Project structure

```
domo-app-double-aggregate/
├── index.html              # Vite entry point
├── vite.config.js          # Vite config (base: './' for Domo hosting)
├── package.json            # Scripts: dev, build, preview
├── public/
│   └── manifest.json       # Domo app manifest (dataset mapping, app metadata)
├── src/
│   ├── main.js             # Application logic (data fetch, aggregation, D3 chart)
│   └── app.css             # Chart and layout styles
└── dist/                   # Build output (publish this folder)
    ├── manifest.json
    ├── index.html
    └── assets/
```

### Key files

| File | Purpose |
|------|---------|
| `public/manifest.json` | Declares the dataset mapping. Uses alias `revenue` pointed at dataset `0949d180-ac43-4f4e-9b5e-3600533df341`. Copied to `dist/` on build. |
| `src/main.js` | All app logic — data query via `@domoinc/query`, double-aggregation computation via D3 helpers, and the D3 horizontal bar chart renderer. Listens for Domo variable and filter changes. |
| `src/app.css` | Styles for the chart axis, bars, labels, and header. |
| `vite.config.js` | Sets `base: './'` (required for Domo's relative asset loading) and outputs to `dist/`. |

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Domo CLI](https://www.npmjs.com/package/@domoinc/ryuu) (`npm install -g @domoinc/ryuu`)
- A Domo instance with the target dataset

## Install

```bash
npm install
```

## Local development

```bash
npm run dev
```

> Note: API calls to Domo require `domo login` and `@domoinc/ryuu-proxy` for local routing. Without it, data fetches will fail locally.

## Build

```bash
npm run build
```

This outputs production files to `dist/`.

## Publish to Domo

```bash
domo login              # Authenticate with your Domo instance (one-time)
npm run build           # Build production assets
cd dist
domo publish            # Upload to Domo
```

### First publish

On the first publish Domo generates a unique `id` for the app. You **must** copy this ID back into your source manifest to avoid creating a new app on every subsequent publish:

1. After `domo publish`, open `dist/manifest.json` and find the `"id"` field.
2. Copy that `id` value into `public/manifest.json`.
3. Commit the change.

### Subsequent publishes

```bash
npm run build && cd dist && domo publish
```

## Configuration required in Domo

### Dataset

The app queries dataset **`0949d180-ac43-4f4e-9b5e-3600533df341`** (alias: `revenue`). To point at a different dataset, update the `dataSetId` in `public/manifest.json`:

```json
{
  "datasetsMapping": [
    {
      "alias": "revenue",
      "dataSetId": "YOUR-DATASET-ID-HERE",
      "fields": []
    }
  ]
}
```

The dataset must contain these columns:

| Column | Type | Description |
|--------|------|-------------|
| `OU_NAME` | String | Category name (e.g. SNOW, BIKE, SURF) |
| `TOTAL_AMOUNT_USD` | Numeric | Revenue amount |
| `Season Split Year Grouping` | String/Numeric | Period identifier used when variable = "Season Year" |
| `Season Split Sort` | String/Numeric | Period identifier used when variable = "Season" |
| `Fiscal Year` | String/Numeric | Period identifier used when variable = "Calendar Year" |

### Domo variable

The app listens for a Domo variable named **`Season/Year/Fiscal_DL`** to determine which period column to use:

| Variable value | Period column used |
|---|---|
| `Season Year` (default) | `Season Split Year Grouping` |
| `Season` | `Season Split Sort` |
| `Calendar Year` | `Fiscal Year` |

If the variable is not set, the app defaults to `Season Year`.

### Thumbnail

Domo requires a `thumbnail.png` (300x300 pixels) alongside the manifest. Place it in the `public/` folder so it gets copied to `dist/` on build. If you don't have one yet, add one before publishing.

### Page filters

The app uses `@domoinc/query` which automatically respects Domo page-level filters. It also re-fetches data when filters change via `domo.onFiltersUpdated()`.

## Dependencies

| Package | Purpose |
|---------|---------|
| `ryuu.js` | Domo JS SDK — environment info, event listeners, navigation |
| `@domoinc/query` | Query builder for Domo datasets with server-side aggregation |
| `d3` | D3.js — scales, axes, and SVG rendering for the bar chart |
| `vite` | Build tool — bundles everything into static assets for Domo |
