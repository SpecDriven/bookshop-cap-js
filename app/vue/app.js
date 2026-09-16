/* A plain AJAX consumer of CatalogService: OData requests, no CAP client library.
   Scenarios: specs/ui/vue-bookshop-ui.feature.md in specs-cap-bookshop. */
const { createApp, reactive, ref } = Vue

/** fetch() that unwraps OData JSON and throws the server's error message */
async function request (path, init) {
  const res = await fetch(path, init)
  const body = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error?.message || `${res.status} ${res.statusText}`)
  return body
}
const post = (path, data) => request(path, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data),
})

createApp({ setup () {

  const books = ref([]), details = ref(null), user = ref(null)
  const order = reactive({ book: null, quantity: 1, succeeded: '', failed: '' })

  /** Books are listed with author, genre and price */
  async function fetchBooks (terms) {
    const query = '$expand=currency($select=symbol)' + (terms ? `&$search=${encodeURIComponent(terms)}` : '')
    books.value = (await request(`/browse/ListOfBooks?${query}`)).value
  }

  /** Clicking a row shows the book's details */
  async function inspect (book) {
    const more = await request(`/browse/Books/${book.ID}?$select=descr,stock`)
    details.value = { ...book, ...more }
    order.book = book.ID
    order.succeeded = order.failed = ''
  }

  /** Ordering from the details pane updates the stock */
  async function submitOrder () {
    order.succeeded = order.failed = ''
    try {
      const { stock } = await post('/browse/submitOrder', { book: order.book, quantity: order.quantity })
      order.succeeded = `Successfully ordered ${order.quantity} item(s).`
      details.value.stock = stock
    } catch (e) {
      order.failed = e.message
    }
  }

  /** Login shows the current user; the browser asks for the mock user's credentials */
  async function login () {
    try { user.value = await post('/user/login', {}) }
    catch (e) { user.value = null; alert(e.message) }
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'u' && !/INPUT|TEXTAREA/.test(e.target.tagName)) user.value = null
  })

  fetchBooks()
  return { books, details, user, order, fetch: fetchBooks, inspect, submitOrder, login }
}}).mount('#app')
