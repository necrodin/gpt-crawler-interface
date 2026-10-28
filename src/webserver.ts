import express, { Express } from "express";
import cors from "cors";
import { readFile, writeFile } from "fs/promises";
import { Config, configSchema } from "./config.js";
import { crawl, write } from "./core.js";
import { configDotenv } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

configDotenv();

const app: Express = express();
const port = Number(process.env.UI_PORT) || 3001;
const hostname = process.env.UI_HOST || "localhost";

// __dirname equavalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../")));
app.use("/storage", express.static(path.join(__dirname, "../storage")));

// API endpoint to get current config
app.get("/api/config", (_req, res) => {
  res.json({
    url: "https://www.nist.gov/cyberframework",
    match: "https://www.nist.gov/cyberframework/**",
    selector: "body",
    maxPagesToCrawl: 5,
    outputFileName: "nist-test.json",
    maxTokens: 30000,
  });
});

// API endpoint to start crawling
app.post("/api/crawl", async (req, res) => {
  try {
    const config: Config = configSchema.parse(req.body);
    
    console.log("Starting crawl with config:", config);
    
    // Start crawler
    await crawl(config);
    const outputPath = await write(config);
    
    // Convert absolute path to relative path for client-side download
    // outputPath is something like "/Users/.../output/kvkk.json"
    // we want "output/kvkk.json"
    const pathParts = outputPath.split(path.sep);
    const outputIdx = pathParts.indexOf('output');
    const relativeOutputPath = outputIdx >= 0 ? pathParts.slice(outputIdx).join(path.sep).replace(/\\/g, '/') : outputPath;
    
    res.json({
      success: true,
      message: "Crawl completed successfully",
      outputPath: relativeOutputPath,  // relative path for download (e.g., output/google.json)
    });
  } catch (error: any) {
    console.error("Crawl error:", error);
    res.status(500).json({
      success: false,
      message: "Error during crawling",
      error: error.message,
    });
  }
});

// API endpoint to convert JSON to Markdown
app.post("/api/convert-to-md", async (req, res) => {
  try {
    const { outputPath } = req.body;
    // outputPath may contain "output/" prefix, remove it for file path
    const cleanPath = outputPath.replace(/^output\//, '');
    const filePath = path.join(__dirname, "../../output/", cleanPath);
    
    const fileContent = await readFile(filePath, "utf-8");
    const data = JSON.parse(fileContent);
    
    // Convert JSON to Markdown
    let mdContent = "# Crawler Output\n\n";
    
    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        mdContent += `## Item ${index + 1}\n\n`;
        mdContent += `**Title:** ${item.title || "N/A"}\n\n`;
        mdContent += `**URL:** ${item.url || "N/A"}\n\n`;
        mdContent += `**Content:**\n\n`;
        
        // Clean HTML content and convert to markdown
        const cleanHtml = item.html || "";
        mdContent += cleanHtml.substring(0, 500); // İlk 500 karakter
        if (cleanHtml.length > 500) {
          mdContent += "...";
        }
        mdContent += `\n\n---\n\n`;
      });
    } else {
      mdContent += `**Title:** ${data.title || "N/A"}\n\n`;
      mdContent += `**URL:** ${data.url || "N/A"}\n\n`;
      mdContent += `**Content:**\n\n`;
      
      // Clean HTML content and convert to markdown
      const cleanHtml = data.html || "";
      mdContent += cleanHtml.substring(0, 500);
      if (cleanHtml.length > 500) {
        mdContent += "...";
      }
      mdContent += `\n`;
    }
    
    // Separate endpoint can be added for full markdown version
    
    const mdFileName = cleanPath.replace(/\.json$/, ".md");
    const mdPath = path.join(__dirname, "../../output/", mdFileName);
    
    await writeFile(mdPath, mdContent);
    
    res.json({
      success: true,
      downloadUrl: mdFileName,  // just the filename, client will use /output/
    });
  } catch (error: any) {
    console.error("Conversion error:", error);
    res.status(500).json({
      success: false,
      message: "Error during conversion",
      error: error.message,
    });
  }
});

// Serve the main HTML page
app.get("/", (_req, res) => {
  const htmlPath = path.join(__dirname, "../../index.html");
  console.log("Serving HTML from:", htmlPath);
  res.sendFile(htmlPath);
});

// Serve static files from root
app.use(express.static(path.join(__dirname, "../../")));

app.listen(port, hostname, () => {
  console.log(`Web UI server running at http://${hostname}:${port}`);
  console.log(`API docs available at http://${hostname}:${port}/api-docs`);
});

export default app;
