# SweetCord Desktop Website — Product and Engineering Plan

## 1. Product objective

Create a clear, high-quality public landing page for the Electron desktop wrapper that helps visitors understand the product, inspect its implementation, and find the appropriate published preview build. The site should improve clarity and trust before optimizing for downloads.

### Primary outcomes

1. Explain the product in the first screen.
2. Route Windows users to published releases without implying that every source commit has a corresponding installer.
3. Make performance profiles and their trade-offs understandable.
4. Set accurate expectations about voice, camera, screen sharing, memory use, and the Discord relationship.
5. Keep the site maintainable, fast, accessible, and independently deployable.

### Success criteria

- Visitors can identify what SweetCord Desktop is and is not within one screen.
- Every download CTA opens the repository's official release page.
- No performance number or stability claim is presented without reproducible evidence.
- Main navigation, performance profile selector, and FAQ work with keyboard and touch.
- Layout remains legible and usable at narrow mobile widths.
- The marketing site can be updated without touching the existing React/Supabase application.

## 2. Positioning and audience

### Positioning statement

SweetCord Desktop is an unofficial, configurable desktop wrapper around Discord's official web client. It focuses on reducing selected visual-resource and interface work while keeping key desktop controls understandable.

### Core audiences

- Windows users who prefer a focused, text-first desktop experience.
- Players who want to test configurable visual-resource filtering.
- Developers and technically curious users who want to inspect the source and tests.

### Message hierarchy

1. **Benefit:** stay focused on your game and conversations.
2. **Mechanism:** use configurable interface and visual-resource controls around Discord's web client.
3. **Choice:** Extreme Lite, Balanced, and Custom.
4. **Trust:** source, tests, release notes, clear permissions and limitations.
5. **Action:** inspect and choose a published Windows preview.

### Claims policy

Avoid claims such as “uses 90% less RAM,” “runs under 1 GB,” “zero lag,” “100% secure,” “undetectable,” or “official Discord client.” Only publish measurable performance figures when a documented benchmark has been repeated on named hardware with comparable workloads and raw results.

## 3. Information architecture

The single-page site is organized around a short conversion funnel:

1. **Hero:** tagline, clear positioning, release/source CTAs, preview status, and an illustrative desktop mockup.
2. **Product principles:** control, focus, transparency.
3. **Experience:** a quieter interface, profile controls, microphone-focused mode.
4. **Performance profiles:** interactive overview of Extreme Lite, Balanced, and Custom.
5. **Getting started:** release page, source/installer review, select profile.
6. **Trust and transparency:** sign-in handling, permission policy, source review, no memory guarantees.
7. **FAQ:** product identity, performance, voice, visual trade-offs, affiliation, release maturity.
8. **Final CTA/footer:** releases, source, issues and project links.

The initial site intentionally uses a one-page structure. Add separate pages only when analytics-free feedback or real content volume demonstrates a need.

## 4. Visual design system

### Brand expression

- **Personality:** focused, sophisticated, technically credible, welcoming to gamers.
- **Palette:** midnight backgrounds, charcoal surfaces, controlled violet/lavender accent, muted neutral text, mint status accent.
- **Typography:** system-first sans-serif for fast loading and good cross-platform rendering; large tight headline rhythm and readable body text.
- **Components:** thin low-contrast borders, restrained radius, carefully controlled gradients, precise spacing, hover/focus states.
- **Illustration:** CSS-built product UI mockup that avoids implying that a marketing render is a real screenshot.
- **Motion:** short state transitions only; respect prefers-reduced-motion.

### Design guardrails

- Avoid generic stock photos, noisy gamer clichés, excessive neon, glass-card overload, and fake performance counters.
- Preserve contrast for secondary text and small labels.
- Keep the primary release CTA clear without disguising preview risk.
- Avoid loading third-party font or analytics services just to decorate the page.
- Check the design at 320, 375, 768, 1024, and 1440 CSS pixel widths.

## 5. Frontend architecture

### Initial implementation

A dependency-free static website inside `desktop-site/` using semantic HTML, local CSS, and a small JavaScript file. This keeps it separate from the root React/Supabase app and avoids adding build dependencies for a marketing page.

- `index.html`: page structure, page metadata, accessible controls and links.
- `styles.css`: design tokens, component styling, responsive layouts and reduced-motion behavior.
- `app.js`: mobile navigation, profile selector, dynamic footer year.
- `favicon.svg`: local vector mark.
- `README.md`: local preview and deployment instructions.

### Why static first

The site currently needs no account system, database, search, checkout, or content-management backend. Static delivery reduces complexity, build surface, dependencies, and operational maintenance. If a real requirement for a backend appears, define it separately instead of coupling the marketing site to the SweetCord chat database.

## 6. Download and release strategy

- All primary download CTAs open the official GitHub releases page.
- Do not hard-code a versioned installer into multiple places on the site.
- Make release maturity visible and link to the desktop documentation.
- Add a direct current-release download only if release publication is reliable and there is a clear way to update the link and verify artifact identity.
- Consider publishing checksums and signed release artifacts as a separate release-engineering improvement.
- Keep the marketing site accurate when source is ahead of the latest published binary.

## 7. Security and privacy

- No tracking pixels, analytics SDK, or data collection by default.
- No auth form, token input, secret collection, or database access on the marketing site.
- Use external links to official GitHub locations and appropriate rel attributes for new tabs.
- Keep third-party affiliation and preview caveats visible.
- Keep all site assets local and avoid remote images that add supply-chain or privacy dependencies.
- Continue reviewing Electron navigation, permissions, update/release integrity, dependencies, and Tauri popup handling independently of the landing page.

## 8. Accessibility and responsive quality

- Use landmark elements, one primary page heading, ordered heading levels, meaningful link text, and a skip link.
- Ensure visible keyboard focus on buttons, links, tabs, and disclosure controls.
- Reflect selector state with aria-pressed and announce its updated content using an aria-live region.
- Use native details/summary FAQ disclosure controls.
- Keep controls touch-friendly and navigation usable on small screens.
- Respect prefers-reduced-motion.
- Validate contrast and layout at narrow widths, with zoom, and with keyboard-only navigation.

## 9. SEO and shareability

- Provide a descriptive title and page description.
- Include Open Graph title, description, and URL metadata.
- Keep headings and body text crawlable in HTML rather than rendering the copy as images.
- Add a local favicon.
- After deployment, verify the canonical project-pages URL, social preview, and actual deployed asset paths.
- Consider a sitemap and structured data only if the site grows beyond a single static landing page.

## 10. Quality checks

Before release:
- Validate HTML structure and local asset paths.
- Run `node --check desktop-site/app.js`.
- Check layout at phone, tablet, laptop, and wide desktop widths.
- Test all external destinations, keyboard navigation, FAQ interaction, and profile selector behavior.
- Test at 200% zoom and with reduced-motion preferences.
- Confirm the website does not promise features that the Electron wrapper lacks.
- Confirm release CTAs land on GitHub Releases and show the right current project status.
- Review actual deployed behavior after GitHub Pages finishes.

The GitHub Actions workflow runs lightweight static validation. Manual visual and accessibility review remains necessary.

## 11. Deployment plan

1. Keep the site self-contained under `desktop-site/`.
2. Use GitHub Actions to validate and upload the directory as a Pages artifact.
3. Enable **Settings → Pages → Build and deployment → GitHub Actions** in repository settings.
4. Watch the Pages workflow and use its deployment URL.
5. Review the real deployed page for asset-path issues, mobile layout, external links, and social metadata.
6. On future updates, merge changes to `main`; the workflow publishes updated static assets.

## 12. Recommended roadmap

### Phase A — Foundation (implemented in this initial version)
- Product positioning and visual design tokens.
- Responsive one-page landing site.
- CSS-generated interface concept.
- Profile selector and mobile nav.
- Release/source/documentation CTAs.
- Security, limitations, FAQ and preview disclosure.
- GitHub Pages workflow and site README.

### Phase B — Validation
- Review on real mobile and desktop browsers.
- Keyboard, contrast and reduced-motion checks.
- Verify the GitHub Pages deployment and social previews.
- Ask a small number of target users to explain the product after viewing the hero; revise unclear copy.

### Phase C — Release trust
- Add release checksums/signing if operationally supported.
- Publish reproducible performance test methodology and results.
- Document update policy and supported Windows versions once established.
- Keep website copy synchronized with the shipped Electron version.

### Phase D — Measure before expanding
- Collect voluntary user feedback through GitHub Issues/discussions.
- Add privacy-respecting analytics only if a concrete decision requires them and the privacy implications are documented.
- Add pages or features only when they improve user understanding or reduce support costs.

## 13. Definition of done

The first public version is ready when:
- The site describes the Electron wrapper accurately.
- Mobile and desktop layouts work.
- Core interactions function with mouse, touch, and keyboard.
- Release and source links are correct.
- Static validation and GitHub Actions pass.
- GitHub Pages is enabled and the deployed URL has been manually checked.
- A maintainer has reviewed every public performance, security, and affiliation claim.
