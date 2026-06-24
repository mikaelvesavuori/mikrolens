// @ts-check
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://mikrosuite.com",
  base: "/lens/docs",
  integrations: [
    starlight({
      title: "MikroLens Docs",
      description: "Documentation for the lightweight MikroLens product management tool.",
      favicon: "/favicon.svg",
      customCss: ["./src/styles/custom.css"],
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/mikaelvesavuori/mikrolens",
        },
      ],
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "What is MikroLens?", slug: "getting-started/intro" },
            { label: "Installation", slug: "getting-started/installation" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "Work and Planning", slug: "guides/work-and-planning" },
            { label: "Intake", slug: "guides/intake" },
            { label: "Configuration", slug: "guides/configuration" },
            { label: "Authentication", slug: "guides/authentication" },
            { label: "Deployment", slug: "guides/deployment" },
            { label: "Automation and API", slug: "guides/automation-api" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "Comparison", slug: "reference/comparison" },
            { label: "Architecture", slug: "reference/architecture" },
          ],
        },
      ],
    }),
  ],
});
