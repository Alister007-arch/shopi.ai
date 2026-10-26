# 🎨 Trovi Storefront Client

React 19 & Vite 6 frontend client for the **Trovi** conversational commerce platform.

## Architecture

- **Framework**: React 19, Vite 6
- **Routing & Code-Splitting**: Route-level dynamic imports with `React.lazy` and `React.Suspense` for heavy portals (`AdminDashboard`, `CustomerProfile`).
- **Styling**: Vanilla CSS tokens in `index.css` with a high-contrast dark green/moss palette, responsive drawer sheets, and fluid layouts.
- **Components**:
  - `Header`: Global sticky navigation, pincode selector, category chips, search bar, and auth shortcuts.
  - `Catalog`: Multi-category product grids, category filtering, search, pagination, and stock indicators.
  - `ProductDetailModal`: Modal with high-resolution WebP images, specs, organic certifications, and stock badges.
  - `CartOrdersDrawer`: Multi-step checkout drawer (Bag -> Shipping -> Payment -> Confirmation) with GST tax invoicing and order history.
  - `AIChat`: "Ask Trovi" conversational agent interface with two-step cryptographic quote tokens and interactive action cards.
  - `CustomerProfile`: Order history, real-time tracking, saved delivery addresses, and account controls.
  - `AdminDashboard`: Admin portal for catalog CRUD, category management, trace logs, and evaluation benchmarks.

## Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
npm run preview
```
