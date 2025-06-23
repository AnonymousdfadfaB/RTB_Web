const http = require('http');
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const app = express();
const fs = require('fs');
const path = require('path');
//variables
const PORT = 3000;

// EJS
app.set('view engine', 'ejs');
app.set('views', 'views');
// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public')); //notice here

//Cấu hình multer 
const storage = multer.diskStorage({
    destination: 'public/drives',
    filename: (req, file, cb) => {
        const uniqueFilename = `${Date.now() + '-' + Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueFilename);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // Giới hạn kích thước tệp là 10MB
    fileFilter: (req, file, cb) => {
        const fileTypes = /jpeg|jpg|png|gif/;
        const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = fileTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb('Error: Chỉ chấp nhận file ảnh (JPEG, JPG, PNG, GIF)!');
        }
    }
});
// Kết nối MongoDB
const client = new MongoClient("mongodb://localhost:27017");
let db, usersCollection, sessionsCollection, auctionsCollection;

async function connectDB() {
    await client.connect();
    db = client.db("auction-app");
    usersCollection = db.collection('users');
    sessionsCollection = db.collection('sessions');
    auctionsCollection = db.collection('auctions');
    await usersCollection.createIndex({ username: 1 }, { unique: true });
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    //create index for auction collection
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
app.get('/', async function (req, res, next) {
    try {
        // Lấy 10 auctions gần nhất, sắp xếp theo thời gian tạo mới nhất
        const latestAuctions = await db.collection('auctions')
            .find()
            .sort({ createdAt: -1 })  // Sắp xếp giảm dần (mới nhất đầu tiên)
            .limit(10)                // Giới hạn 10 kết quả
            .toArray();
        console.log(latestAuctions); // In ra để kiểm tra dữ liệu
        res.render('index', {
            user: req.user,
            auctions: latestAuctions
        });
    } catch (error) {
        next(error); // Chuyển lỗi đến middleware xử lý lỗi
    }
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
//create auctions api
app.post('/api/createauctions', upload.array('images', 5), async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Bạn cần đăng nhập để tạo phiên đấu giá' });
    }
    const { title, description, category, startingPrice, bidIncrement, endTime,  } = req.body;
    try {
        const images = req.files?.map(file => `public/uploads/${file.filename}`) || [];
        const auction = {
            title,
            description,
            category,
            startingPrice,
            bidIncrement,
            endTime: new Date(endTime),
            images,
            createdBy: req.user._id,
            createdAt: new Date(),
            bids: [] // Mảng lưu trữ các lượt đấu giá
        };
        const result = await db.collection('auctions').insertOne(auction);
        res.status(201).json({ message: 'Phiên đấu giá đã được tạo', auctionId: result.insertedId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi server, vui lòng thử lại sau!' });
    }
});


// Add this route after your existing routes
app.get('/auctions/:id', async function (req, res, next) {
    try {
        const auctionId = req.params.id;

        // Validate the auction ID format
        if (!ObjectId.isValid(auctionId)) {
            return res.status(400).json({ error: 'Invalid auction ID format' });
        }

        // Find the auction by ID and populate creator information
        const auction = await auctionsCollection.aggregate([
            { $match: { _id: new ObjectId(auctionId) } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'createdBy',
                    foreignField: '_id',
                    as: 'creator'
                }
            },
            { $unwind: '$creator' },
            {
                $project: {
                    title: 1,
                    description: 1,
                    category: 1,
                    startingPrice: 1,
                    currentBid: 1,
                    bidIncrement: 1,
                    endTime: 1,
                    images: 1,
                    bids: 1,
                    createdAt: 1,
                    'creator.username': 1,
                    'creator._id': 1,
                    status: {
                        $cond: {
                            if: { $gt: ['$endTime', new Date()] },
                            then: 'active',
                            else: 'ended'
                        }
                    }
                }
            }
        ]).next();

        if (!auction) {
            return res.status(404).render('404', {
                user: req.user,
                message: 'Phiên đấu giá không tồn tại'
            });
        }

        // Format the bids with bidder information
        if (auction.bids && auction.bids.length > 0) {
            const bidsWithBidders = await Promise.all(
                auction.bids.map(async bid => {
                    const bidder = await usersCollection.findOne(
                        { _id: bid.bidder },
                        { projection: { username: 1 } }
                    );
                    return {
                        ...bid,
                        bidderUsername: bidder ? bidder.username : 'Ẩn danh',
                        timestamp: bid.timestamp.toLocaleString('vi-VN')
                    };
                })
            );

            // Sort bids by amount (descending)
            auction.bids = bidsWithBidders.sort((a, b) => b.amount - a.amount);
        }

        // Format dates for display
        auction.createdAtFormatted = auction.createdAt.toLocaleString('vi-VN');
        auction.endTimeFormatted = auction.endTime.toLocaleString('vi-VN');

        // Calculate time remaining if auction is still active
        if (auction.status === 'active') {
            const timeLeft = auction.endTime - new Date();
            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            auction.timeLeft = `${days} ngày ${hours} giờ`;
        }

        // Check if current user is the auction creator
        const isOwner = req.user && req.user._id.equals(auction.creator._id);

        res.render('auction-detail', {
            user: req.user,
            auction,
            isOwner,
            currentPrice: auction.currentBid || auction.startingPrice
        });

    } catch (error) {
        console.error('Error fetching auction:', error);
        next(error);
    }
});
app.get('/payment', function (req, res, next) {
    res.render('index', { user: 'Express' }); //index
}); 
// Create HTTP server
const server = http.createServer(app);
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});