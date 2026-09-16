// Scenarios: specs/domain-model/books-authors-genres.feature.md in specs-cap-bookshop.
const cds = require('@sap/cds')
const { POST, expect } = cds.test(__dirname + '/..')
const alice = { auth: { username: 'alice', password: '' } }

describe('Books, Authors and Genres', () => {

  it('gives a book one author and one genre', () => {
    const { Books } = cds.entities('sap.capire.bookshop')
    const { ID, title, descr, stock, price, currency, author, genre } = Books.elements
    expect(ID).to.include({ key: true, type: 'cds.Integer' })
    expect(title).to.include({ type: 'cds.String', localized: true })
    expect(descr).to.include({ type: 'cds.String', localized: true })
    expect(stock.type).to.equal('cds.Integer')
    expect(price.type).to.equal('cds.Decimal')
    expect(currency.type).to.equal('cds.Association')
    expect(author).to.include({ type: 'cds.Association', target: 'sap.capire.bookshop.Authors' })
    expect(author.is2one).to.be.true
    expect(genre).to.include({ type: 'cds.Association', target: 'sap.capire.bookshop.Genres' })
    expect(genre.is2one).to.be.true
  })

  it('gives an author many books', async () => {
    const { Authors } = cds.entities('sap.capire.bookshop')
    expect(Authors.elements.ID).to.include({ key: true, type: 'cds.Integer' })
    expect(Authors.elements.name.type).to.equal('cds.String')
    const { books } = Authors.elements
    expect(books).to.include({ type: 'cds.Association', target: 'sap.capire.bookshop.Books' })
    expect(books.is2many).to.be.true
    expect(books.on).to.eql([{ ref: ['books', 'author'] }, '=', { ref: ['$self'] }])
    const poe = await SELECT.one.from(Authors, 150, a => { a.books(b => b.ID) })
    expect(poe.books.map(b => b.ID)).to.eql([251, 252])
  })

  it('fills in the managed fields', async () => {
    const { data } = await POST('/admin/Authors', { ID: 460, name: 'Managed' }, alice)
    expect(data).to.include({ createdBy: 'alice', modifiedBy: 'alice' })
    expect(data.createdAt).to.be.a('string')
    expect(data.modifiedAt).to.equal(data.createdAt)
  })

  it('takes Currency from the common reuse types', async () => {
    const { Books } = cds.entities('sap.capire.bookshop')
    const { Currencies } = cds.entities('sap.common')
    expect(Books.elements.currency.target).to.equal('sap.common.Currencies')
    expect(Object.keys(Currencies.keys)).to.eql(['code'])
    const [ddl] = cds.compile.to.sql(await cds.load('db/schema')).filter(s => s.includes('TABLE sap_capire_bookshop_Books '))
    expect(ddl).to.contain('currency_code NVARCHAR(3)')
  })

  it('lets genres form a hierarchy', async () => {
    const { Genres } = cds.entities('sap.capire.bookshop')
    expect(Genres.includes).to.include('sap.common.CodeList')
    expect(Genres.elements.ID).to.include({ key: true, type: 'cds.Integer' })
    expect(Genres.elements.name.type).to.equal('cds.String')
    expect(Genres.elements.parent).to.include({ type: 'cds.Association', target: 'sap.capire.bookshop.Genres' })
    const genres = await SELECT.from(Genres, g => { g.ID, g.parent_ID })
    expect(genres.map(g => g.parent_ID)).to.eql([null, null, null, null])
  })

  it('can be inspected as CSN', async () => {
    const csn = await cds.load('db/schema')
    for (const name of ['Books', 'Authors', 'Genres']) expect(csn.definitions).to.have.property('sap.capire.bookshop.' + name)
    const json = JSON.parse(cds.compile.to.json(csn))
    expect(json.definitions['sap.capire.bookshop.Books'].elements).to.have.property('title')
    expect(json.definitions['sap.capire.bookshop.Books'].elements).to.have.property('author')
    expect(cds.compile.to.yaml(csn)).to.contain('sap.capire.bookshop.Books:')
    expect(cds.compile.to.sql(csn).join('\n')).to.contain('CREATE TABLE sap_capire_bookshop_Books')
  })

  it('compiles to SQL DDL', async () => {
    const ddl = cds.compile.to.sql(await cds.load('db/schema'))
    const tables = ddl.map(s => s.match(/CREATE TABLE (\w+)/)?.[1])
    for (const table of ['sap_capire_bookshop_Books', 'sap_capire_bookshop_Authors', 'sap_capire_bookshop_Genres']) expect(tables).to.include(table)
    const books = ddl.find(s => s.includes('TABLE sap_capire_bookshop_Books '))
    for (const column of [
      'ID INTEGER NOT NULL', 'title NVARCHAR(255)', 'descr NVARCHAR(2000)', 'stock INTEGER',
      'price DECIMAL(9, 2)', 'author_ID INTEGER', 'genre_ID INTEGER', 'currency_code NVARCHAR(3)', 'PRIMARY KEY(ID)',
    ]) expect(books, column).to.contain(column)
  })
})
