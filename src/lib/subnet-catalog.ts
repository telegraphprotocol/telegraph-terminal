/** Normalize `/v1/subnets` payloads — backend shapes vary slightly by version. */

export type SubnetPickItem = {
  id: string;
  label: string;
};

/** Strip ecosystem marketing from subnet titles shown in the UI (engine often embeds it in `name`). */
export function scrubSubnetDisplayName(raw: string): string {
  let s = raw.replace(/\bBittensor\b/gi, "").replace(/\s*\(\s*\)/g, "");
  s = s.replace(/\s{2,}/g, " ").trim();
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
    if (!id) continue;
    items.push({ id, label: `${name} (SN${id})` });
  }
  return items;
}
