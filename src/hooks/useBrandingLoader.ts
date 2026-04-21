import { useEffect, useRef } from "react";

/**
 * Dynamically loads Google Fonts for organization branding
 */
export function useBrandingLoader(fonts: string[]) {
  const loadedFontsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fontsToLoad = fonts.filter(font => 
      font && 
      font !== "Inter" && // Inter is already included by default
      !loadedFontsRef.current.has(font)
    );

    if (fontsToLoad.length === 0) return;

    // Create a single link element for all fonts
    const fontFamilies = fontsToLoad
      .map(font => font.replace(/\s+/g, "+"))
      .map(font => `family=${font}:wght@400;500;600;700`)
      .join("&");

    const linkId = "org-google-fonts";
    let linkEl = document.getElementById(linkId) as HTMLLinkElement | null;
    
    if (!linkEl) {
      linkEl = document.createElement("link");
      linkEl.id = linkId;
      linkEl.rel = "stylesheet";
      document.head.appendChild(linkEl);
    }

    linkEl.href = `https://fonts.googleapis.com/css2?${fontFamilies}&display=swap`;
    
    fontsToLoad.forEach(font => loadedFontsRef.current.add(font));
  }, [fonts]);
}

/**
 * Injects dynamic branding CSS variables and styles
 */
export function useBrandingStyles(branding: {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_heading: string;
  font_body: string;
  custom_css?: string | null;
} | null) {
  useEffect(() => {
    if (!branding) return;

    const styleId = "org-branding-styles";
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    // Convert hex to HSL for better Tailwind compatibility
    const hexToHsl = (hex: string): string => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!result) return hex;
      
      let r = parseInt(result[1], 16) / 255;
      let g = parseInt(result[2], 16) / 255;
      let b = parseInt(result[3], 16) / 255;
      
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0, l = (max + min) / 2;
      
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      
      return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    };

    // Treat empty strings as "not set" — falls back to monochrome below so
    // we never render stale indigo/teal defaults on a fresh workspace.
    const hasPrimary = !!branding.primary_color?.trim();
    const hasSecondary = !!branding.secondary_color?.trim();
    const hasAccent = !!branding.accent_color?.trim();

    // Monochrome defaults (near-black in light mode; near-white foreground).
    // These are used when the org hasn't explicitly picked brand colors.
    const MONO_PRIMARY_HSL = "0 0% 9%";    // near-black
    const MONO_ACCENT_HSL = "0 0% 9%";
    const MONO_SECONDARY_HSL = "0 0% 96%"; // near-white surface

    const primaryHsl = hasPrimary ? hexToHsl(branding.primary_color) : MONO_PRIMARY_HSL;
    const secondaryHsl = hasSecondary ? hexToHsl(branding.secondary_color) : MONO_SECONDARY_HSL;
    const accentHsl = hasAccent ? hexToHsl(branding.accent_color) : MONO_ACCENT_HSL;
    const effectivePrimary = hasPrimary ? branding.primary_color : "#171717";
    const effectiveSecondary = hasSecondary ? branding.secondary_color : "#f5f5f5";
    const effectiveAccent = hasAccent ? branding.accent_color : "#171717";
    const primaryL = Number.parseFloat(primaryHsl.split(/\s+/)[2]?.replace("%", "") || "0");
    const isPrimaryLight = Number.isFinite(primaryL) && primaryL >= 80;

    // Generate CSS with branding variables - override Tailwind's primary color.
    // When the org hasn't picked brand fonts, default heading + body to the
    // same clean sans (Inter) — Mintlify-style, not a serif display face.
    const fontHeading = branding.font_heading?.trim()
      ? `"${branding.font_heading}", Inter, system-ui, sans-serif`
      : `Inter, system-ui, sans-serif`;
    const fontBody = branding.font_body?.trim()
      ? `"${branding.font_body}", Inter, system-ui, sans-serif`
      : `Inter, system-ui, sans-serif`;

    styleEl.textContent = `
      :root {
        --brand-primary: ${effectivePrimary};
        --brand-primary-hsl: ${primaryHsl};
        --brand-secondary: ${effectiveSecondary};
        --brand-secondary-hsl: ${secondaryHsl};
        --brand-accent: ${effectiveAccent};
        --brand-accent-hsl: ${accentHsl};
        --brand-font-heading: ${fontHeading};
        --brand-font-body: ${fontBody};
      }
      
      /* Override primary and accent colors for docs pages */
      .docs-branded {
        --primary: ${primaryHsl};
        --accent: ${primaryHsl};
        --ring: ${primaryHsl};
        --sidebar-primary: ${primaryHsl};
      }
      
      /* Ensure light mode has proper contrast for branded docs */
      .light .docs-branded {
        --primary: ${primaryHsl};
        --primary-foreground: 0 0% 100%;
      }
      
      .brand-heading {
        font-family: var(--brand-font-heading) !important;
      }
      
      .brand-body {
        font-family: var(--brand-font-body) !important;
      }
      
      .brand-primary-bg {
        background-color: var(--brand-primary) !important;
      }
      
      .brand-primary-text {
        color: var(--brand-primary) !important;
      }
      
      .brand-secondary-bg {
        background-color: var(--brand-secondary) !important;
      }
      
      .brand-accent-bg {
        background-color: var(--brand-accent) !important;
      }
      
      .brand-accent-text {
        color: var(--brand-accent) !important;
      }

      /* Selected sidebar item should use brand color */
      .docs-branded .sidebar-item-selected {
        background-color: hsl(${primaryHsl} / 0.1) !important;
        color: var(--brand-primary) !important;
      }
      
      /* Developer dropdown active item styling */
      .docs-branded [data-highlighted] {
        background-color: ${isPrimaryLight ? `hsl(${primaryHsl} / 0.14)` : `hsl(${primaryHsl})`} !important;
        color: ${isPrimaryLight ? "var(--brand-primary)" : "white"} !important;
      }
      
      /* Ensure project tabs use brand color when selected */
      .docs-branded .border-primary {
        border-color: var(--brand-primary) !important;
      }
      
      ${branding.custom_css || ""}
    `;

    return () => {
      // Don't remove on cleanup - let it persist
    };
  }, [branding]);
}
