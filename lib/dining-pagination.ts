import type { Cuisine } from "@/lib/dining";

export interface DiningSection extends Cuisine {
  id: string;
  continuation: boolean;
}

export type DiningPage = DiningSection[];

// fits() measures actual wrapped headings and dishes, rather than guessing
// their height from the number of dishes or the screen resolution.
export function paginateDiningMenu(cuisines: Cuisine[], fits: (page: DiningPage) => boolean): DiningPage[] {
  const sections = cuisines.map((cuisine, index) => ({ ...cuisine, id: `stall-${index}`, continuation: false }));
  const pages: DiningPage[] = [];
  for (let index = 0; index < sections.length; index++) {
    const section = sections[index];
    if (fits([section])) {
      const next = sections[index + 1];
      if (next && fits([section, next])) {
        pages.push([section, next]);
        index++;
      } else pages.push([section]);
      continue;
    }

    let offset = 0;
    while (offset < section.dishes.length) {
      const part = { ...section, id: `${section.id}-${offset}`, continuation: offset > 0 };
      let low = 1;
      let high = section.dishes.length - offset;
      let count = 1; // Always advance, even in an exceptionally small viewport.
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        if (fits([{ ...part, dishes: section.dishes.slice(offset, offset + middle) }])) {
          count = middle;
          low = middle + 1;
        } else high = middle - 1;
      }
      pages.push([{ ...part, dishes: section.dishes.slice(offset, offset + count) }]);
      offset += count;
    }
    if (!section.dishes.length) pages.push([section]);
  }
  return pages;
}
