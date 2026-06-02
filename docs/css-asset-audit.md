# CSS Asset Audit

Last updated: 2026-06-02

## Current Load Order

`views/partials/head.ejs` loads CSS in this order:

1. Legacy shared layer: `shared.css`, `main.css`
2. New base layer: `base/tokens.css`, `base/reset.css`, `base/utilities.css`
3. New component layer: `components/*.css`
4. Page layer: files from `pageStyles`

This order is intentionally preserved for now to avoid visual changes.

## Automated Guard

Run:

```sh
npm run test:css:audit
```

The audit fails only on objective breakages:

1. CSS directory missing or empty.
2. Unbalanced CSS braces.
3. A referenced stylesheet does not exist.
4. Deleted legacy names such as `checkout-page.css` or `orders-buyer-page.css` are referenced again.
5. Merge conflict markers appear in CSS.

Duplicate high-risk selectors are reported as warnings, not failures, because removing them can change the rendered cascade.

## Known Non-Blocking Cleanup Targets

These selectors are intentionally left unchanged until visual regression screenshots are available:

1. `.container`
2. `.btn`, `.btn-*`
3. `.card`, `.premium-card`
4. `.main`
5. `.sidebar`
6. `.toast`, `.toast.*`

## No-Visual-Change Rule

CSS cleanup must preserve the current load order and rendered computed styles unless a visual diff review explicitly approves the change.

Preferred sequence:

1. Keep `test:css:audit` passing.
2. Capture before/after screenshots for affected pages.
3. Move one component family at a time from `shared.css`/`main.css` into `components/*`.
4. Delete old declarations only after screenshots confirm no layout or appearance drift.
