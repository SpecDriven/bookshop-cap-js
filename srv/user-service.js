const cds = require('@sap/cds')

module.exports = class UserService extends cds.ApplicationService { init() {
  this.on('login', req => ({
    id: req.user.id,
    locale: req.locale,
    roles: Object.keys(req.user.roles ?? {}),
  }))
  return super.init()
}}
