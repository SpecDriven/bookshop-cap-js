// Scenarios: specs/custom-logic/discount-for-overstocked-books.feature.md and
// specs/custom-logic/submit-order.feature.md in specs-cap-bookshop.
const cds = require('@sap/cds')
const { GET, POST, PATCH, expect } = cds.test(__dirname + '/..')
const bob = { auth: { username: 'bob', password: '' } }
const order = (book, quantity) => POST('/browse/submitOrder', { book, quantity }, bob)
const stockOf = async id => (await GET(`/admin/Books/${id}/stock/$value`)).data

describe('Discount for overstocked books', () => {

  it('is written as an after READ handler on Books', () => {
    const { CatalogService } = cds.services
    expect(CatalogService).to.be.instanceOf(cds.ApplicationService)
    const handler = CatalogService.handlers.after.find(h => h.after === 'READ' && h.path === 'CatalogService.Books')
    expect(handler, 'after READ Books handler').to.exist
  })

  it('flags overstocked books in the catalog', async () => {
    const { data } = await GET('/browse/Books?$select=ID,title,stock')
    expect(data.value).to.eql([
      { ID: 201, stock: 12, title: 'Wuthering Heights' },
      { ID: 207, stock: 11, title: 'Jane Eyre' },
      { ID: 251, stock: 333, title: 'The Raven -- 11% discount!' },
      { ID: 252, stock: 555, title: 'Eleonora -- 11% discount!' },
      { ID: 271, stock: 22, title: 'Catweazle' },
    ])
  })

  it('leaves the stored title unchanged', async () => {
    expect((await GET('/browse/Books/251?$select=title,stock')).data.title).to.equal('The Raven -- 11% discount!')
    expect((await GET('/admin/Books/251?$select=title')).data.title).to.equal('The Raven')
    const { Books } = cds.entities('sap.capire.bookshop')
    expect(await SELECT.one.from(Books, 251, b => b.title)).to.eql({ title: 'The Raven' })
  })

  it('does not discount exactly 111 in stock', async () => {
    await POST('/admin/Books', { ID: 290, title: 'Borderline', author_ID: 101, genre_ID: 11, stock: 111 })
    expect((await GET('/browse/Books/290?$select=title,stock')).data.title).to.equal('Borderline')
    await PATCH('/admin/Books/290', { stock: 112 })
    expect((await GET('/browse/Books/290?$select=title,stock')).data.title).to.equal('Borderline -- 11% discount!')
  })

  it('leaves books without a stock value alone', async () => {
    await POST('/admin/Books', { ID: 291, title: 'Unstocked', author_ID: 101, genre_ID: 11 })
    const { data } = await GET('/browse/Books/291?$select=title,stock')
    expect(data).to.include({ title: 'Unstocked', stock: null })
  })
})

describe('Submit order', () => {

  beforeEach(async () => { await PATCH('/admin/Books/201', { stock: 12 }) })

  it('rejects anonymous orders', async () => {
    await expect(POST('/browse/submitOrder', { book: 201, quantity: 3 })).to.be.rejectedWith(/401/)
    expect(await stockOf(201)).to.equal(12)
  })

  it('reduces the stock', async () => {
    const { status } = await order(201, 3)
    expect(status).to.equal(200)
    expect(await stockOf(201)).to.equal(9)
  })

  it('should reject out-of-stock orders', async () => {
    await expect(order(201, 5)).to.be.fulfilled
    await expect(order(201, 5)).to.be.fulfilled
    await expect(order(201, 5)).to.be.rejectedWith(/409 - 5 exceeds stock for book #201/)
    expect(await stockOf(201)).to.equal(2)
  })

  it('rejects quantities below one', async () => {
    await expect(order(201, 0)).to.be.rejectedWith(/400 - quantity has to be 1 or more/)
    await expect(order(201, -1)).to.be.rejectedWith(/400 - quantity has to be 1 or more/)
    expect(await stockOf(201)).to.equal(12)
  })

  it('orders the stock down to zero', async () => {
    for (const expected of [9, 6, 3, 0]) {
      await expect(order(201, 3)).to.be.fulfilled
      expect(await stockOf(201)).to.equal(expected)
    }
    await expect(order(201, 3)).to.be.rejectedWith(/409 - 3 exceeds stock for book #201/)
    expect(await stockOf(201)).to.equal(0)
  })

  it('checks and updates the stock in one statement', async () => {
    const results = await Promise.allSettled([order(201, 12), order(201, 12)])
    expect(results.filter(r => r.status === 'fulfilled')).to.have.length(1)
    expect(results.filter(r => r.status === 'rejected')).to.have.length(1)
    expect(await stockOf(201)).to.equal(0)
  })

  it('reports unknown books', async () => {
    await expect(order(999, 1)).to.be.rejectedWith(/404 - Book #999 doesn't exist/)
  })
})
