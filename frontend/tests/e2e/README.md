# End-to-end tests

Cypress specs that drive the real X POS app in a real browser. They complement
the Vitest unit suite in `frontend/tests/*.spec.ts`: unit tests check a store or
a service in isolation, these check that the whole screen behaves - components,
Pinia stores, watchers, debouncing and reactivity together.

## Running

```bash
yarn test:e2e          # headless; starts a Vite dev server if one isn't running
yarn test:e2e:demo     # headed Chrome at watchable speed - see below
yarn test:e2e:open     # interactive runner
yarn test:e2e:run      # headless against a server you started yourself
```

`yarn test:e2e` reuses a dev server already listening on `:5174`, so running it
alongside `yarn dev` is fine.

Run one spec:

```bash
node scripts/run-cypress.mjs run --with-server --spec tests/e2e/specs/pricing-rules.cy.ts
```

## Watching a run

A normal run is far faster than anyone can follow, which is the point in CI and useless when you
want to show someone the feature working or catch a visual glitch. `--demo` opens real Chrome and
paces the run like a person using the till:

```bash
yarn test:e2e:demo
node scripts/run-cypress.mjs run --with-server --demo --spec tests/e2e/specs/scale-barcodes.cy.ts
```

It pauses after every action, types character by character, and outlines the element each action
touched. Retries are turned off so a flaky spec does not silently replay itself while you watch,
and the command timeout is raised because each action now carries the pause inside it.

Set the pace yourself with `CYPRESS_SLOW_MO` (milliseconds, default `700` in demo mode):

```bash
CYPRESS_SLOW_MO=1500 yarn test:e2e:demo     # slower
CYPRESS_SLOW_MO=250 yarn test:e2e           # headless but paced
```

Unset or `0` disables the whole mechanism, so ordinary runs behave exactly as they did before. The
implementation is `support/slowMotion.ts`.

### Why `scripts/run-cypress.mjs` instead of `cypress` directly

VS Code, Cursor and other Electron-based editors export `ELECTRON_RUN_AS_NODE=1`
into their integrated terminal. That makes Cypress's own Electron start as plain
Node and fail with a confusing `bad option: --no-sandbox`. The wrapper strips the
variable, and optionally manages the dev server.

## How the backend is stubbed

Every app request is `POST /api/method/<dotted.path>` returning `{ message: ... }`
(see `src/services/api.ts`), so one `cy.intercept` covers the whole API. The
route table lives in `support/frappeStub.ts` and is keyed by method name:

```ts
cy.bootPos({
	routes: {
		"xpos.api.pricing_rules.reconcile_line_prices": reconcileWith({ discountPercentage: 10 }),
	},
});
```

Defaults that get the app to a usable POS screen are in `fixtures/pos.ts`; specs
override only what they care about. Anything called but not stubbed returns
`null` and is reported by `unstubbedMethods()` rather than failing the boot.

Stubbing rather than seeding a site keeps the specs fast and deterministic, and
is the only practical way to test the offline path - you can't ask a real server
to disappear mid-test. `cy.goOffline()` / `cy.goOnline()` flip a getter installed
over `navigator.onLine`.

> The stub's state is stored on `window`, not in module scope. Cypress bundles
> the support file and each spec separately, so a plain module-level table would
> give `bootPos` and the spec two different instances.

## Running against a real site

Set a base URL and skip `cy.bootPos()` (which injects a fake boot payload and
installs the stub):

```bash
CYPRESS_BASE_URL=https://your-site.example yarn test:e2e:run
```

You then need a logged-in session, an open POS shift, and matching fixture data.
The specs here assume the stub.

## Layout

| Path                        | Purpose                                                                           |
| --------------------------- | --------------------------------------------------------------------------------- |
| `specs/`                    | The tests                                                                         |
| `support/frappeStub.ts`     | Route table + the single `cy.intercept`                                           |
| `support/commands.ts`       | `cy.bootPos`, `cy.addItemToCart`, `cy.scanBarcode`, `cy.cartRow`, offline toggles |
| `support/slowMotion.ts`     | The `--demo` pacing, off unless `slowMo` is set                                   |
| `fixtures/pos.ts`           | POS profile, items, customers, default routes                                     |
| `fixtures/pricingRules.ts`  | Builders for pricing responses and rule snapshots                                 |
| `fixtures/mixedCurrency.ts` | LBP/USD profile, tagged payment modes, per-currency shift summary                 |
| `fixtures/scaleBarcode.ts`  | Weighed catalogue and `search_barcode` responses, scale and plain                 |

## Gotchas worth knowing

- **`<Cart />` renders twice** (desktop and mobile panels), both in the DOM.
  Always scope to the visible one - `cy.cartRow()` / `cy.cartRows()` do this.
- **`index.html` is a Jinja template.** Under the raw Vite dev server the
  `{{ boot | json }}` placeholders are unrendered, so that inline script throws a
  `SyntaxError`. It's ignored in `support/e2e.ts`, and `cy.bootPos()` injects
  `window.xpos` itself.
- **IndexedDB persists across specs.** `cy.bootPos()` deletes `xpos_offline_v3`
  before the app loads; otherwise a stale cache can make an offline test pass
  that should have failed.
- **A spec that swaps the catalogue must pass `readyItem`.** `cy.bootPos()` waits
  for an item tile to prove the shift/profile boot landed, and defaults to
  `Espresso Beans` from `fixtures/pos.ts`.
- **Currency decimals come from `number_format`,** which `cy.bootPos()` injects
  through its `currencies` option. A spec covering a zero-decimal currency has to
  supply it, or every amount renders at two decimals and the assertions drift.
- **A barcode scanner is a keyboard wedge.** `cy.scanBarcode()` types the digits
  into the scanner input and sends Enter, which is what the hardware does and
  what exercises the component's own handler.
- **Don't slow a command down with `cy.wait().then(() => originalFn())`.** The
  callback hands a chainable back to `.then()`, whose queue cannot drain until the
  outer command finishes, so it waits on itself until the timeout. `slowMotion.ts`
  returns a plain promise after the command instead.
