
const express = require('express');
const { MongoClient } = require('mongodb');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');

const app = express();
const server = require('http').createServer(app);

// Kết nối MongoDB
const client = new MongoClient("mongodb://localhost:27017");
let db, usersCollection, sessionsCollection;

async function connectDB() {
    await client.connect();
    db = client.db("auction-app");
    usersCollection = db.collection('users');
    sessionsCollection = db.collection('sessions');
    console.log("Connected to MongoDB");
}
connectDB().catch(console.error);
//create session
async function CreateSession(userId, res)
{
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const session = {
        userId,
        expires,
        createdAt: new Date()
    };
    const result = await sessionCollection.insertOne(session);
    res.cookie('sessionId', result.insertedId, {
        httpOnly: true,
        expires,
        secure: process.env.NODE_ENV === 'production'
    });
}
// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public')); //notice here

// EJS
app.set('view engine', 'ejs');
app.set('views', 'views');
// Khi truy cap trang home
//cookie middleware
app.use(async (req, res, next) => {
    const sessionId = req.cookies.sessionId;
    if (sessionId) {
        const session = await sessionCollection.findOne({
            _id: new ObjectId(sessionId),
            expires: { $gt: new Date() }
        });
        if (session) {
            req.user = await usersCollection.findOne({
                _id: new ObjectId(session.userId);
            });
        } else {
            res.clearCookie('sessionId');
        }
    }
});
app.get('/', function (req, res, next) {
    res.render('index', { user: req.user });
}); 

app.post('/register', async function (req, res, next) {
    const { username, email, password } = req.body;
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
        return res.status(400).send('Email da ton tai'); //fail to register
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = {
        username,
        email,
        password: hashedPassword,
        createAt: new Date()
    };
    const result = await usersCollection.insertOne(newUser);
    res.redirect('/');
});

app.post('/login', async function (req, res, next) {
    const { username, password } = req.body;
    const user = await usersCollection.findOne({ username });
    if (!user)
    {
        return res.status(400).send('dang nhap fail');
    }
    else
    {
        const validPass = await bcrypt.compare(password, user.password);
        if (!validPass)
            return res.status(400).send('dang nhap fail');
        else
        {
            CreateSession(user._id, res);
            res.redirect('/');
        }
    }
});
app.post('/logout', async function (req, res, next) {
    const sessionId = req.cookies.sessionId;
    if (sessionId) {
        await sessionsCollection.deleteOne({ _id: new ObjectId(sessionId) });
        res.clearCookie('sessionId');
    }
    res.redirect('/');
});
app.get('/auctionsession', function (req, res, next) {
    res.render('index', { user: 'Express' }); //index
}); 
app.get('/payment', function (req, res, next) {
    res.render('index', { user: 'Express' }); //index
}); 
const PORT = 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));