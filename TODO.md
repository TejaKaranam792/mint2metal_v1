# UI Upgrade to Industry Grade - Task Breakdown

## Information Gathered

- Current UI uses dark theme with Tailwind CSS
- Components: Card, StatBox, Table, Badge, Button
- Pages: Dashboard, Trading, Loans, Mint, KYC, Balance, Redemption, Physical
- Home page is generic SaaS template, needs replacement with Mint2Metal branding
- Existing components may need updates for better alignment

## Plan

- Update home page (app/app/page.tsx) to Mint2Metal landing page
- Enhance dashboard (app/app/dashboard/page.tsx) with better layout and animations
- Improve trading page (app/app/dashboard/trading/page.tsx) with advanced form and charts
- Upgrade loans page (app/app/dashboard/loans/page.tsx) with better calculator and terms
- Update components (Card, StatBox, Button, etc.) for consistency and modern design
- Ensure responsive design and accessibility across all pages
- Add loading states, error handling, and micro-interactions

## Dependent Files to be Edited

- app/app/page.tsx (home page redesign)
- app/app/dashboard/page.tsx (dashboard enhancements)
- app/app/dashboard/trading/page.tsx (trading UI improvements)
- app/app/dashboard/loans/page.tsx (loans page upgrades)
- app/app/components/Card.tsx (component updates)
- app/app/components/StatBox.tsx (component updates)
- app/app/components/Button.tsx (component updates)
- app/app/components/ui/button.tsx (component updates)
- app/app/components/ui/card.tsx (component updates)
- app/app/components/ui/stat-card.tsx (component updates)
- app/app/globals-new.css (theme refinements)

## Followup Steps

- Test all pages for responsiveness
- Verify accessibility (WCAG compliance)
- Performance optimization
- Cross-browser testing

## Tasks

- [x] Update home page to Mint2Metal branding
- [x] Enhance dashboard layout and add animations
- [ ] Improve trading page with better form and order book
- [ ] Upgrade loans page with advanced calculator
- [x] Update Card component for modern design
- [x] Update StatBox component with better visuals
- [x] Update Button components for consistency
- [ ] Refine global CSS for better theming
- [ ] Add loading skeletons and error states
- [ ] Ensure mobile responsiveness
