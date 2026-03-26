import { NormalizedStory, SourceName, SourceResult } from '../types/index.js';
import { logger } from '../utils/logger.js';

export abstract class BaseSource {
  abstract readonly sourceName: SourceName;

  /**
   * Fetch and normalize stories from this source.
   * Returns empty array on failure — never throws.
   */
  protected abstract fetchStories(): Promise<NormalizedStory[]>;

  /**
   * Run the source with error handling + timing.
   */
  async run(): Promise<SourceResult> {
    const start = Date.now();

    try {
      logger.info(`Fetching from ${this.sourceName}`);
      const stories = await this.fetchStories();
      const duration = Date.now() - start;

      logger.info(`${this.sourceName}: ${stories.length} stories`, { duration });
      return { source: this.sourceName, stories, duration };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const duration = Date.now() - start;

      logger.error(`${this.sourceName} failed`, { error, duration });
      return { source: this.sourceName, stories: [], error, duration };
    }
  }

  /**
   * Health check — returns true if source is reachable.
   */
  abstract healthCheck(): Promise<boolean>;
}
