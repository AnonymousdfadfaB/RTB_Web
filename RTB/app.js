//require('dotenv').config();
const express = require('express');
//const mongoose = require('mongoose');
//const session = require('express-session');
//const MongoStore = require('connect-mongo');
//const passport = require('passport');
//const socketio = require('socket.io');
const http = require('http');

const app = express();
const server = http.createServer(app);
//const io = socketio(server);

// Kết nối MongoDB
/*
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

    */
// Cấu hình session
/*
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 ngày
}));
*/
// Passport config
/*
require('./config/passport')(passport);
app.use(passport.initialize());
app.use(passport.session());
*/
// Middleware
/*
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
*/
app.use(express.static('public'));

// EJS
app.set('view engine', 'ejs');
app.set('views', 'views');

// Routes
app.use('/', require('./routes/index'));
app.use('/auctionsession', require('./routes/auction_session'));
/*
app.use('/auth', require('./routes/auth'));
app.use('/auctions', require('./routes/auctions'));
*/
// Socket.io
/*
require('./sockets/auction')(io);
*/
// Khởi động server
//const PORT = process.env.PORT || 3000;
const PORT = 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));