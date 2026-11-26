const html = document.documentElement;

// At most this many excluded elements are held still in one transition:
// each one is a separate picture the browser keeps for its length.
const MAX_STILL = 20;

/**
 * The admin's excluded selectors, keeping only those the browser accepts: a
 * mistyped line is skipped, never fatal. They stay apart rather than joined
 * into one list, where a line left open (`:is(`, which the browser closes at
 * the end) would swallow the lines after it.
 */
export function stillSelectors(lines: unknown): string[] {
  if (!Array.isArray(lines)) return [];

  return lines.filter((line): line is string => {
    if (typeof line !== 'string' || !line.trim()) return false;

    try {
      document.querySelector(line);
      return true;
    } catch (e) {
      return false;
    }
  });
}

/**
 * The elements the admin excluded from transitions. For the length of one,
 * each gets a name of its own (segue-still-0, -1, …, by its place among the
 * matches, so the same element before and after the move gets the same name),
 * which pictures it apart from the page; forum.less shows it without moving.
 */
export default class StillElements {
  // The latest transition's elements. One cut short by the next click
  // finishes while the next is already under way, and must leave these alone.
  private latest: HTMLElement[] = [];

  constructor(private selectors: string[]) {}

  /** Whether an element is, or is inside, one held still. */
  covers(el: Element): boolean {
    return this.selectors.some((selector) => el.closest(selector));
  }

  hold(): HTMLElement[] {
    const held: HTMLElement[] = (this.latest = []);
    const found = new Set(this.selectors.flatMap((selector) => Array.from(document.querySelectorAll<HTMLElement>(selector))));

    for (const el of found) {
      if (held.length >= MAX_STILL) break;
      if (el === html || el === document.body || !el.getClientRects().length) continue;

      el.style.setProperty('view-transition-name', 'segue-still-' + held.length);
      el.style.setProperty('view-transition-class', 'segue-still');
      held.push(el);
    }

    return held;
  }

  /** Releases a transition's elements, except those a later one now holds. */
  release(held: HTMLElement[]): void {
    for (const el of held) {
      if (held !== this.latest && this.latest.includes(el)) continue;
      el.style.removeProperty('view-transition-name');
      el.style.removeProperty('view-transition-class');
    }
  }
}
