# SweetCord Desktop Showcase Site

This directory contains the standalone marketing and product-information site for the Electron desktop wrapper.

## Design principles

- Midnight / violet visual identity with custom CSS interface illustration.
- Responsive layout from mobile to desktop.
- No UI framework, external font dependency, tracker, or runtime package installation.
- Keyboard-accessible navigation and profile selector.
- FAQ built with native HTML disclosure elements.
- Clear statements about preview status, Discord affiliation, permissions, and performance limits.

## Preview locally

Open `index.html` directly in a browser, or serve the repository root with a static server and visit `/desktop-site/`. This directory is independent of the main React/Supabase application.

## Deployment

The GitHub Actions workflow at `.github/workflows/desktop-site.yml` validates the static assets and publishes this directory to GitHub Pages. In repository settings, open **Settings → Pages** and set the build/deployment source to **GitHub Actions**. After the workflow finishes, use the deployment URL shown in the workflow summary.

The website links to the GitHub releases page rather than hard-coding an installer version so readers can verify the release and its notes.

## Content accuracy

The interface visible in the hero is an illustrative CSS mockup, not a screenshot. SweetCord Desktop wraps Discord's official web app. The website intentionally avoids claims of guaranteed RAM savings, a hard memory ceiling, or stable-release status.
