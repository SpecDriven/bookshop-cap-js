// Scenarios: specs/querying/cql-queries.feature.md in specs-cap-bookshop.
const cds = require('@sap/cds')
const { expect } = cds.test(__dirname + '/..')

describe('Querying with CQL', () => {

  const expectedAuthors = [
    { ID: 101, name: 'Emily Brontë', books: [{ ID: 201, title: 'Wuthering Heights', genre: 'Drama' }] },
    { ID: 107, name: 'Charlotte Brontë', books: [{ ID: 207, title: 'Jane Eyre', genre: 'Drama' }] },
    { ID: 150, name: 'Edgar Allan Poe', books: [{ ID: 251, title: 'The Raven', genre: 'Mystery' }, { ID: 252, title: 'Eleonora', genre: 'Romance' }] },
    { ID: 170, name: 'Richard Carpenter', books: [{ ID: 271, title: 'Catweazle', genre: 'Fantasy' }] },
  ]
  const expectedBooks = [
    { ID: 201, title: 'Wuthering Heights', genre: 'Drama' },
    { ID: 207, title: 'Jane Eyre', genre: 'Drama' },
    { ID: 251, title: 'The Raven', genre: 'Mystery' },
    { ID: 252, title: 'Eleonora', genre: 'Romance' },
    { ID: 271, title: 'Catweazle', genre: 'Fantasy' },
  ]

  it('follows to-many associations with nested projections', async () => {
    const authors = await SELECT.from `Authors { ID, name, books { ID, title, genre.name as genre } }`
    expect(authors).to.eql(expectedAuthors)
  })

  it('reaches across associations with path expressions', async () => {
    const books = await SELECT `ID, title, genre.name as genre` .from `Books`
    expect(books).to.eql(expectedBooks)
  })

  it('answers the same queries through the services', async () => {
    const CatalogService = await cds.connect.to('CatalogService')
    const AdminService = await cds.connect.to('AdminService')
    expect(await CatalogService.read `ID, title, genre` .from `Books`).to.eql(expectedBooks)
    expect(await AdminService.read `Authors { ID, name, books { ID, title, genre.name as genre } }`).to.eql(expectedAuthors)
  })

  it('supports targets as strings or reflected defs', async () => {
    const AdminService = await cds.connect.to('AdminService')
    const { Authors } = AdminService.entities
    expect(await SELECT.from(Authors))
      .to.eql(await AdminService.read(Authors))
      .to.eql(await AdminService.read('Authors'))
      .to.eql(await AdminService.run(SELECT.from(Authors)))
      .to.eql(await AdminService.run(SELECT.from('Authors')))
  })

  it('allows reading from local services using cds.ql', async () => {
    const AdminService = await cds.connect.to('AdminService')
    const authors = await AdminService.read('Authors', a => {
      a.name, a.books(b => { b.title, b.currency(c => { c.name, c.symbol }) })
    }).where('name like', 'E%')
    expect(authors).to.eql([
      { name: 'Emily Brontë', books: [{ title: 'Wuthering Heights', currency: { name: 'British Pound', symbol: '£' } }] },
      { name: 'Edgar Allan Poe', books: [
        { title: 'The Raven', currency: { name: 'US Dollar', symbol: '$' } },
        { title: 'Eleonora', currency: { name: 'US Dollar', symbol: '$' } },
      ] },
    ])
  })
})
