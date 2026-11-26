import app from 'flarum/forum/app';
import { override } from 'flarum/common/extend';
import { byKey, count, fromSource, mark, pageKey, unmark, type Pair } from './pages';
import StillElements, { stillSelectors } from './still';

const html = document.documentElement;

// How long the old page may stay on screen while the new one finishes. The
// page itself must be drawn within ROUTE_WAIT; a discussion's title and
// avatar, which arrive with its posts, get PAIR_WAIT more before the move
// goes ahead as a plain fade. Anything else the new page asked the server for
// (a widget's rows, say) gets SETTLE_WAIT more, so it is in place before the
// page is shown instead of pushing it down a moment later.
const ROUTE_WAIT = 300;
const PAIR_WAIT = 450;
const SETTLE_WAIT = 400;

/**
 * Page transitions inside the forum, the same-document twin of the browser's
 * cross-page View Transitions. Every move between pages runs through
 * document.startViewTransition: the header stays still, the page fades and
 * rises, and when the move is between a discussion in a list and its page,
 * the title and the starter's avatar glide from one to the other.
 *
 * Only one title and one avatar ever carry a transition name, and only for
 * the length of a transition, so names never clash. Elements the admin
 * excluded are held still (./still).
 */
export default function pageTransitions(): void {
  const style = app.forum.attribute<string>('segueTransitions');

  if (style === 'off' || typeof document.startViewTransition !== 'function') return;

  html.setAttribute('data-segue-style', style);

  new Transitions(style === 'glide', new StillElements(stillSelectors(app.forum.attribute('segueExclude')))).listen();
}

class Transitions {
  private reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  private clicked: Element | null = null;
  private clickedAt = 0;
  private replaying = false;
  // Counts transitions, so one cut short by the next click knows it was.
  private runs = 0;
  // The requests made while a transition waits for the new page; null between
  // transitions.
  private asked: Set<Promise<unknown>> | null = null;
  // The page being shown. By the time a back or forward event arrives the
  // address already names the next page, so the one being left is kept here.
  private here = location.pathname;
  // Where the page was scrolled. On back and forward the browser jumps to
  // the next page's old scroll position before the event arrives, which
  // would leave the page being left photographed half-way down.
  private scrolled = window.scrollY;

  constructor(
    private glide: boolean,
    private still: StillElements
  ) {}

  private isStill = (el: Element) => this.still.covers(el);

  listen(): void {
    window.addEventListener('scroll', () => (this.scrolled = window.scrollY), { passive: true });

    // The element a navigation started from (an avatar, a list item). Only a
    // click in the last second counts, so a later move made by code (after a
    // reply is posted, say) isn't taken for one that started from it.
    document.addEventListener(
      'click',
      (e) => {
        this.clicked = e.target instanceof Element ? e.target : null;
        this.clickedAt = Date.now();
      },
      true
    );

    this.countRequests();
    this.wrapRouteSet();
    this.wrapHistory();
  }

  // Counts what the new page asks the server for while the transition waits.
  // Wrapped, not replaced: other extensions' wrappers keep working.
  private countRequests(): void {
    const self = this;

    override(app, 'request', function (original, ...args) {
      const request = original(...args);
      const set = self.asked;

      if (set) {
        set.add(request);
        const done = () => set.delete(request);
        request.then(done, done);
      }

      return request;
    });
  }

  // Mithril has no hook for "a move between pages is about to happen", so
  // the global m.route.set is wrapped (through Flarum's override, which keeps
  // any other extension's wrapper in the chain) to run the move inside a
  // transition.
  private wrapRouteSet(): void {
    const self = this;

    override(m.route, 'set', function (original, ...args) {
      const source = Date.now() - self.clickedAt < 1000 ? self.clicked : null;
      self.clicked = null;

      const from = self.here;
      const go = () => {
        original(...args);
        self.here = location.pathname;
      };

      if (self.shouldAnimate(from, String(args[0]))) self.run(go, source, from);
      else go();
    });
  }

  // Back and forward: hold Mithril's own listener back, then hand the event
  // on from inside the transition. This listener is added before the forum
  // mounts, so it runs first.
  private wrapHistory(): void {
    window.addEventListener('popstate', (e) => {
      if (this.replaying) return;

      const from = this.here;
      this.here = location.pathname;

      if (!this.shouldAnimate(from, this.here)) return;

      e.stopImmediatePropagation();
      window.scrollTo(0, this.scrolled);
      this.run(
        () => {
          this.replaying = true;
          window.dispatchEvent(new PopStateEvent('popstate', { state: e.state }));
          this.replaying = false;
        },
        null,
        from
      );
    });
  }

  private shouldAnimate(fromPath: string, to: string): boolean {
    if (this.reduce.matches || document.hidden) return false;

    const from = pageKey(fromPath);
    const next = pageKey(to);

    // Moving within one discussion (a post link, the reply route) or only
    // changing the list's sort keeps the page where it is.
    return from.path !== next.path && !(from.id && from.id === next.id);
  }

  private run(navigate: () => void, source: Element | null, from: string): void {
    const before = app.current;
    const leaving = pageKey(from).key;
    // The pair either starts from what was clicked (and so belongs to the
    // page being opened) or stands for the page being left.
    const picked = this.glide && source ? fromSource(source) : null;
    const pair = this.glide ? mark(picked || byKey(leaving), this.isStill) : null;
    const id = ++this.runs;
    let held = this.still.hold();

    html.classList.add('segue-vt');

    const transition = document.startViewTransition(async () => {
      unmark(pair);
      this.still.release(held);
      await this.arrive(navigate, before, pair, picked ? null : leaving);
      if (id === this.runs) held = this.still.hold();
    });

    // A transition cut short by the next click rejects these; the move
    // itself has still happened.
    transition.ready.catch(() => {
      /* a skipped transition needs no handling */
    });
    transition.updateCallbackDone.catch(() => {
      /* the move already happened; only its animation was skipped */
    });
    transition.finished
      .catch(() => {
        /* as above */
      })
      .finally(() => {
        this.still.release(held);
        if (id !== this.runs) return;

        html.classList.remove('segue-vt');
        unmark(Array.from(document.querySelectorAll('.segue-vt-title, .segue-vt-avatar')));
      });
  }

  /**
   * Makes the move and waits (within limits) for the new page: drawn, its
   * pair of title and avatar named, and what it asked the server for back.
   * `partner` is the key of the page being left when the pair stands for it.
   */
  private async arrive(navigate: () => void, before: unknown, pair: Element[] | null, partner: string | null | undefined): Promise<void> {
    const requests = (this.asked = new Set());

    try {
      navigate();
      await drawn(before);
      if (pair) mark(await this.partnerOf(pair, partner), this.isStill);
      await until(() => requests.size === 0, SETTLE_WAIT);
    } finally {
      if (this.asked === requests) this.asked = null;
    }
  }

  // The same pair on the new page. A discussion or profile being opened
  // arrives with its data, so it gets a moment to show both pieces; a list
  // being returned to is already drawn.
  private async partnerOf(pair: Element[], partner: string | null | undefined): Promise<Pair | null> {
    if (partner) return byKey(partner);

    const arriving = pageKey(location.pathname).key;
    let found: Pair | null = null;

    if (arriving) await until(() => count((found = byKey(arriving, true))) >= pair.length, arriving[0] === 't' ? 100 : PAIR_WAIT);

    return found;
  }
}

// While a transition waits, the browser runs no animation frames, and
// Mithril redraws on one. So the page is drawn here, by hand.
function drawn(before: unknown): Promise<void> {
  return until(() => app.current !== before, ROUTE_WAIT);
}

// Redraws, then tests, every 30 ms until the test passes or time runs out.
// Redrawing first matters: data that arrived since the last check (a
// widget's rows) only reaches the page through a redraw.
function until(test: () => boolean, limit: number): Promise<void> {
  const started = Date.now();

  return new Promise((resolve) => {
    const check = () => {
      m.redraw.sync();
      if (test() || Date.now() - started > limit) return resolve();
      setTimeout(check, 30);
    };
    check();
  });
}
