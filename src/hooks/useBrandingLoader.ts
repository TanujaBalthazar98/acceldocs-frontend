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

    // Generate CSS with branding variables
    styleEl.textContent = `
      :root {
        --brand-primary: ${branding.primary_color};
        --brand-secondary: ${branding.secondary_color};
        --brand-accent: ${branding.accent_color};
        --brand-font-heading: "${branding.font_heading}", sans-serif;
        --brand-font-body: "${branding.font_body}", sans-serif;
      }
      
      .brand-heading {
        font-family: var(--brand-font-heading);
      }
      
      .brand-body {
        font-family: var(--brand-font-body);
      }
      
      .brand-primary-bg {
        background-color: var(--brand-primary);
      }
      
      .brand-primary-text {
        color: var(--brand-primary);
      }
      
      .brand-secondary-bg {
        background-color: var(--brand-secondary);
      }
      
      .brand-accent-bg {
        background-color: var(--brand-accent);
      }
      
      ${branding.custom_css || ""}
    `;

    return () => {
      styleEl?.remove();
    };
  }, [branding]);
}
