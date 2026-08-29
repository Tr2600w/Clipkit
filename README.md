# ClipKit

ClipKit is a browser-based news-clipping operations tool for recording PR coverage, preparing Excel data for Word Mail Merge, and tracking each clipping through its document workflow.

## Features

- URL detection for publication, platform, date, PR value, and logo file
- Duplicate URL warning with an explicit confirmation before intentional duplicates
- Per-project filename patterns, defaulting to `{YYMMDD}_{Publication}{PlatformSuffix}.pdf`; social/TV suffixes are shared by Letter, A4, Excel, batch ZIP, and CSV output
- Central Platform Registry for adding, renaming, deactivating, or deleting platforms and editing both DB suffixes (`FB`, `X`, etc.) and filename abbreviations
- Capture workspace: paste or upload multiple screenshots, reorder, crop, rotate, restore the original, and adjust paper-aware page-break lines
- Crafted prepress image editor with full-template page previews, independent workspace zoom, per-capture 25–100% scale, fixed-aspect left/center/right alignment, a draggable 0–200 pt first-page placement rail, project layout defaults, and persisted effective-DPI metadata
- Paper-capacity pagination fills the 430 pt first-page frame and 560 pt continuation frames, ignores obsolete cuts when an image already fits, distinguishes green Auto cuts from orange Manual cuts, warns about tiny final-page tails, and offers a confirmed fit-to-one-page scale
- `NEWSCLIPPING · Letter` output matching the supplied clipping layout, with a full first-page header and image-only continuation pages
- Fixed Letter/A4 coordinates calibrated from the reference PDF: 521.85 pt header frame, 128 × 40/44 pt logo slots, 112.7 × 13.56 pt title plate, a 500 × 430 pt first-page capture frame, and 500 × 560 pt continuation frames
- Media-logo library in IndexedDB with add/change/delete controls, main and per-platform defaults, latest-use ordering, export-session choices, local history, and optional per-entry logo lock
- Client and agency logo settings per project, plus a reusable agency-logo default
- Visible add/change/remove controls for the footer company logo and an optional non-destructive white-background transparency treatment for all logos
- Proof-before-download flow with export-only corrections for Publication, Date, Link, PR Value, and TV Duration
- Vector PDF metadata for Publication, Date, Link, and PR Value, with original-resolution capture placement and an effective-DPI traffic-light warning
- Single and batch export to a project folder where the File System Access API is available, with normal-download/ZIP fallback, duplicate-name policies, optional PDF/Excel/Backup subfolders, retry for failed batch items, and `export-summary.csv`
- Standard 150 DPI and high-quality 300 DPI output modes; PNG is preferred for screenshots and high-quality output, while photographic JPEG sources use quality 92% in standard mode
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
- `{PlatformSuffix}` (for example ` - FB`, ` - IG`, or ` - TV - 2.29 min`; Website is blank)
- `{Platform}`
- `{Project}`

Google Sheets secrets are kept only for the current browser session and are intentionally excluded from backups. ZIP Backup includes the IndexedDB capture images and logo library so a project can be moved to another machine.

## Tests

```bash
npm test
npm run test:data
npm run check
```

The app has no build step. It requires a current Node.js version only for the test suite.

### Data ownership and recovery

After migration completes, IndexedDB (`clipkit-data`) is the source of truth for projects, entries, captures, media mappings, logo assets, and export history. Legacy localStorage/IndexedDB data remains read-only during the 30-day safety window. Do not clear browser storage until a ZIP backup has been inspected and verified.

Use Settings → Backup to create a ZIP before moving machines or running a destructive restore. The backup contains canonical records and original image/logo bytes with checksums; directory handles, credentials, cookies, and tokens are intentionally omitted. After restore, select the destination folder again when prompted. Use Settings → Migration recovery to verify the safety window, roll back if required, or review legacy cleanup candidates.
