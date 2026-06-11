/** Normalize `/v1/subnets` payloads — backend shapes vary slightly by version. */

export type SubnetPickItem = {
  id: string;
  label: string;
  /** Matches `slug` in engine subnet YAML / `public/engine-subnets/{slug}.yaml`. */
  slug?: string;
};

/** Strip ecosystem marketing from subnet titles shown in the UI (engine often embeds it in `name`). */
export function scrubSubnetDisplayName(raw: string): string {
  let s = raw.replace(/\bBittensor\b/gi, "").replace(/\s*\(\s*\)/g, "");
  s = s.replace(/\s{2,}/g, " ").replace(/^\s+|\s+$/g, "");
  return s.length > 0 ? s : "Subnet";
}

export function normalizeEngineSubnets(data: unknown): SubnetPickItem[] {
  if (!data || typeof data !== "object") return [];
  const subnets = (data as Record<string, unknown>).subnets;
  if (!Array.isArray(subnets)) return [];

  const items: SubnetPickItem[] = [];
  for (const raw of subnets) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    let id = String(o.id ?? o.subnet_id ?? o.SubnetID ?? "").trim();
    const nameRaw = o.name ?? o.subnet_name ?? o.slug ?? o.display_name ?? id;
    // Legacy engines omitted `id` but put the numeric SN in `name` (e.g. "101").
    if (
      !id &&
      typeof o.name === "string" &&
      /^\d+$/.test(o.name.trim())
    ) {
      id = o.name.trim();
    }
    const rawName =
      typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : "subnet";
    const name = scrubSubnetDisplayName(rawName);
    const slugRaw = o.slug;
    const slug =
      typeof slugRaw === "string" && slugRaw.trim().length > 0 ? slugRaw.trim() : undefined;
    if (!id) continue;
    const cleanName = name.replace(/\s*\(\s*SN\d+\s*\)\s*$/i, "").trim();
    const displayName = cleanName || `SN${id}`;
    items.push({ id, label: displayName, slug });
  }
  return items;
}

/** Slugs that have a corresponding `public/engine-subnets/{slug}.yaml` (from sync / index.json). */
export async function fetchSyncedSubnetSlugSet(): Promise<Set<string>> {
  try {
    const res = await fetch("/engine-subnets/index.json", { cache: "no-store" });
    if (!res.ok) return new Set();
    const j = (await res.json()) as unknown;
    if (!j || typeof j !== "object" || !Array.isArray((j as { slugs?: unknown }).slugs)) {
      return new Set();
    }
    return new Set(
      (j as { slugs: unknown[] }).slugs.filter(
        (x): x is string => typeof x === "string" && x.trim().length > 0,
      ),
    );
  } catch {
    return new Set();
  }
}

/**
 * When `index.json` is missing or empty, probe `/engine-subnets/{slug}.yaml` for each catalog slug.
 */
export async function discoverSyncedSlugsByHead(items: SubnetPickItem[]): Promise<Set<string>> {
  const slugs = [
    ...new Set(
      items.map((s) => s.slug?.trim()).filter((x): x is string => Boolean(x && x.length)),
    ),
  ];
  const results = await Promise.all(
    slugs.map(async (slug) => {
      try {
        const r = await fetch(`/engine-subnets/${encodeURIComponent(slug)}.yaml`, {
          method: "GET",
          cache: "no-store",
        });
        return r.ok ? slug : null;
      } catch {
        return null;
      }
    }),
  );
  return new Set(results.filter((x): x is string => x != null));
}

/** Keep engine catalog rows that have a synced YAML (matched by `slug`). */
export function intersectSubnetsWithSyncedYaml(
  items: SubnetPickItem[],
  syncedSlugs: Set<string>,
): SubnetPickItem[] {
  if (syncedSlugs.size === 0) return [];
  return items.filter((s) => {
    const slug = s.slug?.trim();
    if (!slug) return false;
    return syncedSlugs.has(slug);
  });
}
