var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/auctionsession', function (req, res, next) {
    res.render('auction_session.ejs', { user: 'Express' });
});

module.exports = router;
