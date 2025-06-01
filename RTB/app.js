// api-gateway/index.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const https = require('https');
const fs = require('fs');
const cors = require('cors');

const app = express();

// Cấu hình CORS
app.use(cors({
    origin: ['https://localhost:3000'],
    credentials: true
}));

// Middleware
app.use(express.json());

/
    / SSL Certificate
const httpsOptions = {
    key: fs.readFileSync('./certificates/key.pem'),
    cert: fs.readFileSync('./certificates/cert.pem')
};

// Proxy routes
app.use('/api/auth', createProxyMiddleware({
    target: 'https://localhost:5001',
    changeOrigin: true,
    secure: false // Tắt kiểm tra SSL cho development
}));

app.use('/api/products', createProxyMiddleware({
    target: 'https://localhost:5002',
    changeOrigin: true,
    secure: false
}));

// Health check
app.get('/health', (req, res) => res.send('API Gateway is running'));

// Khởi động server HTTPS
https.createServer(httpsOptions, app).listen(5000, () => {
    console.log('API Gateway running on https://localhost:5000');
});