import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Reads from config/scoring.json — edit that file to change thresholds
const config = JSON.parse(readFileSync(join(__dirname, '../../config/scoring.json'), 'utf-8')) as {
  CANDIDATE_THRESHOLD: number;
  STORIES_PER_SECTION: number;
  MAX_TO_SUMMARIZE: number;
  TOKEN_CAP: number;
  CATEGORY_HINTS: {
    top_story: string[];
    launch: string[];
    pm_corner: string[];
    stat: string[];
  };
};

export const SCORING = {
  CANDIDATE_THRESHOLD: config.CANDIDATE_THRESHOLD,
  STORIES_PER_SECTION: config.STORIES_PER_SECTION,
  MAX_TO_SUMMARIZE: config.MAX_TO_SUMMARIZE,
  TOKEN_CAP: config.TOKEN_CAP,
} as const;

export const CATEGORY_HINTS = config.CATEGORY_HINTS;
