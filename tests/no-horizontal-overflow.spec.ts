import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

/**
 * The page body must never scroll horizontally (CLAUDE.md) — wide content
 * scrolls inside its own container instead. This sweeps the real routes at
 * real widths and asserts exactly that.
 *
 * The assertion is deliberately narrow: `documentElement.scrollWidth` against
 * its `clientWidth`, and nothing else. An earlier version of this check looked
 * for any element extending past the viewport and cried wolf on the topo
 * carousel, the directory card rail and Leaflet's tile layer — all of which
 * are supposed to do that, inside their own scroller. Only the document's own
 * overflow is a bug.
 *
 * Ids are discovered from the API rather than hardcoded, so this doesn't rot
 * the next time the local database is reseeded. Data-backed routes skip
 * themselves if the backend has nothing to show.
 *
 * This covers the states someone thought to enumerate. For the ones nobody
 * did, see palabatu-fe/src/lib/overflowGuard.ts, which runs in the dev app.
 */

const WIDTHS = [320, 360, 768, 1280];

// Same account the local Docker database seeds for admin testing. If sign-in
// fails (fresh database, different credentials), the admin sweep skips rather
// than failing — a missing fixture is not an overflow bug.
const ADMIN = { email: 'admin1@gmail.com', password: '123456' };

type Route = { name: string; path: string };

/** Routes that need no data and no session. */
const STATIC_ROUTES: Route[] = [
    { name: 'landing', path: '/' },
    { name: 'login', path: '/login' },
    { name: 'signup', path: '/signup' },
    { name: 'not-found', path: '/this-route-does-not-exist' },
];

/**
 * Reads through the Vite dev server so the proxy in vite.config.ts supplies
 * the API origin — no second base URL to keep in step, and no CORS.
 */
async function discoverRoutes(request: APIRequestContext): Promise<Route[]> {
    const routes: Route[] = [
        { name: 'directory', path: '/directory' },
        { name: 'directory-spots', path: '/directory/spots' },
        { name: 'directory-all', path: '/directory/all' },
    ];

    const cragsRes = await request.get('/api/crags');
    if (!cragsRes.ok()) return routes;
    const crags = await cragsRes.json();
    if (!Array.isArray(crags) || crags.length === 0) return routes;

    // Longest name first, everywhere. User-typed text is the likeliest cause
    // of a page overflowing sideways, and picking whatever happens to be first
    // means the sweep passes on short seed names while a real contributor's
    // 100-character spot name breaks the page. scripts/seed-demo-crags.sql
    // seeds one deliberately at the cap so there is always a worst case here.
    const byNameLength = (a: { name?: string | null }, b: { name?: string | null }) =>
        (b.name?.length ?? 0) - (a.name?.length ?? 0);

    // Prefer a crag that actually has rocks on it; an empty one exercises the
    // empty state rather than the populated layout this is trying to stress.
    for (const crag of [...crags].sort(byNameLength)) {
        const bouldersRes = await request.get(`/api/crags/${crag.id}/boulders`);
        if (!bouldersRes.ok()) continue;
        const boulders = await bouldersRes.json();
        if (!Array.isArray(boulders) || boulders.length === 0) continue;

        routes.push({ name: 'crag', path: `/crags/${crag.id}` });

        // A photo makes the page taller and adds the credit lines, so prefer
        // one; among those, take the longest-named.
        const sorted = [...boulders].sort(byNameLength);
        const target = sorted.find(b => (b.image_urls?.length ?? 0) > 0) ?? sorted[0];
        routes.push({ name: 'boulder', path: `/boulders/${target.id}` });

        const problemsRes = await request.get('/api/problems');
        const problems = problemsRes.ok() ? await problemsRes.json() : [];
        const problem = Array.isArray(problems)
            ? [...problems].sort(byNameLength).find(p => p.boulder_id === target.id)
                ?? [...problems].sort(byNameLength)[0]
            : null;
        if (problem) routes.push({ name: 'problem', path: `/problems/${problem.id}` });

        break;
    }

    return routes;
}

async function signIn(request: APIRequestContext): Promise<string | null> {
    const res = await request.post('/auth/signin', { data: ADMIN });
    if (!res.ok()) return null;
    const body = await res.json();
    return typeof body.token === 'string' ? body.token : null;
}

/**
 * Navigates and returns the document's overflow, plus a description of the
 * widest thing sticking out so a failure says what to go and look at.
 *
 * Waits on `load` rather than `networkidle`: the directory keeps fetching
 * thumbnails, so networkidle never arrives there and the whole sweep times
 * out instead of measuring anything.
 */
async function measure(page: Page, path: string) {
    await page.goto(path, { waitUntil: 'load' });
    await page.waitForTimeout(1500);

    return page.evaluate(() => {
        const root = document.documentElement;
        const vw = root.clientWidth;
        const contained = new Set(['auto', 'scroll', 'hidden', 'clip']);

        const insideScroller = (el: Element) => {
            for (let a = el.parentElement; a && a !== root; a = a.parentElement) {
                if (contained.has(getComputedStyle(a).overflowX)) return true;
            }
            return false;
        };

        const describe = (el: Element) => {
            const chain: string[] = [];
            for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) {
                const raw = a.getAttribute('class') ?? '';
                const cls = raw.trim().split(/\s+/).filter(Boolean).slice(0, 4).join('.');
                chain.push(a.tagName.toLowerCase() + (cls ? `.${cls}` : ''));
            }
            return chain.slice(0, 6).join(' < ');
        };

        // Collect every candidate first, then pick. Filtering as we go (drop
        // anything whose child also sticks out) reported nothing at all on the
        // real bug this was written against: it dropped the offending row and
        // its button, and the leaf below them was an icon path inside a lucide
        // <svg>, which computes overflow-x: hidden and so read as a scroller.
        // Duplicated from palabatu-fe/src/lib/overflowGuard.ts on purpose --
        // that runs in the app, this runs inside page.evaluate.
        const candidates: Element[] = [];
        if (root.scrollWidth > vw + 1) {
            for (const el of Array.from(document.querySelectorAll('body *'))) {
                const r = el.getBoundingClientRect();
                if (r.width === 0 || r.height === 0) continue;
                if (r.right <= vw + 1) continue;
                if (insideScroller(el)) continue;
                candidates.push(el);
            }
        }

        // Document order, so the first is the outermost -- the element whose
        // own CSS is wrong, rather than an icon inside it.
        const outer = candidates[0];
        const inner = candidates[candidates.length - 1];
        const offender = outer && inner
            ? describe(outer) + (outer !== inner ? ` (innermost: ${describe(inner)})` : '')
            : null;

        return { scrollWidth: root.scrollWidth, clientWidth: vw, offender };
    });
}

for (const width of WIDTHS) {
    test.describe(`no horizontal overflow at ${width}px`, () => {
        test.use({ viewport: { width, height: 900 } });

        test('logged out', async ({ page, request }) => {
            const routes = [...STATIC_ROUTES, ...(await discoverRoutes(request))];
            for (const route of routes) {
                const { scrollWidth, clientWidth, offender } = await measure(page, route.path);
                expect(
                    scrollWidth,
                    `${route.name} (${route.path}) at ${width}px scrolls sideways; widest thing sticking out: ${offender ?? 'unknown'}`,
                ).toBeLessThanOrEqual(clientWidth + 1);
            }
        });

        test('signed in as admin', async ({ page, request }) => {
            const token = await signIn(request);
            test.skip(!token, 'no admin test account in this database');

            const routes = [
                ...(await discoverRoutes(request)),
                { name: 'needs-attention', path: '/admin/needs-attention' },
                { name: 'merge-requests', path: '/admin/merge-requests' },
                { name: 'reports', path: '/admin/reports' },
                { name: 'notifications', path: '/notifications' },
            ];

            await page.goto('/');
            await page.evaluate(t => localStorage.setItem('token', t), token!);

            for (const route of routes) {
                const { scrollWidth, clientWidth, offender } = await measure(page, route.path);
                expect(
                    scrollWidth,
                    `${route.name} (${route.path}) at ${width}px scrolls sideways as admin; widest thing sticking out: ${offender ?? 'unknown'}`,
                ).toBeLessThanOrEqual(clientWidth + 1);
            }
        });
    });
}
