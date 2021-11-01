// in a future i'll probably just try to implement only meaningful features of
// that module needed for this project
//module.exports = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
// use axios for better timeout support... 
module.exports = require('axios');
