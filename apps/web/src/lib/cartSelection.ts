import type { MenuItem } from "@qr/types";

export type ModifierSelectionMap = Record<string, string[]>;

const sortOptions = (options: MenuItem["modifiers"][number]["options"]) =>
  [...options].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

/**
 * Ensures required modifier groups have a default selection so "Add to cart" is not blocked.
 */
export function ensureDefaultSelection(
  item: Pick<MenuItem, "modifiers">,
  prev: ModifierSelectionMap
): ModifierSelectionMap {
  const next: ModifierSelectionMap = { ...prev };

  for (const group of item.modifiers ?? []) {
    const current = next[group.id] ?? [];
    const minRequired = Math.max(group.minSelect, group.isRequired ? 1 : 0);

    if (current.length >= minRequired) continue;

    const candidates = sortOptions(group.options)
      .filter((opt) => opt.isActive)
      .map((opt) => opt.id);

    const needed = Math.min(group.maxSelect, Math.max(minRequired, 1));
    next[group.id] = Array.from(new Set([...current, ...candidates.slice(0, needed)])).slice(0, group.maxSelect);
  }

  return next;
}
