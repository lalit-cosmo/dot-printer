# Dot Printer

**Dot Printer** is a lightweight Windows desktop application that adds a small dot to the left edge of a page to help identify a folding, punching, or binding reference point when printing documents.

## Features

- Add a dot at the midpoint of the left page edge.
- Set the dot diameter to 3 mm.
- Process PDF files locally.
- Preview and prepare documents for printing.
- Designed to work offline after installation, subject to the app's local dependencies and functionality.
- Windows desktop application built with Electron and Vite.

## Download

Download the Windows installer from the project's [GitHub Releases](https://github.com/lalit-cosmo/dot-printer/releases) page when a release is available.

## Install

1. Download `Dot Printer Setup 0.1.0.exe` from Releases.
2. Run the installer.
3. Follow the installation instructions.
4. Open Dot Printer from the Start menu or desktop shortcut, if created.

**Windows security note:** The installer may display a warning because it is not signed with a recognized code-signing certificate.

## Run from source

### Requirements

- Node.js and npm
- Git

### Setup

```powershell
git clone https://github.com/lalit-cosmo/dot-printer.git
cd dot-printer
npm install
```

### Start the development version

Open two terminal windows in the project directory.

Terminal 1:

```powershell
npm run dev
```

Terminal 2:

```powershell
npm run dev:electron
```

### Build the Windows installer

```powershell
npm run dist
```

The generated installer is placed in the `release` directory.

## Privacy

Document processing is intended to happen locally on your computer. Avoid processing sensitive documents until you have verified the behavior of the specific features you use.

## Project status

Dot Printer is under active development. Features and supported document formats may change between versions.

## License

No open-source license has been specified yet. All rights are reserved unless a license is added to this repository.
