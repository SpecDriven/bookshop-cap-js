# bookshop-cap-js

The [CAP getting-started bookshop](https://cap.cloud.sap/docs/get-started/bookshop)
as a Node.js application, generated from the SpecDriven specifications in
[specs-cap-bookshop](https://github.com/SpecDriven/specs-cap-bookshop).
Every scenario there that the tutorial shows (`[published]`) is implemented
and covered by a test; the scenarios found only in the ready-made sample
(`[proposed]`) are implemented where they do not contradict a published one.

## Run

```sh
npm install
cds watch          # serves http://localhost:4004 with an in-memory SQLite database
npm test           # jest with cds.test, one file per spec area
```

`cds watch` needs the CAP CLI (`npm i -g @sap/cds-dk`). Mock users `alice`
(role `admin`) and `bob` sign in with basic auth and an empty password, e.g.
`Authorization: Basic alice:`. `test/requests.http` holds ready-made requests
for a REST client.

## Layout

| Path | What | Specs |
| --- | --- | --- |
| `db/schema.cds` | Books, Authors, Genres in namespace `sap.capire.bookshop` | domain-model/books-authors-genres |
| `db/data/*.csv` | Seed data, loaded into the in-memory database on every start | domain-model/initial-data |
| `srv/admin-service.cds` | `AdminService` at `/admin`: full CRUD on all three entities | services/admin-service |
| `srv/admin-service.js` | Generated IDs (`max(ID) + 4`) for new authors and books | services/admin-service |
| `srv/admin-constraints.cds` | `@mandatory`, `@assert` and `@assert.range` on the admin entities | custom-logic/input-validation |
| `srv/cat-service.cds` | `CatalogService` at `/browse`: read-only, denormalized `Books` and `ListOfBooks`, `submitOrder`, `OrderedBook` | services/catalog-service, custom-logic/submit-order |
| `srv/cat-service.js` | The discount note for overstocked books and the `submitOrder` handler | custom-logic/discount-for-overstocked-books, custom-logic/submit-order |
| `srv/user-service.cds` | `UserService` at `/user`: `login()` tells a UI who is signed in | ui/vue-bookshop-ui |
| `app/vue/` | A plain-AJAX Vue.js consumer of `CatalogService`, at `/vue/` | ui/vue-bookshop-ui |
| `test/requests.http` | The tutorial's REST client requests | services/served-out-of-the-box |

## Tests

| Test file | Spec files |
| --- | --- |
| `test/domain-model.test.js` | domain-model/books-authors-genres |
| `test/initial-data.test.js` | domain-model/initial-data |
| `test/odata.test.js` | services/served-out-of-the-box, services/catalog-service, services/admin-service, ui/welcome-page |
| `test/custom-handlers.test.js` | custom-logic/discount-for-overstocked-books, custom-logic/submit-order |
| `test/constraints.test.js` | custom-logic/input-validation |
| `test/consuming-services.test.js` | querying/cql-queries |
| `test/consuming-actions.test.js` | custom-logic/submit-order (return value and event) |

Each scenario in the spec repo links to its test with a `[test: … ]` line.

## Where this differs from the ready-made sample

- Genres are the tutorial's four rows keyed by small integers, not the
  sample's UUID hierarchy, and the author is spelled "Edgar Allan Poe".
- `ListOfBooks` flattens `genre` to its name like `Books` does. Keeping the
  association would auto-expose `Genres` in `/browse`, which the published
  "Authors and Genres are not exposed" scenario forbids. Only `currency` is
  expandable on `ListOfBooks`.
- There is no `image` field; the Vue details pane selects `descr,stock`.
- Books carry `descr`, `price` and `currency` in the seed data so that the
  search, currency and Vue scenarios work; the tutorial's own CSV has only
  the five columns the "Five books are seeded" scenario lists.
- `AdminService` is open to anyone, as in the tutorial. The `@requires:
  'admin'` line is present but commented out in `srv/admin-constraints.cds`.
