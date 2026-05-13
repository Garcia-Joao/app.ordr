# ORDR redesign branch

This branch should be treated as a frontend architecture redesign, not as a sequence of visual patches.

## Rules for the redesign

1. Every page should be wrapped with `AppPage`.
2. Every section/card should use `Surface` and `SurfaceHeader` instead of custom card markup.
3. Desktop and mobile must be designed together. Desktop gets dense split views; mobile gets step flows, bottom sheets, and full-screen drawers.
4. Avoid huge mobile modals for complex flows. Use multi-step flows for PDV, PDV Interno, products, stock and events.
5. Keep Next.js + React. Angular would be a rewrite, not a redesign.

## First components added

- `components/redesign/app-page.tsx`
- `components/redesign/surface.tsx`
- `components/redesign/stat-card.tsx`
- `components/redesign/empty-state.tsx`

## Suggested migration order

1. AppShell, Sidebar, Toolbar and MobileBottomNav.
2. PDV and PDV Interno flows.
3. Cadastro pages: clientes, pessoas, produtos/categorias, eventos.
4. Operational pages: estoque, compras, fornecedores.
5. System pages: impressoras, dispositivos, acessos, auditoria, configurações.
