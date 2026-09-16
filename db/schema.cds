using { Currency, managed, sap } from '@sap/cds/common';
namespace sap.capire.bookshop;

entity Books : managed {
  key ID   : Integer;
  title    : localized String;
  descr    : localized String(2000);
  author   : Association to Authors;
  genre    : Association to Genres;
  stock    : Integer;
  price    : Decimal(9,2);
  currency : Currency;
}

entity Authors : managed {
  key ID       : Integer;
  name         : String;
  dateOfBirth  : Date;
  dateOfDeath  : Date;
  placeOfBirth : String;
  placeOfDeath : String;
  books        : Association to many Books on books.author = $self;
}

/** Hierarchically organized Code List for Genres */
entity Genres : sap.common.CodeList {
  key ID : Integer;
  parent : Association to Genres;
}
