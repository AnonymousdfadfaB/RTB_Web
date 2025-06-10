const http = require('http');
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cookieParser = require('cookie-parser');

const app = express();
//variables
const PORT = 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public')); //notice here

// EJS
app.set('view engine', 'ejs');
app.set('views', 'views');
// Kết nối MongoDB
const client = new MongoClient("mongodb://localhost:27017");
let db, usersCollection, sessionsCollection;

async function connectDB() {
    await client.connect();
    db = client.db("auction-app");
    usersCollection = db.collection('users');
    sessionsCollection = db.collection('sessions');
    await usersCollection.createIndex({ username: 1 }, { unique: true });
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    console.log("Connected to MongoDB");
}
connectDB().catch(console.error);
//functions
    //create session
async function CreateSession(userId, res) {
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const session = {
        userId,
        expires,
        createdAt: new Date()
    };
    const result = await sessionsCollection.insertOne(session);
    res.cookie('sessionId', result.insertedId, {
        httpOnly: true,
        expires,
        secure: false, // Set to true if using HTTPS
    });
}
//routes
    //cookie middleware
app.use(async (req, res, next) => {
    const sessionId = req.cookies.sessionId;
    if (sessionId) {
        const session = await sessionsCollection.findOne({
            _id: new ObjectId(sessionId),
            expires: { $gt: new Date() }
        });
        if (session) {
            req.user = await usersCollection.findOne({
                _id: new ObjectId(session.userId),
            });
        } else {
            res.clearCookie('sessionId');
        }
    }
    next();
});
    //home page
app.get('/', function (req, res, next) {
    res.render('index', { user: req.user });
});
app.get('/createauctions', async function (req, res, next) {
    if (req.user) {
        res.render('createauctions', { user: req.user });
    } else {
        res.status(400).send("Bad request!");
    }
});
    //register and login, logout
app.post('/api/register', async (req, res) => {

    const { username, email, password } = req.body;
    try {
        const existingUser = await usersCollection.findOne({
            $or: [{ email }, { username }]
        });

        if (existingUser) {
            // Xác định cụ thể lỗi: email hay username trùng
            if (existingUser.email === email) {
                return res.status(400).json({ error: 'Email đã tồn tại!' });
            } else {
                return res.status(400).json({ error: 'Username đã tồn tại!' });
            }
        }

        // Lưu người dùng mới
        const result = await usersCollection.insertOne({
            username,
            email,
            password,
            createdAt: new Date()
        });

        res.status(201).json({ message: 'Đăng ký thành công!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi server, vui lòng thử lại sau!' });
    }
});
app.post('/api/login', async function (req, res, next) {
    const { username, password } = req.body;
    const user = await usersCollection.findOne({ username });
    if (!user) {
        return res.status(400).json({ error: 'đăng nhập thất bại' });
    }
    if (user.password != password) {
        return res.status(400).json({ error: 'đăng nhập thất bại' });
    }
    //tạo session
    await CreateSession(user._id, res);
    res.status(200).json({ message: 'Đăng nhập thành công' });
});
app.post('/api/logout', async function (req, res, next) {
    const sessionId = req.cookies.sessionId;
    try {
        if (sessionId) {
            await sessionsCollection.deleteOne({ _id: new ObjectId(sessionId) });
            res.clearCookie('sessionId');
            res.status(200).json({
                message: 'Đăng xuất thành công'
            });
        } else {
            res.status(400).json({
                error: 'Lỗi đăng xuất',
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Lỗi server, vui lòng thử lại sau!'
        });
    }

});














app.get('/auctionsession', function (req, res, next) {
    res.render('index', { user: 'Express' }); //index
}); 
app.get('/payment', function (req, res, next) {
    res.render('index', { user: 'Express' }); //index
}); 
// Create HTTP server
const server = http.createServer(app);
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});