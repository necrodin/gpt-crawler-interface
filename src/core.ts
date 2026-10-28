// For more information, see https://crawlee.dev/
import { Configuration, PlaywrightCrawler, downloadListOfUrls } from "crawlee";
import { readFile, writeFile, mkdir } from "fs/promises";
import { glob } from "glob";
import { Config, configSchema } from "./config.js";
import { Page } from "playwright";
import { isWithinTokenLimit } from "gpt-tokenizer";
import { PathLike } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pageCounter = 0;
let crawler: PlaywrightCrawler;

export function getPageHtml(page: Page, selector = "body") {
  return page.evaluate((selector) => {
    // Check if the selector is an XPath
    if (selector.startsWith("/")) {
      const elements = document.evaluate(
        selector,
        document,
        null,
        XPathResult.ANY_TYPE,
        null,
      );
      let result = elements.iterateNext();
      return result ? result.textContent || "" : "";
    } else {
      // Handle as a CSS selector
      const el = document.querySelector(selector) as HTMLElement | null;
      return el?.innerText || "";
    }
  }, selector);
}

export async function waitForXPath(page: Page, xpath: string, timeout: number) {
  await page.waitForFunction(
    (xpath) => {
      const elements = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.ANY_TYPE,
        null,
      );
      return elements.iterateNext() !== null;
    },
    xpath,
    { timeout },
  );
}

export async function crawl(config: Config) {
  configSchema.parse(config);

  if (process.env.NO_CRAWL !== "true") {
    // PlaywrightCrawler crawls the web using a headless
    // browser controlled by the Playwright library.
    crawler = new PlaywrightCrawler(
      {
        launchContext: {
          launchOptions: {
            executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          },
        },
        // Use the requestHandler to process each of the crawled pages.
        async requestHandler({ request, page, enqueueLinks, log, pushData }) {
          const title = await page.title();
          pageCounter++;
          log.info(
            `Crawling: Page ${pageCounter} / ${config.maxPagesToCrawl} - URL: ${request.loadedUrl}...`,
          );

          // Use custom handling for XPath selector
          if (config.selector) {
            if (config.selector.startsWith("/")) {
              await waitForXPath(
                page,
                config.selector,
                config.waitForSelectorTimeout ?? 1000,
              );
            } else {
              await page.waitForSelector(config.selector, {
                timeout: config.waitForSelectorTimeout ?? 1000,
              });
            }
          }

          const html = await getPageHtml(page, config.selector);

          // Save results as JSON to ./storage/datasets/default
          await pushData({ title, url: request.loadedUrl, html });

          if (config.onVisitPage) {
            await config.onVisitPage({ page, pushData });
          }

          // Extract links from the current page
          // and add them to the crawling queue.
          await enqueueLinks({
            globs:
              typeof config.match === "string" ? [config.match] : config.match,
            exclude:
              typeof config.exclude === "string"
                ? [config.exclude]
                : config.exclude ?? [],
          });
        },
        // Comment this option to scrape the full website.
        maxRequestsPerCrawl: config.maxPagesToCrawl,
        // Uncomment this option to see the browser window.
        // headless: false,
        preNavigationHooks: [
          // Abort requests for certain resource types and add cookies
          async (crawlingContext, _gotoOptions) => {
            const { request, page, log } = crawlingContext;
            // Add cookies to the page
            // Because the crawler has not yet navigated to the page, so the loadedUrl is always undefined. Use the request url instead.
            if (config.cookie) {
              const cookies = (
                Array.isArray(config.cookie) ? config.cookie : [config.cookie]
              ).map((cookie) => {
                return {
                  name: cookie.name,
                  value: cookie.value,
                  url: request.url,
                };
              });
              await page.context().addCookies(cookies);
            }
            const RESOURCE_EXCLUSTIONS = config.resourceExclusions ?? [];
            // If there are no resource exclusions, return
            if (RESOURCE_EXCLUSTIONS.length === 0) {
              return;
            }
            await page.route(
              `**\/*.{${RESOURCE_EXCLUSTIONS.join()}}`,
              (route) => route.abort("aborted"),
            );
            log.info(
              `Aborting requests for as this is a resource excluded route`,
            );
          },
        ],
      },
      new Configuration({
        purgeOnStart: true,
      }),
    );

    const isUrlASitemap = /sitemap.*\.xml$/.test(config.url);

    if (isUrlASitemap) {
      const listOfUrls = await downloadListOfUrls({ url: config.url });

      // Add the initial URL to the crawling queue.
      await crawler.addRequests(listOfUrls);

      // Run the crawler
      await crawler.run();
    } else {
      // Add first URL to the queue and start the crawl.
      await crawler.run([config.url]);
    }
  }
}

export async function write(config: Config) {
  // Generate filename from domain if default is used
  let outputFileName = config.outputFileName;
  if (outputFileName === 'output.json') {
    try {
      const urlObj = new URL(config.url);
      const domain = urlObj.hostname.replace('www.', '');
      // Get just the first part of the domain (e.g., "google" from "google.com")
      const domainName = domain.split('.')[0];
      outputFileName = `${domainName}.json`;
    } catch (e) {
      outputFileName = 'output.json';
    }
  }
  
  // Ensure output directory exists
  const outputDir = path.join(__dirname, "../../output");
  await mkdir(outputDir, { recursive: true });
  
  // Create output path with domain-based filename
  const nextFileNameString = path.join(outputDir, outputFileName);
  
  // Read and process all crawled data
  const jsonFiles = await glob("storage/datasets/default/*.json", {
    absolute: true,
  });

  console.log(`Found ${jsonFiles.length} files to combine...`);

  let currentResults: Record<string, any>[] = [];
  let currentSize: number = 0;
  let fileCounter: number = 1;
  const maxBytes: number = config.maxFileSize
    ? config.maxFileSize * 1024 * 1024
    : Infinity;

  const getStringByteSize = (str: string): number =>
    Buffer.byteLength(str, "utf-8");

  const nextFileName = (): string => {
    // If we need to split files, use domain-name-1.json, domain-name-2.json, etc.
    const baseName = outputFileName.replace(/\.json$/, "");
    return `${baseName}-${fileCounter}.json`;
  };

  const writeBatchToFile = async (): Promise<void> => {
    const filePath = path.join(outputDir, nextFileName());
    await writeFile(
      filePath,
      JSON.stringify(currentResults, null, 2),
    );
    console.log(
      `Wrote ${currentResults.length} items to ${filePath}`,
    );
    currentResults = [];
    currentSize = 0;
    fileCounter++;
  };

  let estimatedTokens: number = 0;

  const addContentOrSplit = async (
    data: Record<string, any>,
  ): Promise<void> => {
    const contentString: string = JSON.stringify(data);
    
    // If maxTokens is 0 or Infinity, skip token checking and just add all data
    if (config.maxTokens === 0 || config.maxTokens === Infinity) {
      currentResults.push(data);
    } else {
      // Only check token limit if maxTokens > 0
      const tokenCount: number | false = isWithinTokenLimit(
        contentString,
        config.maxTokens!,
      );

      if (typeof tokenCount === "number") {
        if (estimatedTokens + tokenCount > config.maxTokens!) {
          // Only write the batch if it's not empty (something to write)
          if (currentResults.length > 0) {
            await writeBatchToFile();
          }
          // Since the addition of a single item exceeded the token limit, halve it.
          estimatedTokens = Math.floor(tokenCount / 2);
          currentResults.push(data);
        } else {
          currentResults.push(data);
          estimatedTokens += tokenCount;
        }
      }
    }

    // If maxFileSize is 0 or Infinity, skip file size checking
    if (config.maxFileSize === 0 || config.maxFileSize === Infinity) {
      return;
    }
    
    currentSize += getStringByteSize(contentString);
    if (currentSize > maxBytes) {
      await writeBatchToFile();
    }
  };

  // Iterate over each JSON file and process its contents.
  for (const file of jsonFiles) {
    const fileContent = await readFile(file, "utf-8");
    const data: Record<string, any> = JSON.parse(fileContent);
    await addContentOrSplit(data);
  }

  // Check if any remaining data needs to be written to a file.
  // If we've already written batches (fileCounter > 1), write final batch
  // Otherwise, write directly to domain-named file
  if (currentResults.length > 0) {
    if (fileCounter === 1) {
      // No splits needed, write directly to domain-named file
      await writeFile(nextFileNameString, JSON.stringify(currentResults, null, 2));
      console.log(`Wrote final ${currentResults.length} items to ${nextFileNameString}`);
    } else {
      // Write final batch with numbered filename
      await writeBatchToFile();
    }
  }

  return nextFileNameString;
}

class GPTCrawlerCore {
  config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async crawl() {
    await crawl(this.config);
  }

  async write(): Promise<PathLike> {
    // we need to wait for the file path as the path can change
    return new Promise((resolve, reject) => {
      write(this.config)
        .then((outputFilePath) => {
          resolve(outputFilePath);
        })
        .catch(reject);
    });
  }
}

export default GPTCrawlerCore;
