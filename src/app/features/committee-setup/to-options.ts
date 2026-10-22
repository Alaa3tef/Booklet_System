// core/utils/to-options.ts


/**
 * Converts any lookup response into SelectOption[].
 * Accepts: [] | { data: [] } | { items: [] } | { result: [] }
 * Value  = code (the API expects codes), falls back to id.
 * Label  = Arabic name, falls back to name/title.
 */
export function toOptions(res: unknown): any[] {
  const raw = res as any;
  const list: any[] = Array.isArray(raw)
    ? raw
    : raw?.data.data ?? raw?.items ?? raw?.result ?? raw?.value ?? [];

  return list.map(item => {
    const o: Record<string, any> = {};
    Object.keys(item ?? {}).forEach(k => (o[k.toLowerCase()] = item[k]));

    const value = o['code'] ?? o['id'] ?? o['value'];
    const label =
      o['namear'] ?? o['arabicname'] ?? o['name'] ?? o['title'] ?? o['label'] ?? value;

    return { label: String(label), value: String(value) };
  });
}