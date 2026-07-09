import { RawJob, SourceAdapter } from "./types";

function extractXmlTag(xml: string, tag: string): string | null {
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i");
  const plainRe = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(cdataRe) ?? xml.match(plainRe);
  return match?.[1]?.trim() ?? null;
}

function cleanHtml(html: string): string {
  return html
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractCompanyFromTitle(title: string): string | null {
  const colonMatch = title.match(/^([^:]{2,60}):\s*.+/);
  if (colonMatch) return colonMatch[1].trim();
  const atMatch = title.match(/\bat\s+([A-Z][^–\-,\n]{2,50})(?:\s*[-–,]|$)/);
  if (atMatch) return atMatch[1].trim();
  return null;
}

function extractSalary(text: string): string | null {
  const patterns: RegExp[] = [
    /\$[\d,]+[kK]?\s*[-–to]+\s*\$[\d,]+[kK]?/,
    /USD\s*[\d,]+[kK]?\s*[-–to]+\s*[\d,]+[kK]?/i,
    /\$[\d,]{4,}(?:\s*[-–]\s*\$[\d,]+)?/,
    /[\d]+[kK]\s*[-–]\s*[\d]+[kK]\s*(?:USD|per\s+year|\/yr)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[0].trim();
  }
  return null;
}

function extractLocation(text: string): string | null {
  const hqMatch = text.match(/Headquarters?:\s*([^\n]{2,60})/i);
  if (hqMatch) return hqMatch[1].split(/[\n,]/)[0]?.trim() ?? null;
  const locMatch = text.match(/Location:\s*([^\n]{2,60})/i);
  if (locMatch) return locMatch[1].split(/[\n,]/)[0]?.trim() ?? null;
  return null;
}

export const rssAdapter: SourceAdapter = {
  type: "rss",
  async discover(source, keywords) {
    if (!source.url) return [];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(source.url, {
        signal: controller.signal,
        headers: { "User-Agent": "JobScout/1.0 (RSS reader)" },
      });
      clearTimeout(timeout);
      if (!response.ok) return [];

      const xml = await response.text();
      const items = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi) ?? [];
      const jobs: RawJob[] = [];

      for (const item of items.slice(0, 30)) {
        const rawTitle = extractXmlTag(item, "title");
        const link = extractXmlTag(item, "link") ?? extractXmlTag(item, "guid");
        const rawDescription = extractXmlTag(item, "description");
        const pubDate = extractXmlTag(item, "pubDate");

        if (!rawTitle || !link) continue;

        const titleLow = rawTitle.toLowerCase();
        const descLow = (rawDescription ?? "").toLowerCase();
        const matchesKeyword = keywords.some(
          (kw) => titleLow.includes(kw.toLowerCase()) || descLow.includes(kw.toLowerCase()),
        );
        if (!matchesKeyword) continue;

        const region = extractXmlTag(item, "region");
        const jobType = extractXmlTag(item, "type");

        const cleanTitle = cleanHtml(rawTitle);
        const company = extractCompanyFromTitle(cleanTitle) ?? "Unknown Company";
        const jobTitle = cleanTitle.replace(/^[^:]+:\s*/, "").trim() || cleanTitle;
        const descText = rawDescription ? cleanHtml(rawDescription) : "";
        const salary = extractSalary(descText) ?? extractSalary(cleanTitle) ?? undefined;

        const locationRaw = region ?? extractLocation(descText);
        const isRemote =
          (locationRaw?.toLowerCase().includes("anywhere") ?? false) ||
          (locationRaw?.toLowerCase().includes("worldwide") ?? false) ||
          (locationRaw?.toLowerCase().includes("remote") ?? false) ||
          titleLow.includes("remote") ||
          descLow.includes("fully remote");

        const isGlobalRegion = locationRaw
          ? /anywhere|worldwide|global/i.test(locationRaw)
          : false;
        const location = locationRaw && !isGlobalRegion ? locationRaw : undefined;

        jobs.push({
          sourceId: source.id,
          source: source.slug,
          sourceType: source.type,
          title: jobTitle,
          company,
          url: link,
          description: descText.slice(0, 5000) || undefined,
          salary,
          location,
          employmentType: jobType ?? undefined,
          remote: isRemote,
          postedAt: pubDate ?? undefined,
          tags: keywords.filter((kw) => titleLow.includes(kw.toLowerCase()) || descLow.includes(kw.toLowerCase())),
        });
      }

      return jobs;
    } catch {
      clearTimeout(timeout);
      return [];
    }
  },
};
