# ClipKit

ClipKit is a browser-based news-clipping operations tool for recording PR coverage, preparing Excel data for Word Mail Merge, and tracking each clipping through its document workflow.

## Features

- URL detection for publication, platform, date, PR value, and logo file
- Duplicate URL warning with an explicit confirmation before intentional duplicates
- Per-project filename patterns, defaulting to `{YYMMDD}_{Publication}.pdf`
- Central Platform Registry for adding, renaming, deactivating, or deleting platforms and editing both DB suffixes (`FB`, `X`, etc.) and filename abbreviations
- Capture workspace: paste or upload multiple screenshots, reorder, crop, rotate, restore the original, and adjust page-break lines
- `NEWSCLIPPING · Letter` output matching the supplied clipping layout, with a full first-page header and image-only continuation pages
- Fixed Letter coordinates calibrated from the reference PDF: 521.85 pt header frame, 128 × 40/44 pt logo slots, 112.7 × 13.56 pt title plate, and 468 pt capture width
- Media-logo library in IndexedDB with main and per-platform mappings, flexible search, user confirmation, and optional per-entry logo lock
- Client and agency logo settings per project, plus a reusable agency-logo default
- Visible add/change/remove controls for the footer company logo and an optional non-destructive white-background transparency treatment for all logos
- Proof-before-download flow with export-only corrections for Publication, Date, Link, PR Value, and TV Duration
- Single PDF export and batch ZIP export with flat PDF files plus `export-summary.csv`
- Standard and high-quality output modes
- Work statuses: Draft, Captured, Ready, and Completed
- Excel export with `News Data`, `MailMerge`, and `Summary` sheets
- Versioned browser storage with migration and a pre-migration safety snapshot
- ZIP backup and restore across projects, captures, media databases, logo assets, and mappings (legacy JSON restore remains supported)
- Google Sheets writes that report success only after the Apps Script endpoint acknowledges the request
- URL protocol filtering and safer rendering of user-provided values

## Run locally

Serve the folder over HTTP so browser storage, Excel export, and Google Sheets integration behave consistently:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4173/`.

## Project settings

Open the gear menu to configure the client/project name and PDF filename pattern. Supported filename tokens are:

- `{YYMMDD}`
- `{Publication}`
- `{Platform}`
- `{Project}`

Google Sheets secrets are kept only for the current browser session and are intentionally excluded from backups. ZIP Backup includes the IndexedDB capture images and logo library so a project can be moved to another machine.

## Tests

```bash
npm test
```

The app has no build step. It requires a current Node.js version only for the test suite.
