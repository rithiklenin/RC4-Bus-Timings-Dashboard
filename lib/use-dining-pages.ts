"use client";

import { useEffect, useRef, useState } from "react";
import type { Cuisine } from "@/lib/dining";
import { paginateDiningMenu, type DiningPage } from "@/lib/dining-pagination";
import { DASHBOARD_CONFIG } from "@/lib/dashboard-config";

// Build an invisible measurement page only while measuring, then remove it.
// The classes and text match the visible sections, including continuation labels.
function fillMeasurement(element: HTMLElement, page: DiningPage) {
  element.replaceChildren();
  for (const section of page) {
    const block = document.createElement("div");
    block.className = "cuisine";
    const heading = document.createElement("h3");
    const name = document.createElement("span");
    name.className = "cuisine-name";
    name.textContent = section.name;
    heading.append(name);
    if (section.vegetarian) {
      const badge = document.createElement("span");
      badge.className = "veg-tag";
      badge.textContent = "Veg";
      heading.append(badge);
    }
    if (section.continuation) {
      const label = document.createElement("span");
      label.className = "dining-continuation";
      label.textContent = "continued";
      heading.append(label);
    }
    const list = document.createElement("ul");
    list.className = "dish-list";
    for (const dish of section.dishes) {
      const item = document.createElement("li");
      item.textContent = dish;
      list.append(item);
    }
    block.append(heading, list);
    element.append(block);
  }
}

export function useDiningPages(cuisines: Cuisine[]) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [pagination, setPagination] = useState(() => ({
    pages: paginateDiningMenu(cuisines, () => true), activeIndex: 0,
  }));

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    let cancelled = false;
    let frame = 0;
    function measure() {
      if (cancelled || !area) return;
      const measurement = document.createElement("div");
      measurement.className = "dining-page dining-measure";
      measurement.setAttribute("aria-hidden", "true");
      area.append(measurement);
      let pages: DiningPage[];
      try {
        const naturalHeight = window.matchMedia?.("(max-width: 860px)").matches || !area.clientHeight;
        const availableHeight = area.clientHeight - 2;
        pages = paginateDiningMenu(cuisines, page => {
          if (naturalHeight) return true;
          fillMeasurement(measurement, page);
          return measurement.getBoundingClientRect().height <= availableHeight;
        });
      } finally {
        measurement.remove();
      }
      setPagination(previous => JSON.stringify(previous.pages) === JSON.stringify(pages)
        ? previous : { pages, activeIndex: 0 });
    }
    function schedule() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    }
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(area);
    window.addEventListener("resize", schedule);
    document.fonts?.addEventListener("loadingdone", schedule);
    void document.fonts?.ready.then(() => { if (!cancelled) schedule(); });
    schedule();
    return () => {
      cancelled = true;
      observer?.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      document.fonts?.removeEventListener("loadingdone", schedule);
    };
  }, [cuisines]);

  useEffect(() => {
    const rotation = window.setInterval(() => {
      setPagination(current => ({ ...current, activeIndex: current.pages.length ? (current.activeIndex + 1) % current.pages.length : 0 }));
    }, DASHBOARD_CONFIG.diningRotationMs);
    return () => window.clearInterval(rotation);
  }, []);

  const selectPage = (activeIndex: number) => setPagination(current => ({ ...current, activeIndex }));
  return { areaRef, ...pagination, selectPage };
}
