// Scenarios: specs/services/served-out-of-the-box.feature.md,
// specs/ui/welcome-page.feature.md, specs/services/catalog-service.feature.md,
// specs/services/admin-service.feature.md in specs-cap-bookshop.
const cds = require('@sap/cds')
const { GET, POST, PATCH, PUT, DELETE, expect } = cds.test(__dirname + '/..')
const alice = { auth: { username: 'alice', password: '' } }
const bob = { auth: { username: 'bob', password: '' } }

describe('Served out of the box', () => {

  it('serves $metadata documents in v4', async () => {
    const { headers, status, data } = await GET('/browse/$metadata')
    expect(status).to.equal(200)
    expect(headers['odata-version']).to.equal('4.0')
    expect(headers['content-type']).to.match(/application\/xml/)
    expect(data).to.contain('<EntitySet Name="Books" EntityType="CatalogService.Books">')
  })

  it('serves the same EDMX as cds compile --to edmx', async () => {
    const { data: served } = await GET('/browse/$metadata')
    // The server resolves the i18n labels of the compiled document
    const csn = await cds.load('srv/cat-service')
    const compiled = cds.localize(csn, 'en', cds.compile.to.edmx(csn, { service: 'CatalogService' }))
    const lines = xml => String(xml).trim().split('\n').sort() // element order aside
    expect(lines(served)).to.eql(lines(compiled))
    const fromModel = cds.localize(cds.model, 'en', cds.compile.to.edmx(cds.model, { service: 'CatalogService' }))
    expect(served.trim()).to.equal(String(fromModel).trim())
  })

  it('mounts services at their declared paths', async () => {
    const { AdminService, CatalogService } = cds.services
    expect(AdminService.path).to.equal('/admin')
    expect(CatalogService.path).to.equal('/browse')
    expect(AdminService.definition.$location).to.include({ file: 'srv/admin-service.cds', line: 3 })
    expect(CatalogService.definition.$location).to.include({ file: 'srv/cat-service.cds', line: 3 })
  })

  it('answers the browser URLs from the tutorial', async () => {
    const { data: books } = await GET('/browse/Books?$select=ID,title,genre')
    expect(books['@odata.context']).to.equal('$metadata#Books')
    expect(books.value).to.have.length(5)
    const { data: authors } = await GET('/admin/Authors?$select=ID,name&$expand=books($select=ID,title)')
    expect(authors.value.map(a => a.books.length)).to.eql([1, 1, 2, 1])
  })

  it('signs mock users in with basic auth', async () => {
    const { data: a } = await POST('/user/login', {}, alice)
    expect(a.id).to.equal('alice')
    const { data: b } = await POST('/user/login', {}, bob)
    expect(b.id).to.equal('bob')
    await expect(POST('/user/login', {})).to.be.rejectedWith(/401/)
  })

  it('sends every request in test/requests.http', async () => {
    const text = require('fs').readFileSync(__dirname + '/requests.http', 'utf8')
    const requests = text.split(/^###.*$/m).map(parseRequest).filter(Boolean)
    expect(requests.map(r => r.method + ' ' + r.url)).to.eql([
      "GET /browse/Books?$select=ID,title,author&$filter=contains(author,'Bro')",
      'GET /admin/Authors?$select=ID,name&$expand=books($select=ID,title)',
      'POST /browse/submitOrder',
    ])
    for (const { method, url, headers, auth, data } of requests) {
      const { status } = method === 'GET' ? await GET(url, { headers, auth }) : await POST(url, data, { headers, auth })
      expect(status, `${method} ${url}`).to.be.within(200, 299)
    }
    await PATCH('/admin/Books/201', { stock: 12 }) // the order above took 3
  })
})

/** One block of a REST-client file as an axios request */
function parseRequest (block) {
  const lines = block.split('\n').map(l => l.trimEnd()).filter((l, i, all) => l || all.slice(i).some(Boolean))
  while (lines.length && !lines[0]) lines.shift()
  if (!lines.length) return null
  const [method, target] = lines.shift().split(/\s+/)
  let url = target.replace('http://localhost:4004', '')
  while (lines[0]?.startsWith('&')) url += lines.shift()
  url = url.replace('?&', '?')
  const req = { method, url, headers: {} }
  let line
  while ((line = lines.shift())) {
    const [name, value] = line.split(/:\s*(.*)/)
    if (name.toLowerCase() === 'authorization') {
      const [username, password = ''] = value.replace(/^Basic\s+/, '').split(':')
      req.auth = { username, password }
    } else req.headers[name.toLowerCase()] = value
  }
  if (lines.length) req.data = JSON.parse(lines.join('\n'))
  return req
}

describe('Welcome page', () => {

  it('lists every served endpoint', async () => {
    const { data } = await GET('/')
    for (const href of ['/admin', '/admin/Authors', '/admin/Books', '/admin/Genres', '/browse', '/browse/Books']) {
      expect(data).to.contain(`href="${href}"`)
    }
  })

  it('links to Fiori previews', async () => {
    const { data } = await GET('/')
    expect(data).to.contain('Fiori preview')
    expect(data).to.contain('href="/$fiori-preview/CatalogService/Books')
    expect(data).to.contain('href="/$fiori-preview/AdminService/Authors')
  })
})

describe('Catalog Service', () => {

  it('flattens author and genre to names', async () => {
    const { data } = await GET('/browse/Books?$select=ID,title,genre')
    expect(data.value).to.eql([
      { ID: 201, title: 'Wuthering Heights', genre: 'Drama' },
      { ID: 207, title: 'Jane Eyre', genre: 'Drama' },
      { ID: 251, title: 'The Raven', genre: 'Mystery' },
      { ID: 252, title: 'Eleonora', genre: 'Romance' },
      { ID: 271, title: 'Catweazle', genre: 'Fantasy' },
    ])
    const { data: authors } = await GET('/browse/Books?$select=ID,author')
    expect(authors.value.map(b => b.author)).to.eql([
      'Emily Brontë', 'Charlotte Brontë', 'Edgar Allan Poe', 'Edgar Allan Poe', 'Richard Carpenter',
    ])
  })

  it('does not expose Authors and Genres', async () => {
    await expect(GET('/browse/Authors')).to.be.rejectedWith(/404/)
    await expect(GET('/browse/Genres')).to.be.rejectedWith(/404/)
    const { data } = await GET('/browse/$metadata')
    expect(data).not.to.contain('EntitySet Name="Authors"')
    expect(data).not.to.contain('EntitySet Name="Genres"')
  })

  it('rejects writes to the read-only Books', async () => {
    await expect(POST('/browse/Books', { ID: 1, title: 'x' })).to.be.rejectedWith(/405/)
    await expect(PATCH('/browse/Books/201', { stock: 1 })).to.be.rejectedWith(/405/)
    await expect(PUT('/browse/Books/201', { ID: 201, title: 'x' })).to.be.rejectedWith(/405/)
    await expect(DELETE('/browse/Books/201')).to.be.rejectedWith(/405/)
    const { data } = await GET('/browse/Books/201?$select=title,stock')
    expect(data).to.include({ title: 'Wuthering Heights', stock: 12 })
  })

  it('filters by author name', async () => {
    const { data } = await GET("/browse/Books?$select=ID,title,author&$filter=contains(author,'Bro')")
    expect(data.value).to.eql([
      { ID: 201, title: 'Wuthering Heights', author: 'Emily Brontë' },
      { ID: 207, title: 'Jane Eyre', author: 'Charlotte Brontë' },
    ])
  })

  it('hides createdBy and modifiedBy', async () => {
    const { data } = await GET('/browse/Books/201')
    expect(data).not.to.have.property('createdBy')
    expect(data).not.to.have.property('modifiedBy')
    expect(Object.keys(data).sort()).to.eql(
      ['@odata.context', 'ID', 'title', 'descr', 'author', 'genre', 'stock', 'price', 'currency_code', 'createdAt', 'modifiedAt'].sort(),
    )
    const { data: metadata } = await GET('/browse/$metadata')
    expect(metadata).not.to.contain('Name="createdBy"')
    expect(metadata).not.to.contain('Name="modifiedBy"')
    expect(metadata).to.contain('Name="createdAt"')
  })

  it('supports $top/$skip paging', async () => {
    const { data: p1 } = await GET('/browse/Books?$select=title&$top=3')
    expect(p1.value.map(b => b.title)).to.eql(['Wuthering Heights', 'Jane Eyre', 'The Raven'])
    const { data: p2 } = await GET('/browse/Books?$select=title&$skip=3')
    expect(p2.value.map(b => b.title)).to.eql(['Eleonora', 'Catweazle'])
  })

  it('supports $search in multiple fields', async () => {
    const { data } = await GET('/browse/Books?$search=Po&$select=title,author')
    expect(data.value.map(b => b.ID)).to.eql([201, 207, 251, 252])
    expect(data.value).to.containSubset([
      { title: 'Wuthering Heights', author: 'Emily Brontë' },
      { title: 'Jane Eyre', author: 'Charlotte Brontë' },
      { title: 'The Raven', author: 'Edgar Allan Poe' },
      { title: 'Eleonora', author: 'Edgar Allan Poe' },
    ])
  })

  it('supports $select', async () => {
    const { data } = await GET('/browse/Books?$select=ID,title')
    expect(data.value).to.have.length(5)
    for (const book of data.value) expect(Object.keys(book).sort()).to.eql(['ID', 'title'])
  })

  it('serves ListOfBooks with the currency expanded', async () => {
    const { data } = await GET('/browse/ListOfBooks?$expand=currency($select=symbol)')
    expect(data.value).to.have.length(5)
    for (const book of data.value) expect(book).not.to.have.property('descr')
    expect(data.value).to.containSubset([
      { ID: 251, title: 'The Raven', genre: 'Mystery', currency: { symbol: '$' } },
    ])
  })
})

describe('Admin Service', () => {

  it('supports $value requests', async () => {
    const { data } = await GET('/admin/Books/201/stock/$value')
    expect(data).to.equal(12)
  })

  it('supports $expand', async () => {
    const { data } = await GET('/admin/Authors?$select=ID,name&$expand=books($select=ID,title)')
    expect(data.value).to.eql([
      { ID: 101, name: 'Emily Brontë', books: [{ ID: 201, title: 'Wuthering Heights' }] },
      { ID: 107, name: 'Charlotte Brontë', books: [{ ID: 207, title: 'Jane Eyre' }] },
      { ID: 150, name: 'Edgar Allan Poe', books: [{ ID: 251, title: 'The Raven' }, { ID: 252, title: 'Eleonora' }] },
      { ID: 170, name: 'Richard Carpenter', books: [{ ID: 271, title: 'Catweazle' }] },
    ])
  })

  it('exposes all three entities as-is', async () => {
    const { AdminService } = cds.services
    const domain = cds.entities('sap.capire.bookshop')
    for (const name of ['Authors', 'Books', 'Genres']) {
      const exposed = AdminService.entities[name]
      expect(exposed, name).to.exist
      expect(exposed.query.SELECT.from.ref).to.eql([domain[name].name])
      for (const element of Object.keys(domain[name].elements)) expect(exposed.elements, `${name}.${element}`).to.have.property(element)
    }
    const { data } = await GET('/admin/Books/251')
    expect(data).to.have.property('createdBy')
    expect(data).to.have.property('modifiedBy')
  })

  it('creates, reads, updates and deletes without custom code', async () => {
    const book = { ID: 280, title: 'New Book', author_ID: 170, genre_ID: 13, stock: 5, price: 20 }
    const { status } = await POST('/admin/Books', book, alice)
    expect(status).to.equal(201)
    expect((await GET('/browse/Books/280?$select=title,author,genre')).data)
      .to.include({ title: 'New Book', author: 'Richard Carpenter', genre: 'Fantasy' })
    await PATCH('/admin/Books/280', { title: 'Renamed Book' }, alice)
    expect((await GET('/browse/Books/280?$select=title')).data.title).to.equal('Renamed Book')
    await DELETE('/admin/Books/280', alice)
    await expect(GET('/browse/Books/280')).to.be.rejectedWith(/404/)
  })

  it('generates IDs for new authors and books', async () => {
    const maxId = async entity => (await GET(`/admin/${entity}?$select=ID&$orderby=ID desc&$top=1`)).data.value[0].ID
    const author = await maxId('Authors'), book = await maxId('Books')
    const { data: a } = await POST('/admin/Authors', { name: 'Generated' })
    expect(a.ID).to.equal(author + 4)
    const { data: b } = await POST('/admin/Books', { title: 'Generated', author_ID: a.ID, genre_ID: 11 })
    expect(b.ID).to.equal(book + 4)
    const { data: own } = await POST('/admin/Authors', { ID: 500, name: 'Own ID' })
    expect(own.ID).to.equal(500)
  })
})
