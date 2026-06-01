# AuDHD Design Rules — W3C & Research-Backed

> Sources: W3C WCAG 2.2, UX Bulletin (2024), original AuDHD research document, ZENDS design system

## Core Principles

### 1. Flexibility and Customization
- Allow users to adjust font sizes, color contrast, and interface complexity
- Offer "choose-your-own-adventure" layouts — let users configure what works
- Every sensory preference (reduced motion, high contrast, dark/light) must be respected

### 2. Predictable and Consistent Navigation
- No sudden pop-ups, no surprise modals, no auto-playing content
- Breadcrumb trail approach — users always know where they are
- Same action always in the same place (WCAG 3.2: Predictable)
- Avoid nesting menus more than 2 levels deep

### 3. Minimal Sensory Overload
- No flashing animations (>3 flashes/second triggers epilepsy — WCAG 2.3)
- No autoplay video or audio
- Respect `prefers-reduced-motion: reduce` — disable all animation when set
- Keep transitions smooth and subtle (<300ms)
- Only animate one thing at a time

### 4. Clear and Simple Language
- Hemingway > Shakespeare: short sentences, common words, no jargon
- Labels should describe the destination, not the journey ("Buy Now" > "Proceed to Checkout")
- Break content into digestible chunks (max 3-4 paragraphs per section)
- Use friendly, conversational tone — never corporate or robotic

### 5. Visual Consistency and Balance
- Same colors for same functions across the entire app
- Embrace the grid: balanced layouts reduce decision fatigue
- Symmetry where possible, predictable asymmetry where not
- Consistent spacing (1:8 proportion system) throughout

### 6. Visible Focus and Error Prevention
- Clear focus indicators on all interactive elements (WCAG 2.4.7)
- Error messages must explain WHAT went wrong and HOW to fix it
- Gentle error recovery: undo, confirm before destructive actions
- No shame-based messaging — never blame the user

### 7. Typography and Readability
- Use easily readable fonts (system fonts, sans-serif)
- Minimum 16px body text, no text smaller than 12px
- Line-height of 1.5 minimum, generous paragraph spacing
- Allow users to override text size without breaking layout

### 8. Color and Contrast
- WCAG AA minimum: 4.5:1 for normal text, 3:1 for large/UI elements
- Calming, muted palette — avoid aggressive high-saturation colors
- Don't rely solely on color to convey information (WCAG 1.4.1)
- Dark mode must have the same information hierarchy as light mode

### 9. Progressive Disclosure
- Show only what's needed at each step
- Hide complexity behind intentional reveals
- Default to the simplest view, let users opt into complexity
- Never overwhelm the default view with all options at once

### 10. User Control
- Give users control over animations, sounds, and visual density
- Provide escape routes from every interaction
- Support keyboard navigation for all actions
- Save user preferences across sessions

## Testing Checklist (per W3C WCAG)

- [ ] All images have alt text
- [ ] Color is never the sole indicator of state
- [ ] Focus order matches visual order
- [ ] All interactive elements are keyboard-accessible
- [ ] No content flashes more than 3 times/second
- [ ] Error messages are descriptive and actionable
- [ ] Page can be zoomed to 200% without breaking
- [ ] `prefers-reduced-motion` is respected
- [ ] `prefers-color-scheme` is respected
- [ ] All form inputs have visible labels

## Niki Compliance Status

| Rule | Status | Notes |
|---|---|---|
| No auto-play/sudden movement | ✓ | No autoplay anywhere |
| Predictable navigation | ✓ | Sidebar nav consistent on all views |
| Min sensory overload | ✓ | Subtle animations, all respect reduced motion |
| Simple language | ✓ | Hemingway-style microcopy throughout |
| Visible focus | ✓ | Orange focus ring on all interactive elements |
| Gentle error recovery | ✓ | Undo toast, archive instead of delete |
| Font/spacing customizable | ○ | 1:8 system provides good defaults, but no user-facing font/contrast controls yet |
| Test with neurodivergent users | ○ | Not yet done |
| Dark mode | ✓ | Theme toggle with full dark palette |

---

## Additional Insights — Medium (2024)

**Key additions from the Medium article:**

- **Avoid justified text** — always left-align for predictable spacing (helps dyslexic readers)
- **Offer font options** — OpenDyslexic, Arial, Verdana as accessible typeface choices
- **Multiple task completion paths** — keyboard shortcuts, voice commands, gesture-based where possible
- **Allow view mode switching** — minimalist vs detailed view toggle
- **Balance simplicity with functionality** — don't oversimplify to the point of losing depth
- **Don't stereotype** — base decisions on research and user feedback, not assumptions
- **Diverse testing** — neurodivergent users are underrepresented; actively recruit them for testing
- **Inclusive design benefits all users** — designing for neurodivergence improves UX for everyone
