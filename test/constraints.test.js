// Scenarios: specs/custom-logic/input-validation.feature.md in specs-cap-bookshop.
const cds = require('@sap/cds')
const { GET, POST, expect } = cds.test(__dirname + '/..')

let nextId = 300
const book = fields => ({ ID: nextId++, title: 'Test Book', author_ID: 101, genre_ID: 11, stock: 1, price: 10, ...fields })

/** The error body of a request rejected with 400 */
async function rejected (path, data) {
  const err = await POST(path, data).catch(e => e)
  expect(err.response, `${JSON.stringify(data)} was accepted`).to.exist
  expect(err.response.status).to.equal(400)
  return err.response.data.error
}

describe('Input validation', () => {

  it('requires the title', async () => {
    const { ID, ...noTitle } = book(); delete noTitle.title
    expect(await rejected('/admin/Books', { ID, ...noTitle })).to.include({ target: 'title' })
    expect(await rejected('/admin/Books', book({ title: '' }))).to.include({ target: 'title' })
  })

  it('requires the author to exist', async () => {
    expect(await rejected('/admin/Books', book({ author_ID: 999 })))
      .to.include({ message: 'Specified Author does not exist', target: 'author_ID' })
  })

  it('requires the genre and that it exists', async () => {
    const noGenre = book(); delete noGenre.genre_ID
    expect(await rejected('/admin/Books', noGenre)).to.include({ code: 'ASSERT_MANDATORY', target: 'genre_ID' })
    expect(await rejected('/admin/Books', book({ genre_ID: 99 })))
      .to.include({ message: 'Specified Genre does not exist', target: 'genre_ID' })
  })

  it('accepts prices between 1 and 111 inclusive', async () => {
    for (const [price, result] of [[0.99, 'rejected'], [1, 'accepted'], [55.50, 'accepted'], [111, 'accepted'], [111.01, 'rejected']]) {
      if (result === 'accepted') await expect(POST('/admin/Books', book({ price })), `price ${price}`).to.be.fulfilled
      else expect(await rejected('/admin/Books', book({ price }))).to.include({ code: 'ASSERT_RANGE', target: 'price' })
    }
  })

  it('accepts only positive stock', async () => {
    for (const [stock, result] of [[-1, 'rejected'], [0, 'rejected'], [1, 'accepted'], [555, 'accepted']]) {
      if (result === 'accepted') await expect(POST('/admin/Books', book({ stock })), `stock ${stock}`).to.be.fulfilled
      else expect(await rejected('/admin/Books', book({ stock }))).to.include({ code: 'ASSERT_RANGE', target: 'stock' })
    }
  })

  it('enforces every constraint before anything is written', async () => {
    const count = async () => (await GET('/admin/Books/$count')).data
    const before = await count()
    const error = await rejected('/admin/Books', { ID: nextId++, author_ID: 999, genre_ID: 99, stock: 0, price: 0 })
    const targets = error.details.map(d => d.target)
    for (const target of ['title', 'stock', 'price']) expect(targets).to.include(target)
    expect(await count()).to.equal(before)
  })

  it('validates authors and genres too', async () => {
    expect(await rejected('/admin/Authors', { ID: 401 })).to.include({ code: 'ASSERT_MANDATORY', target: 'name' })
    const dates = await rejected('/admin/Authors', { ID: 402, name: 'X', dateOfBirth: '2000-01-01', dateOfDeath: '1990-01-01' })
    expect(dates.details.map(d => d.message)).to.include('Date of birth cannot be after date of death')
    expect(await rejected('/admin/Genres', { ID: 50 })).to.include({ code: 'ASSERT_MANDATORY', target: 'name' })
    expect(await rejected('/admin/Genres', { ID: 51, name: 'Loop', parent_ID: 51 }))
      .to.include({ message: 'A genre cannot be its own parent', target: 'parent_ID' })
  })
})
