# GPT Crawler with Web Interface

![Web Interface Screenshot](assets/ss.png)

A modern web interface for the gpt-crawler project, enabling easy configuration and management of web crawling operations through a user-friendly browser-based interface.

## Features

- 🌐 **Web-based interface** - Accessible via browser at `http://localhost:3001`
- 🎯 **Domain-based output naming** - Output files automatically named after the domain hostname (e.g., `google.json` from `https://www.google.com`)
- 📝 **JSON and Markdown export** - Download data in both JSON and Markdown formats
- 🎨 **Modern UI** - Built with Tailwind CSS for a clean, responsive design
- 🌍 **English language** - All interface text in English

## How to use

### Prerequisites

- Node.js >= 16 installed
- npm or yarn package manager

### Installation

1. Clone the repository:

```sh
git clone https://github.com/necrodin/gpt-crawler-interface.git
cd gpt-crawler-interface
```

2. Install dependencies:

```sh
npm install
```

3. Configure the crawler (optional):

Open [`config.ts`](config.ts) and edit the configuration values as needed.

4. Start the web server:

```sh
npm run start:web
```

5. Open your browser and navigate to `http://localhost:3001`

## Web Interface Features

### Configuration

- **Start URL**: Enter the URL to start crawling (e.g., `https://example.com`)
- **Match Pattern**: Enter the pattern to match links (e.g., `https://example.com/**`)
- **Selector**: CSS selector or XPath to extract content (default: `body`)
- **Max Pages**: Maximum number of pages to crawl
- **Output File**: Output filename (optional - auto-named by domain)

### Crawling

1. Click "Start Crawl" to begin the crawling process
2. Wait for the crawler to complete
3. Download your data as JSON or Markdown

## Web Server Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "start:web": "npm run build && node dist/src/webserver.js",
    "start:webdev": "tsc --watch & node esbuild-watch.js"
  }
}
```

Then run:
```bash
npm run start:web
```

## Example

Here's a sample configuration in [`config.ts`](config.ts):

```ts
export const defaultConfig: Config = {
  url: "https://www.example.com",
  match: "https://www.example.com/**",
  selector: `.main-content`,
  maxPagesToCrawl: 50,
  outputFileName: "output.json",
};
```

## Output

The crawler will generate a file in the `output/` directory, automatically named after the domain hostname:
- Input: `https://www.google.com`
- Output: `output/google.json` and `output/google.md`

## License

MIT License - Free to use and modify as you wish

## Original Project

This is a modified version of [gpt-crawler](https://github.com/BuilderIO/gpt-crawler) with a built-in web interface for easy configuration and management.
