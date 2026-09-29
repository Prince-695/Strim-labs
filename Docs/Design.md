---
version: alpha
name: Dribbble Modern
description: A bright, editorial marketplace system with soft surfaces, bold typography, and playful accent color.
colors:
  primary: "#0D0C22"
  secondary: "#6E6D7A"
  tertiary: "#F4F4F6"
  neutral: "#E7E7E9"
  surface: "#FFFFFF"
  on-surface: "#0D0C22"
  accent: "#FFAD48"
  error: "#E5484D"
  brand-pink: "#EA4C89"
  brand-lime: "#CDE36B"
  brand-blush: "#FFF1F7"
  brand-border: "#E5E7EB"
typography:
  headline-display:
    fontFamily: "Mona Sans, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: 52px
    fontWeight: 600
    lineHeight: 62.4px
    letterSpacing: 0px
  headline-lg:
    fontFamily: "Mona Sans, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: 40px
    fontWeight: 600
    lineHeight: 48px
    letterSpacing: 0px
  headline-md:
    fontFamily: "Mona Sans, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: 24px
    fontWeight: 600
    lineHeight: 29px
    letterSpacing: 0px
  headline-sm:
    fontFamily: "Mona Sans, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 24px
    letterSpacing: 0px
  headline-xs:
    fontFamily: "Mona Sans, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 22px
    letterSpacing: 0px
  body-lg:
    fontFamily: "Mona Sans, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: 16px
    fontWeight: 500
    lineHeight: 24px
    letterSpacing: 0px
  body-md:
    fontFamily: "Mona Sans, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 19.6px
    letterSpacing: 0px
  body-sm:
    fontFamily: "Mona Sans, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
    letterSpacing: 0px
  label-lg:
    fontFamily: "Mona Sans, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: 14px
    fontWeight: 700
    lineHeight: 16px
    letterSpacing: 0px
  label-md:
    fontFamily: "Mona Sans, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: 12px
    fontWeight: 700
    lineHeight: 14px
    letterSpacing: 0px
  label-sm:
    fontFamily: "Mona Sans, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 14px
    letterSpacing: 0px
  caption:
    fontFamily: "Mona Sans, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: 11px
    fontWeight: 500
    lineHeight: 14px
    letterSpacing: 0px
rounded:
  none: 0px
  sm: 4px
  md: 8px
  lg: 16px
  xl: 24px
  full: 9999px
spacing:
  xs: 12px
  sm: 20px
  md: 34px
  lg: 60px
  xl: 128px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 0px 16px
    height: 32px
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 0px 16px
    height: 32px
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 0px 16px
    height: 32px
  button-tertiary:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    padding: 0px
    height: 24px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 16px
  input:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.full}"
    padding: 16px
    height: 56px
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 0px 14px
    height: 32px
  banner:
    backgroundColor: "{colors.brand-blush}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.full}"
    padding: 12px 16px
  pill-tab:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.secondary}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 0px 18px
    height: 40px
---

# Dribbble Modern

## Overview
Dribbble feels energetic, polished, and creator-first: a marketplace UI designed to showcase visual work while keeping commerce and discovery easy. The tone is professional but playful, with bright accent moments, rounded controls, and strong contrast between a dark brand voice and a clean white canvas. Spacing is generous and the layout is airy, helping dense content feel approachable.

## Colors
- **Primary (#0D0C22):** The deep ink used for headlines, primary navigation, and high-contrast interactive elements. It gives the interface its confident, premium core.
- **Secondary (#6E6D7A):** A muted slate for supportive text, metadata, and quieter navigation states. It keeps hierarchy readable without competing with the main content.
- **Surface (#FFFFFF):** The dominant page and component background, creating a bright gallery-like stage for creative work.
- **Tertiary (#F4F4F6):** A soft cool gray used for input fields, subtle pills, and low-emphasis surfaces. It provides separation without heavy borders.
- **Neutral (#E7E7E9):** The light border and divider tone used around buttons, chips, and cards. It maintains structure while preserving the lightweight feel.
- **Accent (#FFAD48):** A warm gold accent for attention-grabbing moments when energy or reward needs emphasis.
- **Brand Pink (#EA4C89):** The signature lively pink used in active states, highlights, and promotional moments. It adds the playful Dribbble character.
- **Brand Lime (#CDE36B):** A fresh, optimistic highlight color seen in featured artwork and promotional framing.
- **Brand Blush (#FFF1F7):** A very soft pink-tinted background for banners and friendly callouts.
- **Error (#E5484D):** A clear alert color for destructive or invalid states, kept separate from the brand accent.

## Typography
Mona Sans is the defining typeface, with Helvetica Neue, Helvetica, Arial, and sans-serif as fallbacks. Headlines use 600 weight for a bold but friendly editorial feel, while body copy stays medium-weight for clarity and easy scanning. The system relies on a tight, modern scale: large display headlines for landing sections, medium headlines for modular content, and compact labels for controls, chips, and buttons. Letter spacing is neutral and uppercase styling is restrained, so emphasis comes from weight, size, and color rather than aggressive casing.

## Layout
The layout is fluid and spacious, with wide outer margins and a centered content rhythm that supports both hero storytelling and dense discovery sections. Sections separate with generous vertical gaps using the 12px/20px/34px/60px/128px scale, which creates a clear progression from compact controls to expansive marketing areas. Cards and chips use compact internal padding, while larger panels and hero modules breathe with substantial surrounding whitespace. Rounded search bars, tab pills, and banner containers help unify the interface across different densities.

## Elevation & Depth
Depth is intentionally restrained. Most hierarchy comes from contrast, color blocks, and borders rather than dramatic shadows. Where shadows appear, they are subtle and functional, supporting floating or layered elements without making the UI feel heavy. This flat, polished treatment keeps the page feeling modern and content-first.

## Shapes
The shape language is soft and approachable, with full pills for navigation controls, chips, buttons, and search inputs. Standard cards use an 8px radius for structure, while larger promotional surfaces and containers often feel more open and rounded. The overall impression is friendly and smooth rather than sharp or architectural.

## Components
Buttons use strong pill geometry and compact sizing. `button-primary` and `button-secondary` both read as rounded 32px controls with 12px label styling, but the primary treatment should carry stronger emphasis through darker fills or bolder contrast when used for conversion actions. `button-tertiary` should remain text-first and minimal for low-emphasis links. Keep button padding tight horizontally and avoid oversized vertical chrome.

Cards follow a clean white surface with a subtle 1px border and `rounded.md` corners. Use them for marketplace tiles, content previews, and modular content blocks. Avoid heavy shadows; rely on borders and spacing to separate cards from the page.

Inputs are soft, wide, and highly usable. The main search pattern uses a full-pill container with a pale `tertiary` background and generous horizontal padding. Inputs should feel like query surfaces rather than boxed form fields, with a clear action icon or button at the end when needed.

Chips and tabs are compact filters with pill radii and low visual weight. Active states should be clear through stronger text color or a white inset treatment, while inactive options can sit on subtle `tertiary` or white backgrounds. Use these for categories, search scopes, and quick filters.

Banners and promotional callouts should use soft tinted backgrounds such as `brand-blush` and modest padding. They should feel helpful and lightweight, not interruptive. Inline badges and small badges can borrow the same rounded geometry for consistency.

## Do's and Don'ts
- Do keep the page bright, airy, and whitespace-driven.
- Do use Mona Sans with strong weight contrast instead of decorative type.
- Do favor pill shapes for interactive controls and filters.
- Do keep borders subtle and shadows minimal.
- Don't introduce heavy gradients, glassmorphism, or deep neumorphic effects.
- Don't use sharp corners on primary actions or search patterns.
- Don't overcrowd cards; preserve generous spacing around creative content.
- Don't overuse the accent pink or gold outside of highlights and focus moments.