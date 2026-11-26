import app from 'flarum/forum/app';

/** A discussion's (or tag's, or member's) title and avatar, as one page shows them. */
export interface Pair {
  title?: Element | null;
  avatar?: Element | null;
}

export interface PageKey {
  path: string;
  id?: string | null;
  key?: string;
}

/**
 * Turns a path into what the page shows: a discussion (d:12), a tag
 * (t:general) or a member (u:alice), plus the bare path for comparisons.
 */
export function pageKey(url: string): PageKey {
  const base = app.forum.attribute<string>('basePath') || '';
  const path = new URL(url, location.origin).pathname.slice(base.length).replace(/\/+$/, '') || '/';
  const match = path.match(/^\/(d|t|u)\/([^/]+)/);

  if (!match) return { path };

  const id = match[1] === 'd' ? match[2].split('-')[0] : decodeURIComponent(match[2]);

  return { path, id: match[1] === 'd' ? id : null, key: match[1] + ':' + id };
}

/**
 * The title and avatar a move starts from, found from what was clicked: a
 * discussion in a list, an avatar, a tag tile. Anything else (a header
 * link, say) gives null, and the move starts from the page being left.
 */
export function fromSource(source: Element): Pair | null {
  const item = source.closest('.DiscussionListItem');
  if (item && !source.closest('.DiscussionListItem-author-avatar')) return listItem(item);

  const avatar = source.closest('a')?.querySelector('.Avatar');
  if (avatar) return { avatar };

  const tag = source.closest('.TagTile');
  if (tag) return { title: tag.querySelector('.TagTile-name') };

  return null;
}

/**
 * The title and avatar standing for a page key on the page showing now.
 * `pageOnly` skips list items, for a discussion page whose own hero hasn't
 * arrived yet (its side list may hold the same discussion).
 */
export function byKey(key: string | null | undefined, pageOnly = false): Pair | null {
  if (!key) return null;

  const id = key.slice(2);

  if (key[0] === 'd') return discussion(id, pageOnly);
  if (key[0] === 'u') return { avatar: firstVisible('.UserCard--profile .UserCard-avatar .Avatar') };
  if (key[0] === 't') return tag(key, pageOnly);

  return null;
}

function discussion(id: string, pageOnly: boolean): Pair | null {
  const hero = document.querySelector('.DiscussionHero-title');
  if (hero) {
    return {
      title: hero,
      avatar: firstVisible('.PostStream-item[data-number="1"] :is(.Post-avatar, .PostUser-avatar)'),
    };
  }

  if (pageOnly) return null;

  for (const link of Array.from(document.querySelectorAll('.DiscussionListItem-main'))) {
    const item = link.closest('.DiscussionListItem');
    if (item && pageKey(link.getAttribute('href') || '').id === id) return listItem(item);
  }

  return null;
}

function tag(key: string, pageOnly: boolean): Pair {
  // Bespoke draws its own hero over the tag page.
  const hero = firstVisible('.TagHero .Hero-title, .HeroBanner-title');
  if (hero || pageOnly) return { title: hero };

  const tile = Array.from(document.querySelectorAll('.TagTile-info')).find((link) => pageKey(link.getAttribute('href') || '').key === key);
  return { title: tile?.querySelector('.TagTile-name') };
}

function listItem(item: Element): Pair {
  return {
    title: item.querySelector('.DiscussionListItem-title'),
    avatar: item.querySelector('.DiscussionListItem-author .Avatar'),
  };
}

/**
 * Names the pair for the length of a transition (only what is on screen, and
 * nothing inside an element held still), returning what was named, or null.
 */
export function mark(pair: Pair | null, isStill: (el: Element) => boolean): Element[] | null {
  if (!pair) return null;

  const named: Element[] = [];

  for (const [el, name] of [
    [pair.title, 'segue-vt-title'],
    [pair.avatar, 'segue-vt-avatar'],
  ] as const) {
    if (!el || !visible(el) || isStill(el)) continue;
    el.classList.add(name);
    named.push(el);
  }

  return named.length ? named : null;
}

export function unmark(elements: Iterable<Element> | null): void {
  for (const el of elements || []) el.classList.remove('segue-vt-title', 'segue-vt-avatar');
}

/** How many of the pair are on screen. */
export function count(pair: Pair | null): number {
  return pair ? [pair.title, pair.avatar].filter(visible).length : 0;
}

function firstVisible(selector: string): Element | null {
  return Array.from(document.querySelectorAll(selector)).find(visible) || null;
}

function visible(el: Element | null | undefined): boolean {
  if (!el) return false;
  const box = el.getBoundingClientRect();
  return box.width > 0 && box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth;
}
