import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { defaultSiteUrl } from "../src/site-meta.js";

const rootDir = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const outputDir = join(rootDir, "public", "og");
const outputPath = join(outputDir, "home.png");
const brandHost = new URL(defaultSiteUrl).host;

const ZINC_50 = "#fafafa";
const ZINC_100 = "#f4f4f5";
const ZINC_200 = "#e4e4e7";
const ZINC_300 = "#d4d4d8";
const ZINC_400 = "#a1a1aa";
const ZINC_500 = "#71717a";
const ZINC_600 = "#52525b";
const ZINC_700 = "#3f3f46";
const ZINC_900 = "#18181b";
const ZINC_950 = "#09090b";
const GREEN_500 = "#22c55e";

function buildMarkup(iconDataUrl) {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: "72px 80px",
        fontFamily: "Inter",
        backgroundColor: "#ffffff",
        backgroundImage:
          "linear-gradient(180deg, rgba(250,250,250,0.94) 0%, rgba(255,255,255,1) 50%), repeating-linear-gradient(90deg, rgba(24,24,27,0.07) 0px, rgba(24,24,27,0.07) 1px, transparent 1px, transparent 64px)",
      },
      children: [
        // Top brand bar
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                  },
                  children: [
                    {
                      type: "img",
                      props: {
                        src: iconDataUrl,
                        width: 52,
                        height: 52,
                        style: { borderRadius: "12px" },
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          color: ZINC_950,
                          fontSize: "34px",
                          fontWeight: 600,
                          letterSpacing: "-0.02em",
                          lineHeight: 1,
                        },
                        children: "Draftside",
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
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 16px",
                    borderRadius: "999px",
                    border: `1px solid ${ZINC_200}`,
                    backgroundColor: "rgba(255,255,255,0.85)",
                    color: ZINC_600,
                    fontSize: "16px",
                    fontWeight: 500,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          width: "10px",
                          height: "10px",
                          borderRadius: "999px",
                          backgroundColor: GREEN_500,
                          boxShadow: `0 0 0 4px rgba(34,197,94,0.18)`,
                        },
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: { display: "flex" },
                        children: "offline · on-device",
                      },
                    },
                  ],
                },
              },
            ],
          },
        },

        // Centerpiece: editor mock
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              flex: 1,
              marginTop: "56px",
              width: "100%",
              borderRadius: "20px",
              border: `1px solid ${ZINC_300}`,
              backgroundColor: "#ffffff",
              boxShadow:
                "0 1px 2px rgba(15,23,42,0.05), 0 30px 80px rgba(15,23,42,0.10)",
              overflow: "hidden",
            },
            children: [
              // Editor chrome bar
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    padding: "16px 24px",
                    borderBottom: `1px solid ${ZINC_200}`,
                    color: ZINC_500,
                    fontSize: "15px",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          width: "10px",
                          height: "10px",
                          borderRadius: "999px",
                          backgroundColor: GREEN_500,
                          boxShadow: `0 0 0 4px rgba(34,197,94,0.18)`,
                        },
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: { display: "flex", flex: 1 },
                        children: "draftside · untitled.md",
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          padding: "6px 12px",
                          borderRadius: "999px",
                          backgroundColor: ZINC_100,
                          color: ZINC_600,
                          fontSize: "13px",
                          fontWeight: 500,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        },
                        children: "Gemini Nano · ready",
                      },
                    },
                  ],
                },
              },

              // Editor body — the hero sentence with ghost completion + tab
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    padding: "56px 64px",
                    justifyContent: "center",
                    gap: "28px",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          color: ZINC_400,
                          fontSize: "16px",
                          fontWeight: 500,
                          letterSpacing: "0.18em",
                          textTransform: "uppercase",
                        },
                        children: "Working title",
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "baseline",
                          color: ZINC_950,
                          fontSize: "62px",
                          fontWeight: 600,
                          letterSpacing: "-0.03em",
                          lineHeight: 1.08,
                        },
                        children: [
                          {
                            type: "span",
                            props: {
                              style: { display: "flex" },
                              children: "Private AI writing,",
                            },
                          },
                          {
                            type: "span",
                            props: {
                              style: {
                                display: "flex",
                                marginLeft: "16px",
                                color: ZINC_400,
                              },
                              children: "entirely on your device.",
                            },
                          },
                          {
                            type: "span",
                            props: {
                              style: {
                                display: "flex",
                                marginLeft: "20px",
                                padding: "6px 14px",
                                border: `1px solid ${ZINC_300}`,
                                borderBottomWidth: "2px",
                                borderRadius: "8px",
                                backgroundColor: ZINC_100,
                                color: ZINC_600,
                                fontSize: "20px",
                                fontWeight: 600,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                lineHeight: 1,
                                alignSelf: "center",
                              },
                              children: "tab",
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
        },

        // Footer
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: "36px",
              width: "100%",
              color: ZINC_500,
              fontSize: "18px",
              fontWeight: 500,
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    letterSpacing: "0.06em",
                  },
                  children: brandHost,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    color: ZINC_600,
                    letterSpacing: "0.06em",
                  },
                  children: "Open source · No account · No API key",
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
  const [interMedium, interSemiBold, interBold, iconPng] = await Promise.all([
    readFile(join(rootDir, "src", "assets", "fonts", "Inter-500.woff")),
    readFile(join(rootDir, "src", "assets", "fonts", "Inter-600.woff")),
    readFile(join(rootDir, "src", "assets", "fonts", "Inter-700.woff")),
    readFile(join(rootDir, "public", "draftside-192.png")),
  ]);

  const iconDataUrl = `data:image/png;base64,${iconPng.toString("base64")}`;

  const svg = await satori(buildMarkup(iconDataUrl), {
    width: 1200,
    height: 630,
    fonts: [
      { name: "Inter", data: interMedium, weight: 500, style: "normal" },
      { name: "Inter", data: interSemiBold, weight: 600, style: "normal" },
      { name: "Inter", data: interBold, weight: 700, style: "normal" },
    ],
  });

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
