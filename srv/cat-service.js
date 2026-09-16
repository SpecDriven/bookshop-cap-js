const cds = require('@sap/cds')

class CatalogService extends cds.ApplicationService { init() {

  const { Books } = cds.entities('sap.capire.bookshop')

  // Add some discount for overstocked books
  this.after('READ', 'Books', results => {
    for (const book of Array.isArray(results) ? results : [results]) {
      if (book?.stock > 111) book.title += ` -- 11% discount!`
    }
  })

  // Reduce stock of ordered books if available stock suffices
  this.on('submitOrder', async req => {
    const { book: id, quantity } = req.data
    if (!(quantity >= 1)) return req.error(400, `quantity has to be 1 or more`)

    // Check and update in one statement, so concurrent orders never
    // take the stock below zero
    const result = await UPDATE(Books, id)
      .with `stock = stock - ${quantity}`
      .where `stock >= ${quantity}`
    const affected = result?.affected ?? result
    if (!affected) {
      const exists = await SELECT.one.from(Books, id, b => b.ID)
      if (!exists) return req.error(404, `Book #${id} doesn't exist`)
      return req.error(409, `${quantity} exceeds stock for book #${id}`)
    }

    // Return the remaining stock
    return await SELECT.one.from(Books, id, b => b.stock)
  })

  // Emit an event when an order has been submitted
  this.after('submitOrder', async (_, req) => {
    const { book, quantity } = req.data
    await this.emit('OrderedBook', { book, quantity, buyer: req.user.id })
  })

  // Delegate requests to the underlying generic service
  return super.init()
}}

module.exports = CatalogService
