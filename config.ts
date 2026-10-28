import { Config } from "./src/config";

export const defaultConfig: Config = {
  url: "https://www.kvkk.gov.tr/",
  match: "https://www.kvkk.gov.tr//**",
  selector: "body",
  waitForSelectorTimeout: 20000,
  maxPagesToCrawl: 5,
  outputFileName: "bddk-test.json",
  maxTokens: 30000,
};
