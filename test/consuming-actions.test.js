// Scenarios: specs/custom-logic/submit-order.feature.md in specs-cap-bookshop
// (the action's return value and the OrderedBook event).
const cds = require('@sap/cds')
const { expect } = cds.test(__dirname + '/..')

describe('Consuming actions locally', () => {
  let cats, Books
  const BOOK_ID = 251, QUANTITY = 1

  beforeAll(async () => {
    cats = await cds.connect.to('CatalogService')
    Books = cats.entities.Books
  })

  it('calls unbound actions - basic variant using srv.send', async () => {
    const { stock: before } = await cats.get(Books, BOOK_ID)
    const result = await cats.tx({ user: 'alice' }, () => cats.send('submitOrder', { book: BOOK_ID, quantity: QUANTITY }))
    expect(result.stock).to.equal(before - QUANTITY)
  })

  it('emits an OrderedBook event', async () => {
    const received = []
    cats.on('OrderedBook', msg => { received.push(msg.data) })
    await cats.tx({ user: 'alice' }, () => cats.send('submitOrder', { book: BOOK_ID, quantity: QUANTITY }))
    expect(received).to.eql([{ book: BOOK_ID, quantity: QUANTITY, buyer: 'alice' }])
  })
})
