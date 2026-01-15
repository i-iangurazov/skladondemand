import { describe, expect, it } from "vitest";
import type { MenuItem } from "@qr/types";
import { ensureDefaultSelection } from "../lib/cartSelection";

const makeItem = (overrides?: Partial<MenuItem>): MenuItem =>
  ({
    id: "i1",
    name: "Item",
    price: 100,
    description: "",
    imageUrl: "",
    sortOrder: 0,
    isActive: true,
    isInStock: true,
    modifiers: [],
    ...overrides,
  } as MenuItem);

describe("ensureDefaultSelection", () => {
  it("fills required modifiers with the first option", () => {
    const item = makeItem({
      modifiers: [
        {
          id: "g1",
          name: "Size",
          isRequired: true,
          minSelect: 1,
          maxSelect: 1,
          sortOrder: 0,
          options: [
            { id: "o1", name: "S", priceDelta: 0, isActive: true, sortOrder: 0 },
            { id: "o2", name: "L", priceDelta: 100, isActive: true, sortOrder: 1 },
          ],
        },
      ],
    });

    const result = ensureDefaultSelection(item, {});
    expect(result.g1).toEqual(["o1"]);
  });

  it("respects existing selections", () => {
    const item = makeItem({
      modifiers: [
        {
          id: "g1",
          name: "Size",
          isRequired: true,
          minSelect: 1,
          maxSelect: 2,
          sortOrder: 0,
          options: [
            { id: "o1", name: "S", priceDelta: 0, isActive: true, sortOrder: 0 },
            { id: "o2", name: "L", priceDelta: 100, isActive: true, sortOrder: 1 },
          ],
        },
      ],
    });

    const result = ensureDefaultSelection(item, { g1: ["o2"] });
    expect(result.g1).toEqual(["o2"]);
  });
});
