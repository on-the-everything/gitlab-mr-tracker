export type Format = "json" | "dotenv";

interface FormatHandler {
  label: string;
  parse(text: string): Record<string, string>;
  stringify(data: Record<string, string>): string;
  pretty(text: string): string;
}

const jsonHandler: FormatHandler = {
  label: "JSON",
  parse(text: string): Record<string, string> {
    const parsed = JSON.parse(text);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error("JSON must be a non-null object");
    }
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      result[key] = typeof value === "string" ? value : JSON.stringify(value);
    }
    return result;
  },
  stringify(data: Record<string, string>): string {
    return JSON.stringify(data, null, 2);
  },
  pretty(text: string): string {
    return JSON.stringify(JSON.parse(text), null, 2);
  },
};

const dotenvHandler: FormatHandler = {
  label: ".env",
  parse(text: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const rawLine of text.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIndex = line.indexOf("=");
      if (eqIndex === -1) continue;
      const key = line.slice(0, eqIndex).trim();
      let value = line.slice(eqIndex + 1).trim();
      // Strip surrounding quotes (single or double)
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key) result[key] = value;
    }
    return result;
  },
  stringify(data: Record<string, string>): string {
    return Object.entries(data)
      .map(([key, value]) => {
        const needsQuotes =
          value.includes(" ") || value.includes("#") || value === "";
        return needsQuotes ? `${key}="${value}"` : `${key}=${value}`;
      })
      .join("\n");
  },
  pretty(text: string): string {
    const data = dotenvHandler.parse(text);
    const sortedEntries = Object.entries(data).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const sorted: Record<string, string> = {};
    for (const [k, v] of sortedEntries) sorted[k] = v;
    return dotenvHandler.stringify(sorted);
  },
};

export const FORMAT_HANDLERS: Record<Format, FormatHandler> = {
  json: jsonHandler,
  dotenv: dotenvHandler,
};

export function convert(
  input: string,
  fromFormat: Format,
  toFormat: Format,
): string {
  const from = FORMAT_HANDLERS[fromFormat];
  const to = FORMAT_HANDLERS[toFormat];
  const data = from.parse(input);
  return to.stringify(data);
}

export function pretty(input: string, format: Format): string {
  return FORMAT_HANDLERS[format].pretty(input);
}
