const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { websiteUrl } = await req.json();

    if (!websiteUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Website URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format URL
    let formattedUrl = websiteUrl.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log("Fetching website:", formattedUrl);

    // Fetch the website HTML
    const response = await fetch(formattedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DocLayer/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch website: ${response.status}`);
    }

    const html = await response.text();
    
    // Extract meta tags, CSS links, and inline styles for analysis
    const headSection = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] || "";
    const linkTags = headSection.match(/<link[^>]*>/gi) || [];
    const styleTags = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
    
    // Extract colors from CSS
    const allStyles = styleTags.join("\n");
    const colorMatches = allStyles.match(/#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}/g) || [];
    
    // Extract colors from inline styles in body
    const bodyColorMatches = html.match(/(?:color|background(?:-color)?)\s*:\s*(#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3})/gi) || [];
    const inlineColors = bodyColorMatches.map(match => {
      const hexMatch = match.match(/#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}/i);
      return hexMatch ? hexMatch[0] : null;
    }).filter(Boolean);

    // Combine and deduplicate colors
    const allColors = [...new Set([...colorMatches, ...inlineColors])];
    
    // Filter out common non-brand colors (black, white, grays)
    const brandColors = allColors.filter(color => {
      if (!color) return false;
      const hex = color.toLowerCase();
      // Exclude pure black, white, and common grays
      const excluded = ['#000', '#000000', '#fff', '#ffffff', '#f0f0f0', '#f5f5f5', 
                        '#e0e0e0', '#ccc', '#cccccc', '#999', '#999999', '#666', '#666666',
                        '#333', '#333333', '#111', '#111111', '#222', '#222222', '#444', '#444444',
                        '#555', '#555555', '#777', '#777777', '#888', '#888888', '#aaa', '#aaaaaa',
                        '#bbb', '#bbbbbb', '#ddd', '#dddddd', '#eee', '#eeeeee', '#fafafa', '#f9f9f9'];
      return !excluded.includes(hex);
    });

    // Try to find font from Google Fonts links
    let fontHeading = "Inter";
    let fontBody = "Inter";
    
    const fontLink = linkTags.find(l => l.includes("fonts.googleapis.com"));
    if (fontLink) {
      const fontMatch = fontLink.match(/family=([^:&"]+)/);
      if (fontMatch) {
        fontHeading = fontMatch[1].replace(/\+/g, " ").split(",")[0].trim();
        fontBody = fontHeading;
      }
    }

    // Also check for font-family in styles
    const fontFamilyMatch = allStyles.match(/font-family\s*:\s*['"]?([^'",;]+)/i);
    if (fontFamilyMatch && !fontLink) {
      const detectedFont = fontFamilyMatch[1].trim();
      if (!detectedFont.includes("sans-serif") && !detectedFont.includes("serif") && !detectedFont.includes("monospace")) {
        fontHeading = detectedFont;
        fontBody = detectedFont;
      }
    }

    // Use first few unique brand colors
    const primaryColor = brandColors[0] || "#3B82F6";
    const secondaryColor = brandColors[1] || brandColors[0] || "#1E40AF";
    const accentColor = brandColors[2] || brandColors[1] || brandColors[0] || "#F59E0B";

    const result = {
      primary_color: primaryColor.length === 4 ? `#${primaryColor[1]}${primaryColor[1]}${primaryColor[2]}${primaryColor[2]}${primaryColor[3]}${primaryColor[3]}` : primaryColor,
      secondary_color: secondaryColor.length === 4 ? `#${secondaryColor[1]}${secondaryColor[1]}${secondaryColor[2]}${secondaryColor[2]}${secondaryColor[3]}${secondaryColor[3]}` : secondaryColor,
      accent_color: accentColor.length === 4 ? `#${accentColor[1]}${accentColor[1]}${accentColor[2]}${accentColor[2]}${accentColor[3]}${accentColor[3]}` : accentColor,
      font_heading: fontHeading,
      font_body: fontBody,
    };

    console.log("Extracted branding:", result);

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error extracting styles:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to extract styles" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
