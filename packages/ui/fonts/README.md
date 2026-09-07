# Fonts bundled into the views

Latin subsets from Google Fonts, both under the SIL Open Font License 1.1.

- `SpaceGrotesk-latin.woff2`: Space Grotesk, variable weight 300–700 (Florian Karsten).
- `ShadowsIntoLight-latin.woff2`: Shadows Into Light, regular (Kimberly Geswein).

They are referenced from `../signal.css` as `@font-face` and inlined into the view bundles by
`deno task build` (`build --inline`), so views never fetch fonts from a CDN and need no CSP entry.
See `docs/design-system.md`, Hosts.
