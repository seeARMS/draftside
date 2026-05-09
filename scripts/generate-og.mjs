import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  defaultSiteUrl,
  description,
  ogHeadline,
  siteName,
} from "../src/site-meta.js";

const rootDir = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const outputDir = join(rootDir, "public", "og");
const outputPath = join(outputDir, "home.png");
const brandHost = new URL(defaultSiteUrl).host;

function buildMarkup() {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: "#ffffff",
        padding: "60px 68px",
        fontFamily: "Inter",
      },
      children: [
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          width: "44px",
                          height: "44px",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1px solid #d4d4d8",
                          borderRadius: "10px",
                          backgroundColor: "#fafafa",
                          color: "#18181b",
                          fontSize: "24px",
                          fontWeight: 700,
                          lineHeight: 1,
                        },
                        children: "D",
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          color: "#09090b",
                          fontSize: "30px",
                          fontWeight: 600,
                          lineHeight: 1,
                        },
                        children: siteName,
                      },
                    },
                  ],
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    color: "#71717a",
                    fontSize: "22px",
                    fontWeight: 500,
                    lineHeight: 1,
                  },
                  children: brandHost,
                },
              },
            ],
          },
        },
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flex: 1,
              alignItems: "center",
              gap: "54px",
              width: "100%",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: "28px",
                    width: "620px",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          whiteSpace: "pre-line",
                          color: "#09090b",
                          fontSize: "78px",
                          fontWeight: 700,
                          lineHeight: 1.02,
                        },
                        children: ogHeadline,
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          color: "#52525b",
                          fontSize: "26px",
                          lineHeight: 1.35,
                        },
                        children: description,
                      },
                    },
                  ],
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    width: "390px",
                    gap: "18px",
                    padding: "34px",
                    border: "1px solid #d4d4d8",
                    borderRadius: "24px",
                    backgroundColor: "#fafafa",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          color: "#18181b",
                          fontSize: "30px",
                          fontWeight: 600,
                          lineHeight: 1.2,
                        },
                        children: "Private writing, local help.",
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          color: "#52525b",
                          fontSize: "22px",
                          lineHeight: 1.5,
                        },
                        children: "Draftside runs in the browser and keeps the writing flow quiet.",
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "10px",
                        },
                        children: ["offline drafts", "Gemini Nano", "Tab to accept"].map((label) => ({
                          type: "div",
                          props: {
                            style: {
                              display: "flex",
                              borderRadius: "10px",
                              backgroundColor: "#ffffff",
                              border: "1px solid #e4e4e7",
                              color: "#52525b",
                              fontSize: "18px",
                              fontWeight: 500,
                              padding: "10px 13px",
                            },
                            children: label,
                          },
                        })),
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };
}

async function main() {
  const [interMedium, interSemiBold, interBold] = await Promise.all([
    readFile(join(rootDir, "src", "assets", "fonts", "Inter-500.woff")),
    readFile(join(rootDir, "src", "assets", "fonts", "Inter-600.woff")),
    readFile(join(rootDir, "src", "assets", "fonts", "Inter-700.woff")),
  ]);

  const svg = await satori(
    buildMarkup(),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Inter", data: interMedium, weight: 500, style: "normal" },
        { name: "Inter", data: interSemiBold, weight: 600, style: "normal" },
        { name: "Inter", data: interBold, weight: 700, style: "normal" },
      ],
    },
  );

  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
  const png = resvg.render().asPng();

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, png);
  console.log(`Generated ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
