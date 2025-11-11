# Artemis HR - UI/UX Design System & Style Guide

## Overview

The Artemis HR design system embodies **"Effortless Clarity"** - a philosophy where every interface element, interaction, and visual detail works harmoniously to make complex HR operations feel simple, intuitive, and beautiful. This guide establishes the foundation for consistent, world-class user experiences across the entire platform.

---

## Design Philosophy

### Core Principles

**1. Effortless Clarity**
- Every feature should be self-explanatory
- Reduce cognitive load through visual hierarchy
- Guide users naturally through workflows
- Make common actions prominent, advanced features discoverable

**2. Apple-Inspired Minimalism**
- Clean, uncluttered interfaces
- Generous whitespace as a feature, not a bug
- Focus on content, remove unnecessary decoration
- Quality over quantity in every visual element

**3. Human-Centered Design**
- Design for the user's goals, not system constraints
- Provide context and feedback at every step
- Anticipate user needs and surface relevant actions
- Make errors recoverable and informative

**4. Consistent & Predictable**
- Same patterns solve similar problems
- Interface elements behave as expected
- Muscle memory accelerates productivity
- Reduce learning curve across modules

---

## Visual Design System

### Color Palette

#### Primary Colors

**Brand Orange (Primary Action)**
```
Primary:       #FF6B00  (rgb: 255, 107, 0)
Hover:         #E55F00  (darker 10%)
Active:        #CC5400  (darker 20%)
Disabled:      #FFB380  (lighter 50%, reduced opacity)
```
**Use for:** Primary CTAs, selected states, key actions, brand elements

**Charcoal (Primary Text)**
```
Dark:          #212529  (headings, important text)
Medium:        #495057  (body text)
Light:         #6C757D  (secondary text, labels)
Muted:         #ADB5BD  (hints, disabled text)
```

#### Background & Surface Colors

**Light Theme (Default)**
```
Page Background:   #F8F9FA  (off-white, reduces eye strain)
Surface/Card:      #FFFFFF  (pure white for elevated elements)
Border:            #DEE2E6  (subtle gray for dividers)
Hover Background:  #F1F3F5  (slightly darker for interactive states)
```

**Dark Theme**
```
Page Background:   #1A1D20  (near black)
Surface/Card:      #2D3135  (elevated surface)
Border:            #3D4145  (subtle contrast)
Hover Background:  #35383C  (lighter for interaction)
Text:              #E8EAED  (off-white for readability)
Text Secondary:    #9AA0A6  (muted gray)
```

#### Semantic Colors

**Success (Green)**
```
Success:       #28A745  (approved, completed, positive)
Success Light: #D4EDDA  (background for success messages)
Success Dark:  #155724  (text on light background)
```

**Warning (Yellow)**
```
Warning:       #FFC107  (at risk, needs attention)
Warning Light: #FFF3CD  (background)
Warning Dark:  #856404  (text)
```

**Error (Red)**
```
Error:         #DC3545  (rejected, failed, destructive)
Error Light:   #F8D7DA  (background)
Error Dark:    #721C24  (text)
```

**Info (Blue)**
```
Info:          #17A2B8  (informational, neutral)
Info Light:    #D1ECF1  (background)
Info Dark:     #0C5460  (text)
```

#### Status Colors

```
Active/Online:     #28A745  (green dot)
Away/Idle:         #FFC107  (yellow dot)
Offline/Inactive:  #6C757D  (gray dot)
On Leave:          #17A2B8  (blue dot)
Busy:              #DC3545  (red dot)
```

### Typography

#### Font Family

**Primary Font: Inter**
- Modern, highly legible sans-serif
- Excellent for UI and body text
- Wide range of weights (300-900)
- Open source and web-optimized

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 
             'Roboto', 'Helvetica', 'Arial', sans-serif;
```

#### Font Scales

**Desktop Scale**
```
Display (Hero):    4rem (64px) - Landing page headlines
H1 (Page Title):   2.5rem (40px) - Main page headings
H2 (Section):      2rem (32px) - Major sections
H3 (Subsection):   1.5rem (24px) - Cards, panels
H4 (Component):    1.25rem (20px) - Small headings
Body Large:        1.125rem (18px) - Intro paragraphs
Body:              1rem (16px) - Standard text
Body Small:        0.875rem (14px) - Captions, metadata
Caption:           0.75rem (12px) - Timestamps, labels
```

**Mobile Scale (Slightly Reduced)**
```
H1: 2rem (32px)
H2: 1.75rem (28px)
H3: 1.25rem (20px)
Body: 1rem (16px)
```

#### Font Weights

```
Light:     300  (rarely used, decorative only)
Regular:   400  (body text, labels)
Medium:    500  (emphasized text, tab labels)
Semibold:  600  (button text, important labels)
Bold:      700  (headings, strong emphasis)
Extrabold: 800  (rare, for impactful headlines)
```

#### Line Height

```
Headings:  1.2   (tight for visual impact)
Body:      1.6   (comfortable reading)
Caption:   1.4   (compact for small text)
Buttons:   1     (centered, no extra space)
```

#### Text Styles

**Heading Style**
```css
.heading {
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;  /* Slight tightening for large text */
  color: #212529;
}
```

**Body Text Style**
```css
.body-text {
  font-weight: 400;
  line-height: 1.6;
  color: #495057;
  max-width: 65ch;  /* Optimal reading width */
}
```

**Label Style**
```css
.label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #6C757D;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  line-height: 1.4;
}
```

---

## Layout & Spacing

### Grid System

**12-Column Responsive Grid**
```
Container Max Width: 1200px (centered)
Column Gutter: 24px
Breakpoints:
  - xs: 0px (mobile)
  - sm: 640px (tablet)
  - md: 768px (tablet landscape)
  - lg: 1024px (desktop)
  - xl: 1280px (large desktop)
```

### Spacing Scale (8px Base Unit)

**Use multiples of 8 for consistency:**
```
0:    0px
1:    4px   (0.25rem) - Micro spacing
2:    8px   (0.5rem)  - Tight spacing
3:    12px  (0.75rem) - Small spacing
4:    16px  (1rem)    - Standard spacing
5:    20px  (1.25rem) - Comfortable spacing
6:    24px  (1.5rem)  - Section spacing
8:    32px  (2rem)    - Large spacing
10:   40px  (2.5rem)  - Extra large spacing
12:   48px  (3rem)    - Huge spacing
16:   64px  (4rem)    - Section separator
20:   80px  (5rem)    - Major section separator
```

**Component Padding**
```
Cards:        padding: 24px (1.5rem)
Buttons:      padding: 12px 24px (0.75rem 1.5rem)
Input Fields: padding: 12px 16px (0.75rem 1rem)
Modals:       padding: 32px (2rem)
Page Container: padding: 40px (2.5rem)
```

**Component Spacing**
```
Between cards:       24px
Between form fields: 16px
Between sections:    48px
Between paragraphs:  16px
```

### Whitespace Philosophy

**"Breathing Room Multiplier"**
- When in doubt, add more whitespace
- Minimum 24px between unrelated elements
- Use whitespace to create visual grouping
- Empty space is a design element, not wasted space

---

## Component Design

### Border Radius

**Consistent Rounding for Softness**
```
Small:   0.375rem (6px)  - Tags, badges
Medium:  0.5rem (8px)    - Buttons, small cards
Large:   0.75rem (12px)  - Cards, panels (PRIMARY)
XLarge:  1rem (16px)     - Modals, large surfaces
Full:    9999px          - Pills, avatars
```

**Default for most components: 12px (0.75rem)**

### Shadows

**Elevation System (5 Levels)**

```css
/* Level 0: Flat (no shadow) */
box-shadow: none;

/* Level 1: Subtle (Cards, Inputs) */
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 
            0 1px 2px rgba(0, 0, 0, 0.06);

/* Level 2: Raised (Dropdowns, Tooltips) */
box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07), 
            0 2px 4px rgba(0, 0, 0, 0.06);

/* Level 3: Floating (Modals, Slide-overs) */
box-shadow: 0 10px 15px rgba(0, 0, 0, 0.08), 
            0 4px 6px rgba(0, 0, 0, 0.05);

/* Level 4: Prominent (Important Dialogs) */
box-shadow: 0 20px 25px rgba(0, 0, 0, 0.1), 
            0 10px 10px rgba(0, 0, 0, 0.04);
```

**Use shadows sparingly:**
- Cards on page background: Level 1
- Dropdown menus: Level 2
- Modals: Level 3
- Critical alerts: Level 4

---

## Interactive Elements

### Buttons

#### Primary Button
```css
.button-primary {
  background: #FF6B00;
  color: #FFFFFF;
  border: none;
  border-radius: 0.75rem;
  padding: 12px 24px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}

.button-primary:hover {
  background: #E55F00;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 107, 0, 0.3);
}

.button-primary:active {
  background: #CC5400;
  transform: translateY(0);
}
```

#### Secondary Button (Ghost)
```css
.button-secondary {
  background: transparent;
  color: #495057;
  border: 2px solid #DEE2E6;
  border-radius: 0.75rem;
  padding: 10px 22px;  /* Slightly less to account for border */
  font-weight: 600;
  transition: all 0.2s ease-in-out;
}

.button-secondary:hover {
  border-color: #FF6B00;
  color: #FF6B00;
  background: rgba(255, 107, 0, 0.05);
}
```

#### Destructive Button
```css
.button-destructive {
  background: #DC3545;
  color: #FFFFFF;
  /* Same structure as primary */
}
```

#### Button Sizes
```
Small:  padding: 8px 16px; font-size: 0.875rem;
Medium: padding: 12px 24px; font-size: 1rem; (DEFAULT)
Large:  padding: 16px 32px; font-size: 1.125rem;
```

### Form Inputs

#### Text Input
```css
.input-field {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #DEE2E6;
  border-radius: 0.75rem;
  font-size: 1rem;
  color: #212529;
  background: #FFFFFF;
  transition: all 0.2s ease-in-out;
}

.input-field:focus {
  outline: none;
  border-color: #FF6B00;
  box-shadow: 0 0 0 3px rgba(255, 107, 0, 0.1);
}

.input-field::placeholder {
  color: #ADB5BD;
}

.input-field:disabled {
  background: #F1F3F5;
  color: #6C757D;
  cursor: not-allowed;
}
```

#### Input with Icon
```html
<div class="input-wrapper">
  <svg class="input-icon">...</svg>
  <input class="input-field input-with-icon" />
</div>

.input-with-icon {
  padding-left: 44px;  /* Space for icon */
}

.input-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #6C757D;
}
```

### Dropdowns & Selects

```css
.select-field {
  appearance: none;
  /* Same base styles as input */
  background-image: url("data:image/svg+xml,..."); /* Custom arrow */
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 40px;
}
```

### Checkboxes & Radio Buttons

**Custom styled for brand consistency:**
```css
.checkbox {
  width: 20px;
  height: 20px;
  border: 2px solid #DEE2E6;
  border-radius: 0.375rem;
  cursor: pointer;
}

.checkbox:checked {
  background: #FF6B00;
  border-color: #FF6B00;
  /* SVG checkmark */
}
```

### Toggle Switches

```css
.toggle {
  width: 44px;
  height: 24px;
  background: #DEE2E6;
  border-radius: 12px;
  position: relative;
  cursor: pointer;
  transition: background 0.3s;
}

.toggle.active {
  background: #FF6B00;
}

.toggle-handle {
  width: 20px;
  height: 20px;
  background: #FFFFFF;
  border-radius: 50%;
  position: absolute;
  left: 2px;
  top: 2px;
  transition: transform 0.3s;
}

.toggle.active .toggle-handle {
  transform: translateX(20px);
}
```

---

## Advanced UI Patterns

### Frosted Glass Effect

**Used for overlays, modals, and hover states:**

```css
.glass-overlay {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}

/* Dark theme variant */
.glass-overlay-dark {
  background: rgba(45, 49, 53, 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

**Use cases:**
- Modal backgrounds
- Slide-over panels
- Hover state on feature cards
- "Coming Soon" overlays
- Context menus

### Cards

**Standard Card**
```css
.card {
  background: #FFFFFF;
  border-radius: 0.75rem;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease-in-out;
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}
```

**Interactive Card (clickable)**
```css
.card-interactive {
  cursor: pointer;
  border: 2px solid transparent;
}

.card-interactive:hover {
  border-color: #FF6B00;
}
```

### Bento Grid Layout

**Asymmetrical, dynamic card layouts:**

```css
.bento-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  grid-auto-rows: minmax(150px, auto);
}

/* Span variations */
.bento-span-2 {
  grid-column: span 2;
}

.bento-tall {
  grid-row: span 2;
}
```

**Example pattern:**
- Top-left card spans 2 columns (featured)
- Top-right single column
- Bottom row: 3 equal cards
- Creates visual interest and hierarchy

### Slide-Over Panel

**Right-side panel for forms and details:**

```css
.slide-over {
  position: fixed;
  right: 0;
  top: 0;
  height: 100vh;
  width: 60vw;
  max-width: 600px;
  background: #FFFFFF;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
  transform: translateX(100%);
  transition: transform 0.3s ease-in-out;
  z-index: 1000;
}

.slide-over.open {
  transform: translateX(0);
}
```

**Use for:**
- Adding/editing employees
- Configuring settings
- Viewing detailed information
- Multi-step forms

### Modals

**Centered dialog:**

```css
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 999;
}

.modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #FFFFFF;
  border-radius: 1rem;
  padding: 32px;
  max-width: 500px;
  width: 90vw;
  box-shadow: 0 20px 25px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}
```

**Size variants:**
- Small: 400px (confirmations)
- Medium: 600px (forms)
- Large: 800px (complex content)
- Full-screen: 95vw x 95vh (detailed views)

---

## Animations & Transitions

### Timing Functions

```css
/* Standard easing (most common) */
transition-timing-function: cubic-bezier(0.4, 0.0, 0.2, 1);

/* Ease-out (entering elements) */
transition-timing-function: cubic-bezier(0.0, 0.0, 0.2, 1);

/* Ease-in (exiting elements) */
transition-timing-function: cubic-bezier(0.4, 0.0, 1, 1);
```

### Duration Guidelines

```
Micro (hover, focus):    150ms
Quick (dropdowns):       200ms
Standard (modals):       300ms
Smooth (page transitions): 500ms
Slow (emphasis):         700ms
```

### Common Animations

**Fade In**
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.fade-in {
  animation: fadeIn 300ms ease-out;
}
```

**Slide Up**
```css
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.slide-up {
  animation: slideUp 400ms ease-out;
}
```

**Scale In**
```css
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.scale-in {
  animation: scaleIn 300ms ease-out;
}
```

**Loading Spinner**
```css
@keyframes spin {
  to { transform: rotate(360deg); }
}

.spinner {
  animation: spin 1s linear infinite;
}
```

---

## Responsive Design

### Mobile-First Approach

**Start with mobile, enhance for desktop:**

```css
/* Mobile (default) */
.container {
  padding: 16px;
}

/* Tablet and up */
@media (min-width: 768px) {
  .container {
    padding: 24px;
  }
}

/* Desktop and up */
@media (min-width: 1024px) {
  .container {
    padding: 40px;
  }
}
```

### Breakpoint Strategy

```
Mobile:     < 640px   (Single column, stacked)
Tablet:     640-1023px (2 columns, simplified)
Desktop:    >= 1024px  (Full layout, all features)
```

### Touch Targets

**Minimum 44x44px for touch:**
```css
.touch-target {
  min-height: 44px;
  min-width: 44px;
  padding: 12px;  /* Ensures sufficient tap area */
}
```

---

## Iconography

### Icon System

**Use: Lucide Icons (or similar minimal line-art set)**
- Consistent 24x24px base size
- 2px stroke width
- Rounded line caps
- Minimal detail

**Icon Sizes:**
```
XSmall:  16px (inline with small text)
Small:   20px (buttons, form labels)
Medium:  24px (standard UI) (DEFAULT)
Large:   32px (cards, feature highlights)
XLarge:  48px (empty states, placeholders)
Huge:    64px (hero sections)
```

**Icon Colors:**
```
Default:    #6C757D (medium gray)
Active:     #FF6B00 (brand orange)
Success:    #28A745 (green)
Warning:    #FFC107 (yellow)
Error:      #DC3545 (red)
Disabled:   #ADB5BD (light gray)
```

---

## Status Indicators

### Badges

```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 9999px;  /* Full pill shape */
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge-success {
  background: #D4EDDA;
  color: #155724;
}

.badge-warning {
  background: #FFF3CD;
  color: #856404;
}

.badge-error {
  background: #F8D7DA;
  color: #721C24;
}

.badge-info {
  background: #D1ECF1;
  color: #0C5460;
}
```

### Status Dots

```css
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 6px;
}

.status-active { background: #28A745; }
.status-away { background: #FFC107; }
.status-offline { background: #6C757D; }
```

### Progress Bars

```css
.progress-bar {
  height: 8px;
  background: #F1F3F5;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #FF6B00, #FFA500);
  border-radius: 4px;
  transition: width 0.5s ease-out;
}
```

---

## Data Visualization

### Chart Colors

**Use color intentionally, not decoratively:**

```
Primary Series:   #FF6B00, #0066CC, #28A745, #FFC107, #DC3545
Extended Palette: Use HSL variations for more series
Neutral:          #6C757D (for non-data elements like axes)
```

**Accessibility:**
- Never rely on color alone
- Use patterns, labels, or shapes in addition
- Test with colorblind simulation tools

### Tables

```css
.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  text-align: left;
  font-weight: 600;
  font-size: 0.875rem;
  color: #6C757D;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 12px 16px;
  border-bottom: 2px solid #DEE2E6;
}

.data-table td {
  padding: 16px;
  border-bottom: 1px solid #F1F3F5;
}

.data-table tr:hover {
  background: #F8F9FA;
}
```

---

## Accessibility

### Focus States

**Always visible and clear:**

```css
*:focus {
  outline: 3px solid #FF6B00;
  outline-offset: 2px;
}

/* For elements with custom focus styles */
.custom-focus:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(255, 107, 0, 0.3);
}
```

### Color Contrast

**WCAG AA Minimum (4.5:1 for body text, 3:1 for large text)**
- All text passes contrast checks
- Interactive elements have clear states
- Test with browser dev tools or online checkers

### Screen Reader Support

```html
<!-- Use semantic HTML -->
<button aria-label="Close modal">×</button>

<!-- Provide context -->
<nav aria-label="Main navigation">...</nav>

<!-- State communication -->
<button aria-pressed="true">Active</button>
<div aria-live="polite">Status updated</div>
```

### Keyboard Navigation

**All interactive elements must be keyboard accessible:**
- Tab order follows visual flow
- Enter/Space activates buttons
- Escape closes modals
- Arrow keys navigate lists
- Focus visible at all times

---

## Implementation Checklist

### Before You Code

- [ ] Review this style guide completely
- [ ] Set up design tokens (CSS variables)
- [ ] Install Inter font
- [ ] Configure Tailwind CSS (or CSS-in-JS) with theme
- [ ] Create component library structure

### Component Development

- [ ] Use consistent naming (BEM or similar)
- [ ] Build mobile-first
- [ ] Test in light and dark themes
- [ ] Verify keyboard navigation
- [ ] Test with screen reader
- [ ] Check color contrast
- [ ] Optimize for performance (lazy load, code split)

### Quality Assurance

- [ ] Visual regression testing
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Responsive testing (mobile, tablet, desktop)
- [ ] Accessibility audit (WAVE, aXe)
- [ ] Performance audit (Lighthouse)

---

## Resources & Tools

### Design Tools
- **Figma**: For mockups and prototypes
- **Contrast Checker**: WebAIM Contrast Checker
- **Color Palette**: Coolors, Adobe Color

### Development Tools
- **Tailwind CSS**: Utility-first CSS framework (recommended)
- **shadcn/ui**: Accessible component library
- **Radix UI**: Headless UI primitives
- **Lucide Icons**: Icon library

### Testing Tools
- **axe DevTools**: Accessibility testing
- **WAVE**: Web accessibility evaluation
- **Lighthouse**: Performance and accessibility audits
- **Percy**: Visual regression testing

---

## Version History

- **v1.0** (2025-10-28) - Initial release
- Future updates will be versioned and documented here

---

## Questions & Support

For design system questions, clarifications, or suggestions:
- Review module-specific UI/UX sections
- Consult with design lead
- Reference component examples in Figma

**Remember:** Consistency is more important than perfection. When in doubt, follow established patterns.