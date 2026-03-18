# dest.ink Design System

## Brand Identity

**Name:** dest.ink
**Pronunciation:** "destink" (one word) or "dest dot ink"
**Tagline:** Your content's destination.

### Layers of Meaning

| Layer | Interpretation | Emotional register |
|---|---|---|
| **de-stink** | The app refines and polishes raw research into clean, publishable content | Playful, irreverent |
| **destination + ink** | The final destination for your writing — where content lands and ships | Purposeful, directional |
| **destiny + ink** | Your writing destiny — the tool you were meant to use | Aspirational, bold |
| **distinct** | The content you produce stands apart | Confident, premium |

---

## Color System

### Philosophy

The palette is built around **warm orange** as the singular brand accent, set against a disciplined monochrome neutral scale. Orange carries energy, warmth, and creative confidence — it says "maker tool" without screaming "corporate SaaS." The neutrals are true achromatic grays (hue 0, saturation 0) so the orange pops without competition.

### Core Palette

#### Brand Orange

| Token | HSL | Hex | Usage |
|---|---|---|---|
| `orange-50` | 24 100% 96% | `#FFF5EB` | Tinted backgrounds, hover states |
| `orange-100` | 24 100% 90% | `#FFDDB8` | Light badges, subtle highlights |
| `orange-200` | 24 100% 80% | `#FFB870` | Secondary buttons, borders |
| `orange-300` | 24 100% 70% | `#FF9633` | Hover accents |
| `orange-400` | 24 100% 60% | `#FF7A0A` | Icons, interactive elements |
| `orange-500` | 24 100% 50% | `#FF6600` | **Primary — light mode** (buttons, links, focus rings) |
| `orange-600` | 24 100% 54% | `#FF7A1A` | **Primary — dark mode** (slightly lifted for contrast) |
| `orange-700` | 24 90% 42% | `#CC5500` | Pressed/active states |
| `orange-800` | 24 80% 32% | `#934000` | Dark mode hover |
| `orange-900` | 24 70% 22% | `#5F2B00` | Dark mode pressed |

#### Neutrals

| Token | Light mode | Dark mode | Usage |
|---|---|---|---|
| `background` | hsl(0 0% 98%) `#FAFAFA` | hsl(0 0% 4%) `#0A0A0A` | Page background |
| `card` | hsl(0 0% 100%) `#FFFFFF` | hsl(0 0% 7%) `#121212` | Cards, panels, modals |
| `border` | hsl(0 0% 85%) `#D9D9D9` | hsl(0 0% 15%) `#262626` | Dividers, card borders |
| `muted` | hsl(0 0% 93%) `#EDEDED` | hsl(0 0% 11%) `#1C1C1C` | Disabled backgrounds, tags |
| `muted-foreground` | hsl(0 0% 40%) `#666666` | hsl(0 0% 55%) `#8C8C8C` | Secondary text, timestamps |
| `foreground` | hsl(0 0% 8%) `#141414` | hsl(0 0% 96%) `#F5F5F5` | Body text |

#### Semantic Colors

| Token | Light | Dark | Usage |
|---|---|---|---|
| `success` | hsl(142 72% 40%) | hsl(142 72% 50%) | Published status, confirmations |
| `warning` | hsl(38 92% 50%) | hsl(38 92% 60%) | Pending states, draft alerts |
| `destructive` | hsl(0 84% 50%) | hsl(0 84% 60%) | Delete actions, errors |
| `info` | hsl(210 80% 52%) | hsl(210 80% 62%) | Research status, informational badges |

### Gradient

The brand gradient flows from warm orange to deep amber, used sparingly for hero moments and logo treatments:

```
background: linear-gradient(135deg, #FF6600 0%, #CC4400 100%);
```

Dark mode variant with a subtle glow:

```
background: linear-gradient(135deg, #FF7A1A 0%, #CC5500 100%);
box-shadow: 0 0 80px rgba(255, 122, 26, 0.08);
```

---

## Typography

### Font Stack

| Role | Font | Fallback |
|---|---|---|
| **Sans (UI)** | Geist Sans | system-ui, -apple-system, sans-serif |
| **Mono (code, brand)** | Geist Mono | ui-monospace, monospace |

### Type Scale

| Token | Size | Weight | Line height | Usage |
|---|---|---|---|---|
| `display` | 36px / 2.25rem | 700 | 1.1 | Hero headings, onboarding |
| `title` | 24px / 1.5rem | 600 | 1.25 | Page titles |
| `heading` | 18px / 1.125rem | 600 | 1.33 | Section headers, card titles |
| `body` | 14px / 0.875rem | 400 | 1.5 | Default body text |
| `body-strong` | 14px / 0.875rem | 500 | 1.5 | Emphasized body text |
| `small` | 12px / 0.75rem | 400 | 1.5 | Captions, timestamps, badges |
| `mono-brand` | 14px / 0.875rem | 600 | 1 | Brand lockup, nav title |

### Brand Wordmark Style

The "Destink" wordmark in the nav uses Geist Mono at `text-sm font-semibold tracking-widest uppercase`. This gives it a technical, tool-like presence. The dot in "dest.ink" should be rendered in the brand orange when displayed as a URL or in marketing contexts.

---

## Spacing & Layout

### Spacing Scale

Base unit: **4px**. All spacing uses multiples of 4.

| Token | Value | Common usage |
|---|---|---|
| `space-1` | 4px | Inline icon gap |
| `space-2` | 8px | Tight padding, badge insets |
| `space-3` | 12px | Input padding, small gaps |
| `space-4` | 16px | Standard padding, card insets |
| `space-5` | 20px | Nav padding, section gaps |
| `space-6` | 24px | Card padding, content gaps |
| `space-8` | 32px | Section spacing |
| `space-10` | 40px | Page-level spacing |
| `space-12` | 48px | Large section dividers |

### Layout

- **Side nav width:** 208px (w-52)
- **Content max width:** None (fluid within the remaining space)
- **Border radius:** 0.5rem (8px) — `--radius`
- **Card pattern:** White/dark surface, 1px border, 8px radius, subtle shadow in light mode

---

## Component Patterns

### Buttons

| Variant | Light mode | Dark mode |
|---|---|---|
| **Primary** | Orange-500 bg, white text | Orange-600 bg, near-black text |
| **Secondary** | Muted bg, foreground text | Muted bg, foreground text |
| **Ghost** | Transparent, foreground text, hover: muted bg | Same |
| **Destructive** | Red bg, white text | Red-600 bg, white text |

All buttons: 8px radius, 14px font, 500 weight, 36px height (default), 32px (sm), 44px (lg).

### Cards

- Background: `card` token
- Border: 1px solid `border` token
- Radius: `--radius` (8px)
- Padding: 24px
- Light mode shadow: `0 1px 3px rgba(0,0,0,0.04)`
- Dark mode shadow: none (border-only)

### Badges / Status Indicators

| Status | Light bg | Dark bg | Label |
|---|---|---|---|
| Published | green-50 | green-900/30 | "Published" |
| Draft | orange-50 | orange-900/30 | "Draft" |
| Queued | blue-50 | blue-900/30 | "Queued" |
| Failed | red-50 | red-900/30 | "Failed" |
| Research | violet-50 | violet-900/30 | "Researching" |

### Forms & Inputs

- Height: 36px
- Border: 1px solid `input` token
- Radius: 8px
- Focus ring: 2px offset, `ring` token (orange)
- Placeholder text: `muted-foreground`

---

## Iconography

- **Library:** Lucide React (already in use)
- **Size:** 16px default, 20px for nav/header icons
- **Stroke width:** 1.5px (Lucide default)
- **Color:** Inherits from text color; orange for active/selected states
- **Nav icons:** Currently using Unicode geometric shapes (keep for distinctiveness)

---

## Logo Concepts

All logos are **wordmark-free** — purely symbolic marks. The wordmark "Destink" or "dest.ink" is always rendered separately in Geist Mono.

### Concept 1: "The Distillation" (de-stink layer)

**Concept:** A funnel/filter shape where chaotic, scattered dots enter from the top and emerge as a single clean drop at the bottom. Represents raw research being distilled into polished content.

**Shape language:**
- Top: 5-7 small scattered circles of varying sizes (raw input / messy research)
- Middle: A tapered funnel form made from two converging lines or a chevron shape
- Bottom: One perfect circle or teardrop (the refined output)

**Color treatment:**
- Scattered dots: Orange-200 (faded, unrefined)
- Funnel edges: Orange-500
- Output drop: Orange-500, solid and confident
- Dark mode: Same structure, orange-600, dots at orange-300

**Variations:**
- *Minimal:* Just the converging lines and output drop, no input dots
- *Animated (for web):* Dots drift downward and merge into the single drop
- *Favicon:* The output drop alone — a single perfect circle in orange

---

### Concept 2: "The Compass Drop" (destination layer)

**Concept:** An ink drop merged with a location/destination pin. The bottom of the pin tapers to a point (like a map pin arriving at its destination), while the top has the rounded form of an ink drop. Represents content arriving at its destination.

**Shape language:**
- Rounded top half (ink drop silhouette)
- Tapered bottom point (destination pin / compass needle)
- A small negative-space circle near the top center (the "eye" of the pin, classic map pin style)

**Color treatment:**
- Fill: Solid orange-500
- Negative space circle: Cuts through to background color
- Dark mode: Orange-600 fill
- Optional: A subtle inner shadow/gradient from orange-400 at top to orange-700 at bottom, giving a sense of depth/gravity

**Variations:**
- *With ring:* A thin orange circle around the pin suggesting a "you are here" radar pulse
- *Tilted:* Pin rotated 15 degrees for dynamic energy
- *Favicon:* The pin shape works perfectly at 16x16

---

### Concept 3: "The Quill Flow" (destiny layer)

**Concept:** An abstract quill nib seen from above, drawn with a single continuous flowing stroke. The stroke starts thin, swells through the middle, and tapers off — like ink flowing from a pen onto paper. Represents the inevitable, destined act of writing.

**Shape language:**
- A single curved stroke (bezier path), thickening at center and thinning at both ends
- Slight S-curve to suggest fluid motion / flow state
- The overall silhouette resembles both a quill nib and a flowing ink stroke
- No hard angles — entirely organic

**Color treatment:**
- Stroke: Orange-500, solid
- Optional: Gradient along the stroke from orange-300 (start) to orange-600 (end) suggesting ink being laid down
- Dark mode: Orange-600 base with orange-400 gradient start

**Variations:**
- *Double stroke:* Two parallel flowing strokes suggesting content flowing to multiple channels
- *With dot:* A small perfect circle at the "pen tip" end, like ink about to drop
- *Favicon:* The S-curve stroke alone, simplified

---

### Concept 4: "The Beacon" (distinct layer)

**Concept:** A bold, geometric mark — a diamond/rhombus shape with radiating lines emanating from it, like a signal being broadcast. Represents content that stands out, that's distinct, that radiates outward from a central source.

**Shape language:**
- Center: A solid diamond (square rotated 45 degrees)
- Surrounding: 3-4 concentric partial arcs or dashes radiating outward from the diamond's corners, like a broadcast signal or a lighthouse beacon
- The arcs only extend from two opposite corners (top-right and bottom-left) to create directional energy

**Color treatment:**
- Diamond: Orange-500, solid
- Inner arcs: Orange-400
- Outer arcs: Orange-300 (fading outward)
- Dark mode: Diamond orange-600, arcs at 500/400
- The fading arcs create a natural sense of content radiating outward

**Variations:**
- *Minimal:* Diamond with a single arc on one side
- *Full signal:* Arcs on all four corners, like a full broadcast
- *Favicon:* Just the solid diamond — bold and unmistakable at small sizes

---

### Concept 5: "The Ink Circuit" (all layers unified)

**Concept:** A minimal, abstract mark that combines all four layers into one symbol. A circle (ink drop / destination dot) with a single path flowing into it from above and branching into multiple paths flowing out below. Represents the full pipeline: research flows in, gets refined, and fans out to multiple publishing destinations.

**Shape language:**
- Top: A single line flowing downward (input / research)
- Center: A solid circle (the app / the transformation point)
- Bottom: The line branches into 2-3 diverging paths below the circle (multiple publishing channels)
- The branching paths have slightly rounded ends (ink drop tips)

**Color treatment:**
- Input line: Orange-300 (raw, unprocessed)
- Center circle: Orange-500 (the core, the engine)
- Output branches: Orange-500 to orange-600 gradient (refined, published)
- Dark mode: Shift all values one stop lighter

**Variations:**
- *Asymmetric:* Input enters from top-left, outputs fan bottom-right (suggests forward motion)
- *With pulse:* A subtle ring around the center circle suggesting active processing
- *Favicon:* The center circle with tiny branch stubs — reads as a node/hub at small sizes

---

### Logo Usage Guidelines

| Context | Format | Min size |
|---|---|---|
| **Favicon** | Simplified single-shape variant | 16x16 |
| **Nav bar** | Full mark at 24x24 beside wordmark | 24x24 |
| **Social / og:image** | Mark + wordmark lockup, centered | 120x120 mark |
| **Marketing hero** | Mark only, large, with generous whitespace | 200x200+ |

**Clear space:** Minimum padding around the logo equal to the height of the center element (circle/diamond/drop).

**Don'ts:**
- Never place the mark on a busy background without sufficient contrast
- Never stretch, rotate (beyond designed tilt), or add effects
- Never use colors outside the orange palette for the mark
- Never add text inside the mark — text is always separate

---

## Motion & Interaction

### Transitions

| Property | Duration | Easing |
|---|---|---|
| Color, background, border | 150ms | ease-in-out |
| Transform (hover scale) | 200ms | ease-out |
| Opacity (fade in/out) | 200ms | ease-in-out |
| Layout (expand/collapse) | 250ms | ease-in-out |

### Hover States

- Buttons: Slight darken (light mode) or lighten (dark mode) of background
- Cards: Border color shifts to `orange-200` (light) or `orange-900` (dark)
- Links: Underline opacity from 0 to 1
- Nav items: Background shifts to `muted`, text to `foreground`

### Loading States

- Skeleton shimmer: Left-to-right gradient sweep using `muted` tones
- Spinner: Orange-500 arc on transparent circle, 0.8s rotation
- Progress bars: Orange-500 fill on `muted` track

---

## Dark Mode Strategy

Dark mode is not an inversion — it's a separate, intentional design:

- **Backgrounds go near-black**, not gray (4% lightness, not 15%)
- **Cards are barely lifted** from the background (7% vs 4%) — contrast comes from borders, not surfaces
- **Orange shifts warmer** (50% to 54% lightness) to maintain vibrancy on dark surfaces
- **Text uses 96% white**, not pure white, to reduce eye strain
- **Borders are subtle** (15% lightness) — structure without loudness
- **Shadows are removed** — borders carry all structural weight in dark mode
- **Semantic colors lift ~10% lightness** to maintain readability on dark backgrounds

---

## File Structure

```
public/
  destink-logo.svg          # Current logo (to be replaced with chosen concept)
  favicon.ico               # Simplified mark variant
  og-image.png              # Social sharing image with mark + wordmark
src/
  app/
    globals.css             # CSS custom properties (design tokens live here)
  components/
    ui/                     # shadcn/ui primitives (button, card, input, etc.)
    layout/
      SideNav.tsx           # Nav with logo mark + "DESTINK" wordmark
```
