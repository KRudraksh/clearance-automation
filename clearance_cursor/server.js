const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const path = require('path');
const multer = require('multer');
const fs = require('fs').promises;
const mongoose = require('mongoose');
const Shipment = require('./models/shipment');
const sqlite3 = require('sqlite3').verbose();
const config = require('./config');
const { google } = require('googleapis');
const session = require('express-session');
const gmail = google.gmail('v1');

const app = express();
const port = 3000;

// Add these constants at the top with other configurations
const ADMIN_USERNAME = 'rudrakshkuchiya';
const ADMIN_PASSWORD = 'Rudraksh@001';

// MongoDB connection
mongoose.connect(config.mongodb.url);

// Handle MongoDB connection errors
mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Add this line to serve files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Add this line to serve files from images directory
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

// Add session middleware
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true
}));

// Database setup
const db = new sqlite3.Database('users.db');
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    username TEXT UNIQUE,
    password TEXT,
    original_password TEXT
)`);

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = 'uploads';
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error, null);
        }
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        // Check file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images and PDF files are allowed.'));
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Error handling for file upload
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size is too large. Maximum size is 10MB.' });
        }
        return res.status(400).json({ error: error.message });
    }
    if (error) {
        return res.status(400).json({ error: error.message });
    }
    next();
});

// Create shipments table
db.run(`CREATE TABLE IF NOT EXISTS shipments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jobNumber TEXT UNIQUE,
    userId INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(userId) REFERENCES users(id)
)`);

// Create files table
db.run(`CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipmentId INTEGER,
    filename TEXT,
    originalName TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(shipmentId) REFERENCES shipments(id)
)`);

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, 'temp');
fs.mkdir(tempDir, { recursive: true }).catch(console.error);

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/register', async (req, res) => {
    try {
        const { name, email, username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.run('INSERT INTO users (name, email, username, password, original_password) VALUES (?, ?, ?, ?, ?)',
            [name, email, username, hashedPassword, password],
            (err) => {
                if (err) {
                    res.status(400).json({ error: 'Username or email already exists' });
                } else {
                    res.json({ success: true });
                }
            });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err || !user) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (validPassword) {
            res.json({ success: true });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    });
});

// Get current user
app.get('/api/user', (req, res) => {
    // In a real application, this would use session/token authentication
    // This is just a placeholder
    res.json({ name: "John Doe" });
});

// Add this function at the top with other imports
async function generateJobNumber() {
    try {
        // Find the last shipment
        const lastShipment = await Shipment.findOne().sort({ jobNumber: -1 });
        
        if (!lastShipment) {
            // If no shipments exist, start with JN0001
            return 'JN0001';
        }

        // Extract the number from the last job number and increment it
        const lastNumber = parseInt(lastShipment.jobNumber.replace('JN', ''));
        const newNumber = lastNumber + 1;
        
        // Pad with zeros to maintain 4 digits
        return `JN${newNumber.toString().padStart(4, '0')}`;
    } catch (error) {
        console.error('Error generating job number:', error);
        throw error;
    }
}

// Update the create shipment route
app.post('/api/shipments', upload.array('files', 10), async (req, res) => {
    try {
        const userId = 1; // In a real app, this would come from the authenticated session

        // Generate job number
        const jobNumber = await generateJobNumber();

        const files = (req.files || []).map(file => ({
            filename: file.filename,
            originalName: file.originalname
        }));
        
        const shipment = new Shipment({
            jobNumber,
            userId,
            files
        });
        
        await shipment.save();
        
        console.log('Shipment created:', {
            jobNumber,
            userId,
            filesCount: files?.length || 0
        });
        
        res.json({ success: true, shipment });
    } catch (error) {
        console.error('Error creating shipment:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// Get all shipments
app.get('/api/shipments', async (req, res) => {
    const userId = 1; // In a real app, this would come from the authenticated session
    
    try {
        const shipments = await Shipment.find({ userId })
            .sort('-general.dateCreated')
            .select('jobNumber _id');
        res.json(shipments.map(s => ({
            id: s._id,
            jobNumber: s.jobNumber
        })));
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get shipment details with files
app.get('/api/shipments/:id', async (req, res) => {
    const shipmentId = req.params.id;
    const userId = 1; // In a real app, this would come from the authenticated session

    try {
        const shipment = await Shipment.findOne({ _id: shipmentId, userId });
        if (!shipment) {
            res.status(404).json({ error: 'Shipment not found' });
            return;
        }
        res.json(shipment);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Save shipment details
app.post('/api/shipments/:id/details', async (req, res) => {
    const shipmentId = req.params.id;
    const userId = 1; // In a real app, this would come from the authenticated session

    try {
        const shipment = await Shipment.findOne({ _id: shipmentId, userId });
        if (!shipment) {
            return res.status(404).json({ error: 'Shipment not found' });
        }

        // Update the shipment with the new data
        shipment.general = {
            awbNo: req.body.general.awbNo,
            customsHouseCode: req.body.general.customsHouseCode,
            exporter: req.body.general.exporter,
            consignee: req.body.general.consignee,
            port: req.body.general.port
        };

        shipment.invoice = {
            invoiceNo: req.body.invoice.invoiceNo,
            invoiceDate: req.body.invoice.invoiceDate,
            termsOfPayment: req.body.invoice.termsOfPayment,
            goods: req.body.invoice.goods,
            advance: req.body.invoice.advance,
            grandTotal: req.body.invoice.grandTotal,
            fobValue: req.body.invoice.fobValue,
            totalFreight: req.body.invoice.totalFreight
        };

        shipment.insurance = {
            company: req.body.insurance.company,
            totalSumInsured: req.body.insurance.totalSumInsured,
            policyNumber: req.body.insurance.policyNumber,
            certificateNumber: req.body.insurance.certificateNumber,
            policyConditions: req.body.insurance.policyConditions
        };

        shipment.packingList = {
            containerNumber: req.body.packingList.containerNumber,
            sealNumber: req.body.packingList.sealNumber,
            packagesBundles: req.body.packingList.packagesBundles,
            grossWeight: req.body.packingList.grossWeight,
            netWeight: req.body.packingList.netWeight
        };

        await shipment.save();
        console.log('Shipment details saved:', shipmentId);
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving shipment details:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// Add files to existing shipment
app.post('/api/shipments/:id/files', upload.array('files'), async (req, res) => {
    const shipmentId = req.params.id;
    const files = req.files || [];

    try {
        const shipment = await Shipment.findById(shipmentId);
        if (!shipment) {
            res.status(404).json({ error: 'Shipment not found' });
            return;
        }

        const newFiles = files.map(file => ({
            filename: file.filename,
            originalName: file.originalname
        }));

        shipment.files.push(...newFiles);
        await shipment.save();

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete file
app.delete('/api/files/:id', async (req, res) => {
    const fileId = req.params.id;

    try {
        const shipment = await Shipment.findOne({ 'files._id': fileId });
        if (!shipment) {
            res.status(404).json({ error: 'File not found' });
            return;
        }

        const file = shipment.files.id(fileId);
        
        // Delete file from filesystem
        await fs.unlink(path.join('uploads', file.filename));
        
        // Remove file from shipment
        shipment.files.pull(fileId);
        await shipment.save();
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete shipment and all its files
app.delete('/api/shipments/:id', async (req, res) => {
    const shipmentId = req.params.id;
    const userId = 1; // In a real app, this would come from the authenticated session

    try {
        const shipment = await Shipment.findOne({ _id: shipmentId, userId });
        if (!shipment) {
            res.status(404).json({ error: 'Shipment not found' });
            return;
        }

        // Delete all files from filesystem
        for (const file of shipment.files) {
            await fs.unlink(path.join('uploads', file.filename))
                .catch(console.error);
        }

        // Delete shipment from database
        await Shipment.deleteOne({ _id: shipmentId, userId });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Azure configuration (excluding sensitive data)
app.get('/api/config', (req, res) => {
    res.json({
        azure: {
            computerVision: {
                endpoint: config.azure.computerVision.endpoint
            },
            openAI: {
                endpoint: config.azure.openAI.endpoint,
                deploymentName: config.azure.openAI.deploymentName
            }
        }
    });
});

// Add this route before app.listen()
app.get('/api/azure-keys', (req, res) => {
    // In a production environment, you should implement proper authentication
    res.json({
        computerVision: config.azure.computerVision.key,
        openAI: config.azure.openAI.key
    });
});

// OAuth2 configuration
const oauth2Client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    'http://localhost:3000/auth/google/callback'
);

// Gmail API configuration
const SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify'
];

// Route to initiate Gmail authentication
app.get('/auth/google', (req, res) => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    });
    res.redirect(authUrl);
});

// Callback route after Gmail authentication
app.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        
        // Store tokens in session
        req.session.tokens = tokens;
        
        // Redirect back to dashboard
        res.redirect('/dashboard.html');
    } catch (error) {
        console.error('Error getting OAuth tokens:', error);
        res.status(500).send('Authentication failed');
    }
});

// Check if email is configured
app.get('/api/email/status', (req, res) => {
    res.json({ configured: !!req.session.tokens });
});

// Add this route to check emails
app.get('/api/check-emails', async (req, res) => {
    try {
        if (!req.session.tokens) {
            return res.status(401).json({ error: 'Email not configured' });
        }

        oauth2Client.setCredentials(req.session.tokens);

        const results = []; // Move results array outside the inner try block

        // First, ensure the "processed" label exists
        try {
            const labels = await gmail.users.labels.list({
                auth: oauth2Client,
                userId: 'me'
            });

            let processedLabel = labels.data.labels.find(label => 
                label.name === 'Processed_Shipments'
            );

            if (!processedLabel) {
                // Create the label if it doesn't exist
                const createResponse = await gmail.users.labels.create({
                    auth: oauth2Client,
                    userId: 'me',
                    requestBody: {
                        name: 'Processed_Shipments',
                        labelListVisibility: 'labelShow',
                        messageListVisibility: 'show'
                    }
                });
                processedLabel = createResponse.data;
            }

            const labelId = processedLabel.id;

            // Search for emails with subject "New Shipment"
            const response = await gmail.users.messages.list({
                auth: oauth2Client,
                userId: 'me',
                q: `subject:"New Shipment" has:attachment -label:Processed_Shipments`
            });

            const messages = response.data.messages || [];

            for (const message of messages) {
                // Get email details
                const email = await gmail.users.messages.get({
                    auth: oauth2Client,
                    userId: 'me',
                    id: message.id
                });

                // Extract sender's email from headers
                const headers = email.data.payload.headers;
                const fromHeader = headers.find(h => h.name === 'From');
                const senderEmail = fromHeader ? fromHeader.value.match(/<(.+)>/)?.[1] || fromHeader.value : 'Unknown';
                const senderName = fromHeader ? fromHeader.value.match(/^"?([^"<]+)"?\s*(?:<|$)/)?.[1]?.trim() || 'Unknown' : 'Unknown';

                // Get attachments
                const attachments = [];
                const parts = email.data.payload.parts || [];

                for (const part of parts) {
                    if (part.filename && part.body.attachmentId) {
                        const attachment = await gmail.users.messages.attachments.get({
                            auth: oauth2Client,
                            userId: 'me',
                            messageId: message.id,
                            id: part.body.attachmentId
                        });

                        const buffer = Buffer.from(attachment.data.data, 'base64');
                        const filename = `${Date.now()}-${part.filename}`;
                        await fs.writeFile(path.join('uploads', filename), buffer);

                        attachments.push({
                            filename,
                            originalName: part.filename
                        });
                    }
                }

                if (attachments.length > 0) {
                    // Create new shipment
                    const jobNumber = await generateJobNumber();
                    const shipment = new Shipment({
                        jobNumber,
                        userId: 1,
                        files: attachments,
                        emailSender: senderEmail,
                        senderName: senderName
                    });

                    await shipment.save();
                    results.push({ jobNumber, senderEmail });

                    // Mark email as processed
                    await gmail.users.messages.modify({
                        auth: oauth2Client,
                        userId: 'me',
                        id: message.id,
                        requestBody: {
                            addLabelIds: [labelId]
                        }
                    });
                }
            }

        } catch (labelError) {
            console.error('Error managing labels:', labelError);
            throw labelError;
        }

        res.json({ success: true, shipments: results });
    } catch (error) {
        console.error('Error checking emails:', error);
        res.status(500).json({ error: 'Failed to check emails' });
    }
});

// Add admin authentication middleware
function requireAdminAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return res.status(401).json({ error: 'No authorization header' });
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        next();
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
}

// Update admin routes to use authentication
app.get('/api/admin/users', requireAdminAuth, async (req, res) => {
    try {
        // First get all users
        const users = await new Promise((resolve, reject) => {
            db.all(`
                SELECT * FROM users
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Get job counts from MongoDB for each user
        const safeUsers = await Promise.all(users.map(async user => {
            const jobCount = await Shipment.countDocuments({ userId: user.id });
            return {
                id: user.id,
                name: user.name,
                email: user.email,
                username: user.username,
                password: user.original_password,
                jobCount
            };
        }));
        
        res.json(safeUsers);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/admin/stats', requireAdminAuth, async (req, res) => {
    try {
        // Get total users from SQLite
        const totalUsers = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        
        // Get shipment stats from MongoDB
        const totalJobs = await Shipment.countDocuments();
        const activeUsers = await Shipment.distinct('userId').then(users => users.length);
        
        const stats = {
            totalUsers,
            totalJobs,
            activeUsers
        };
        
        res.json(stats);
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/admin/users/:id', requireAdminAuth, async (req, res) => {
    const userId = req.params.id;
    
    try {
        // Delete user's shipments and files
        const shipments = await Shipment.find({ userId });
        for (const shipment of shipments) {
            // Delete physical files
            for (const file of shipment.files) {
                await fs.unlink(path.join('uploads', file.filename))
                    .catch(console.error);
            }
            // Delete shipment
            await shipment.delete();
        }
        
        // Delete user from SQLite
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Add admin login route
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 