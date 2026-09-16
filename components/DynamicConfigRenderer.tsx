import { getSystemConfig } from "@/lib/config";

export default async function DynamicConfigRenderer() {
  try {
    const config = await getSystemConfig();

    if (!config) return null;

    const lightColors =
      (config.lightThemeColors as Record<string, string>) || {};
    const darkColors = (config.darkThemeColors as Record<string, string>) || {};

    // Generate CSS variables for both themes
    const generateVars = (colors: Record<string, string>, prefix = "") => {
      return Object.entries(colors)
        .filter(([_, value]) => value)
        .map(([key, value]) => `--${prefix}${key}-color: ${value};`)
        .join("\n");
    };

    const lightVars = generateVars(lightColors);
    const darkVars = generateVars(darkColors);

    return (
      <>
        {/* Head Code Injection */}
        {config.headCode && (
          <script
            dangerouslySetInnerHTML={{
              __html: config.headCode,
            }}
          />
        )}

        {/* Dynamic CSS Variables Injection */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
 :root {
 ${lightVars}
 }
 .dark {
 ${darkVars}
 }
 ${
   config.disableBgImage
     ? `
 body, .sticky-pattern {
 background-image: none !important;
 }
`
     : ""
 }
`,
          }}
        />

        {/* Footer Code Injection (General) */}
        {config.footerCodeAll && (
          <script
            dangerouslySetInnerHTML={{
              __html: config.footerCodeAll,
            }}
          />
        )}
      </>
    );
  } catch (error) {
    console.error(
      "[DynamicConfigRenderer] Failed to render dynamic config:",
      error,
    );
    return null;
  }
}
