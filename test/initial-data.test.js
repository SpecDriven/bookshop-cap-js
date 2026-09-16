// Scenarios: specs/domain-model/initial-data.feature.md in specs-cap-bookshop.
const cds = require('@sap/cds')
const { GET, expect } = cds.test(__dirname + '/..')
const fs = require('fs'), path = require('path')

describe('Initial data', () => {

  it('deploys an in-memory database automatically', () => {
    expect(cds.db.kind).to.equal('sqlite')
    expect(cds.db.options.credentials.url).to.equal(':memory:')
  })

  it('loads every CSV file on every restart', async () => {
    const dir = path.join(cds.root, 'db/data')
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.csv'))
    for (const file of ['sap.capire.bookshop-Authors.csv', 'sap.capire.bookshop-Books.csv', 'sap.capire.bookshop-Genres.csv']) {
      expect(files).to.include(file)
    }
    for (const file of files) {
      const rows = fs.readFileSync(path.join(dir, file), 'utf8').split('\n').filter(Boolean).length - 1
      const entity = file.replace(/\.csv$/, '').replace('-', '.')
      const { count } = await SELECT.one `count(*) as count` .from(entity)
      expect(count, file).to.equal(rows)
    }
  })

  it('seeds five books', async () => {
    const { data } = await GET('/admin/Books?$select=ID,title,author_ID,genre_ID,stock')
    expect(data.value).to.eql([
      { ID: 201, title: 'Wuthering Heights', author_ID: 101, genre_ID: 11, stock: 12 },
      { ID: 207, title: 'Jane Eyre', author_ID: 107, genre_ID: 11, stock: 11 },
      { ID: 251, title: 'The Raven', author_ID: 150, genre_ID: 16, stock: 333 },
      { ID: 252, title: 'Eleonora', author_ID: 150, genre_ID: 15, stock: 555 },
      { ID: 271, title: 'Catweazle', author_ID: 170, genre_ID: 13, stock: 22 },
    ])
  })

  it('resolves foreign keys given as association_ID columns', async () => {
    const { data } = await GET('/admin/Books/251?$select=author_ID,genre_ID&$expand=author($select=name),genre($select=name)')
    expect(data).to.containSubset({ author_ID: 150, genre_ID: 16, author: { name: 'Edgar Allan Poe' }, genre: { name: 'Mystery' } })
  })

  it('seeds four authors', async () => {
    const { data } = await GET('/admin/Authors?$select=ID,name')
    expect(data.value).to.eql([
      { ID: 101, name: 'Emily Brontë' },
      { ID: 107, name: 'Charlotte Brontë' },
      { ID: 150, name: 'Edgar Allan Poe' },
      { ID: 170, name: 'Richard Carpenter' },
    ])
  })

  it('seeds four genres', async () => {
    const { data } = await GET('/admin/Genres?$select=ID,name')
    expect(data.value).to.eql([
      { ID: 11, name: 'Drama' },
      { ID: 13, name: 'Fantasy' },
      { ID: 15, name: 'Romance' },
      { ID: 16, name: 'Mystery' },
    ])
  })

  it('seeds translated titles from a texts file', async () => {
    const { data: de } = await GET('/browse/Books/201?$select=title', { headers: { 'accept-language': 'de' } })
    expect(de.title).to.equal('Sturmhöhe')
    const { data: xx } = await GET('/browse/Books/201?$select=title', { headers: { 'accept-language': 'xx' } })
    expect(xx.title).to.equal('Wuthering Heights')
    const { data: none } = await GET('/browse/Books/201?$select=title')
    expect(none.title).to.equal('Wuthering Heights')
  })
})
