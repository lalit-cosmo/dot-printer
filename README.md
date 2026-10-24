# Dot Printer — v0.1

A local-first PWA starter for Windows and Android. It processes PDF files and JPG/PNG images in the browser, adds a 2 mm black dot at the geometric center of every page, and stores generated PDFs in browser IndexedDB until deleted.

## Current capabilities

- Add dots to all pages in existing PDFs while preserving page dimensions.
- Create blank PDFs with a center dot using A4, A3, A5, Legal, Letter, or custom dimensions, in portrait or landscape; create 1–500 pages.
- Convert JPG/PNG images into PDF pages at a configurable DPI (default 300).
- Batch process multiple PDFs and images.
- Preview, download, print, and delete generated PDFs.
- No accounts or file uploads.
- PWA manifest and service worker for installability/offline app-shell caching.

## Not yet implemented

- Direct DOCX conversion. A browser-only PWA cannot reliably reproduce Word layout by itself. On Windows, convert DOCX to PDF locally with LibreOffice, then import that PDF. For integrated DOCX support, the next step is a local desktop helper (for example, a Tauri desktop app that can call LibreOffice) or a separately engineered Android-compatible local conversion component.
- A custom per-file paper-size override for existing PDFs. Existing PDF dimensions are preserved by design.
- Native Windows `.exe` / Android `.apk` packages.
- Reliable permanent file storage outside browser storage. Download important outputs as a backup; browser storage may be cleared by device settings.

## Requirements

- Node.js 20+ recommended
- npm
- Windows, macOS, or Linux for development

## Run locally

1. Extract the project folder.
2. Open PowerShell or a VS Code terminal in that folder.
3. Install dependencies:

   ```powershell
   npm install
   ```

4. Start the development server:

   ```powershell
   npm run dev
   ```

5. Open the local URL printed by Vite, usually `http://localhost:5173`.

To make a production build:

```powershell
npm run build
npm run preview
```

## Android testing

For testing from an Android phone on the same Wi-Fi, use the network URL shown by Vite, if Windows Firewall permits it. For PWA installation, deploy the built app to an HTTPS static host. `localhost` is only the laptop itself when opened on the phone.

## Printing notes

- Use **Actual size** or **100%** in the print dialog.
- Disable **Fit to page** if exact physical measurements matter.
- Printer mechanics can still cause small physical alignment errors.
- PDF coordinates use points (72 points per inch); 2 mm is approximately 5.6693 PDF points in diameter.

## Privacy notes

The app processes selected files in the browser and stores generated PDF bytes in IndexedDB. It does not intentionally send selected documents to a server. Avoid running the app from an untrusted build or hosting it from a site you do not control.
