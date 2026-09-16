/** Lets a UI find out who is signed in; used by app/vue */
service UserService @(path:'/user') {
  @requires: 'authenticated-user'
  action login() returns { id: String; locale: String; roles: array of String };
}
