export type BannerRow = readonly [label: string, value: string];

export interface BannerGroup {
  readonly rows: readonly BannerRow[];
}

function formatGroup({ rows }: BannerGroup): string {
  const width = Math.max(...rows.map(([label]) => label.length));
  return rows.map(([label, value]) => `${`${label}:`.padEnd(width + 1)} ${value}`).join('\n');
}

/** Renders row groups as an aligned text block: labels padded per group, groups split by a blank line. */
export function formatStartupBanner(groups: readonly BannerGroup[]): string {
  return groups.map((group) => formatGroup(group)).join('\n\n');
}
