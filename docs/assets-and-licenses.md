# 📜 Assets, Media & Typography Licenses

This document details the licensing, provenance, and attribution for all external fonts, image sets, media, and design assets utilized across the **Trovi** platform.

---

## 1. Typography & Web Fonts

All fonts used in the Trovi storefront are open-source web fonts hosted via Google Fonts CDN under permissive open licenses.

| Font Family | Author / Foundry | Use Case | License | Link |
|---|---|---|---|---|
| **Plus Jakarta Sans** | Tokotype (Gumpita Rahayu) | Primary brand typography, UI headings, action buttons | [SIL Open Font License 1.1](https://openfontlicense.org) | [Google Fonts](https://fonts.google.com/specimen/Plus+Jakarta+Sans) |
| **Playfair Display** | Claus Eggers Sørensen | Editorial headings, luxury collection titles, accents | [SIL Open Font License 1.1](https://openfontlicense.org) | [Google Fonts](https://fonts.google.com/specimen/Playfair+Display) |
| **Inter** | Rasmus Andersson | Body copy, technical specifications, data tables, metrics | [SIL Open Font License 1.1](https://openfontlicense.org) | [Google Fonts](https://fonts.google.com/specimen/Inter) |
| **Outfit** | Outfit (Brenden Edwards) | Feature badges, conversational assistant captions | [SIL Open Font License 1.1](https://openfontlicense.org) | [Google Fonts](https://fonts.google.com/specimen/Outfit) |

---

## 2. Iconography & Visual UI Libraries

| Package | Purpose | License | Repository |
|---|---|---|---|
| **Lucide Icons** (`lucide-react`) | Standard UI iconography across storefront, cart, drawer, and admin | [ISC License](https://opensource.org/licenses/ISC) | [lucide-icons/lucide](https://github.com/lucide-icons/lucide) |
| **Canvas Confetti** (`canvas-confetti`) | Celebration effects upon order checkout completion | [ISC License](https://opensource.org/licenses/ISC) | [catdad/canvas-confetti](https://github.com/catdad/canvas-confetti) |

---

## 3. Product Catalog Images (`frontend/public/products/*.webp`)

The Trovi catalog features 136 tailored product images spanning 7 departments:
1. **Grocery & MOSS Organics** (raw honey, cold-pressed oils, organic grains, sourdough, spices)
2. **Fashion & Apparel** (handcrafted khadi kurta, pure silk scarves, organic cotton tees, linen shirts)
3. **Electronics & Audio** (ANC headphones, wireless earbuds, smart speakers, mechanical keyboards)
4. **Laptops & Computing** (high-performance workstations, ultrabooks, devbooks, 4K monitors)
5. **Home & Kitchen** (cast iron cookware, ceramic dining sets, brass espresso makers, cold brew carafes)
6. **Personal Care** (herbal ayurvedic hair oils, botanical cleansers, organic face serums)
7. **Luxury & Horology** (automatic chronographs, diver timepieces, leather briefcases, sunglasses)

### Provenance & Licensing:
- **Primary Source**: Photography from [Unsplash](https://unsplash.com) contributed by creators worldwide under the **Unsplash License**.
- **Unsplash License Grant**: Images are free for commercial and non-commercial use, modification, and display without mandatory attribution.
- **Image Optimization**: All 136 original source JPEG images have been converted to modern `.webp` format at high quality, reducing payload size by over 65% while maintaining visual fidelity for sub-second Largest Contentful Paint (LCP).

---

## 4. Visual Search Sample Resources

| File | Location | Purpose | License |
|---|---|---|---|
| `elephant.png` | `backend/resources/`, `frontend/public/resources/` | Visual search rejection test (animal / non-catalog entity) | CC0 1.0 Universal Public Domain |
| `honey.png` | `backend/resources/`, `frontend/public/resources/` | Multi-category visual search demo asset | Unsplash License / CC0 |
| `oats.png` | `backend/resources/`, `frontend/public/resources/` | Multi-category visual search demo asset | Unsplash License / CC0 |

---

## 5. Software Source Code License

The Trovi platform codebase (FastAPI backend, React 19 storefront, LangGraph workflows, evaluation suites) is released under the **MIT License**:

```text
MIT License

Copyright (c) 2026 Divyanshu Kashyap

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
...
```
See the root [LICENSE](../LICENSE) file for the complete text.
