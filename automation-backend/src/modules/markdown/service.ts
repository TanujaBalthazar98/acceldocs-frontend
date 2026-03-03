import { logger } from "../../logging/logger.js";
import { DriveToMarkdownConverter } from "../mkdocs/converter.js";

export interface MarkdownConversionInput {
  html: string;
  title: string;
  imageBasePath: string;
}

export interface MarkdownConversionOutput {
  markdown: string;
  assets: Array<{ sourceUrl: string; targetPath: string }>;
}

export class MarkdownService {
  private converter = new DriveToMarkdownConverter();

  async convert(input: MarkdownConversionInput): Promise<MarkdownConversionOutput> {
    logger.info({ title: input.title }, "markdown.convert.start");

    const result = this.converter.convert({
      html: input.html,
      title: input.title,
    });

    // Extract image URLs from the converted markdown for asset handling
    const assets: Array<{ sourceUrl: string; targetPath: string }> = [];
    const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = imgRegex.exec(result.markdown)) !== null) {
      const sourceUrl = match[2];
      if (sourceUrl.startsWith("http")) {
        const filename = sourceUrl.split("/").pop()?.split("?")[0] || `image-${assets.length}.png`;
        assets.push({
          sourceUrl,
          targetPath: `${input.imageBasePath}/${filename}`,
        });
      }
    }

    const fullMarkdown = result.frontmatter + result.markdown;

    logger.info({ title: input.title, length: fullMarkdown.length, assetCount: assets.length }, "markdown.convert.done");

    return { markdown: fullMarkdown, assets };
  }
}
