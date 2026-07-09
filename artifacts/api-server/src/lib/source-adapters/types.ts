import { Source } from "@workspace/db";

export interface RawJob {
  sourceId: number;
  source: string;
  sourceType: string;
  title: string;
  company: string;
  url: string;
  description?: string;
  salary?: string;
  location?: string;
  employmentType?: string;
  remote?: boolean;
  postedAt?: string;
  tags: string[];
}

export interface SourceAdapter {
  type: string;
  discover(source: Source, keywords: string[]): Promise<RawJob[]>;
}
