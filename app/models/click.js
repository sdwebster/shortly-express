// why not 'config.js'?
var db = require('../config');
var Link = require('./link.js')

var Click = db.Model.extend({
  tableName: 'clicks',
  hasTimestamps: true,
  link: function() {
    // attach the link to a Sequelize table?
    return this.belongsTo(Link, 'link_id');
  }
});

module.exports = Click;
