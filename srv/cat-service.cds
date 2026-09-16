using { sap.capire.bookshop as my } from '../db/schema';

service CatalogService @(path:'/browse') {

  /** For display in details pages */
  @readonly entity Books as projection on my.Books {
    *, // all fields with the following denormalizations:
    author.name as author,
    genre.name as genre,
  } excluding { author, genre, createdBy, modifiedBy };

  /** For displaying lists of Books: no description, currency expandable */
  @readonly entity ListOfBooks as projection on my.Books {
    *, author.name as author, genre.name as genre
  } excluding { author, genre, descr, createdBy, modifiedBy };
}

// Custom action to order books, added in the "Adding Custom Logic" step
extend service CatalogService with {
  @requires: 'authenticated-user'
  action submitOrder ( book: my.Books:ID, quantity: Integer ) returns { stock: Integer };
  event OrderedBook : { book: my.Books:ID; quantity: Integer; buyer: String };
}
