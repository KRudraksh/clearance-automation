require('dotenv').config();
const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const session = require('express-session');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const axios = require('axios');
const { google } = require('googleapis');
const Job = require('./models/job');
const pdfreader = require('pdf-parse');
const schedule = require('node-schedule');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const uploadDir = path.join(__dirname, 'uploads');
fs.mkdir(uploadDir, { recursive: true });

// Middleware
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Create OAuth2 client
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.REDIRECT_URL
);

// Scopes for Gmail API
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

// Function to create Gmail API client
function getGmailClient(accessToken) {
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.REDIRECT_URL
  );
  
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.gmail({version: 'v1', auth: oauth2Client});
}

// Function to send email
async function sendEmail(auth, senderEmail, {to, subject, body}) {
  const gmail = getGmailClient(auth);
  
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
  const messageParts = [
    `From: <${senderEmail}>`,
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    body
  ];
  const message = messageParts.join('\n');
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });
    console.log('Email sent successfully:', response.data);
    return true;
  } catch (error) {
    console.error('Detailed email error:', error.response?.data || error);
    return false;
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/login.html');
});

app.get('/auth/gmail', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  res.redirect(url);
});

app.get('/auth/gmail/callback', async (req, res) => {
  const { code } = req.query;
  
  try {
    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const userInfo = await axios.get(
      'https://www.googleapis.com/oauth2/v3/userinfo', 
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    // Store user info and tokens in session
    req.session.user = {
      name: userInfo.data.name,
      email: userInfo.data.email,
      picture: userInfo.data.picture
    };
    req.session.tokens = tokens;

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Authentication error:', error);
    res.redirect('/');
  }
});

// Job Routes
app.get('/jobs', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const jobs = await Job.find({ createdBy: req.session.user.email });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching jobs' });
  }
});

app.get('/job/:id', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching job details' });
  }
});

app.post('/jobs', async (req, res) => {
  if (!req.session.user || !req.session.tokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const { awbNumber, goodsDescription, importerEmail } = req.body;
    
    // Create new job
    const newJob = new Job({
      awbNumber,
      goodsDescription,
      importerEmail,
      createdBy: req.session.user.email
    });

    // Prepare email content
    const emailSubject = `Documents Required for Clearance of Shipment AWB: ${awbNumber}`;
    const emailBody = `
AWB No.: ${awbNumber}
Goods Description: ${goodsDescription}

Documents required:
${newJob.documentsRequested.join('\n')}`;

    // Send email
    const emailSent = await sendEmail(
      req.session.tokens.access_token,
      req.session.user.email,
      {
        to: importerEmail,
        subject: emailSubject,
        body: emailBody
      }
    );

    // Update job with email status
    newJob.emailStatus = {
      sent: emailSent,
      sentAt: emailSent ? new Date() : null,
      error: emailSent ? null : 'Failed to send email'
    };

    await newJob.save();
    res.status(201).json(newJob);
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ error: 'Error creating job' });
  }
});

app.delete('/jobs/:id', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    // Ensure user can only delete their own jobs
    if (job.createdBy !== req.session.user.email) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    await Job.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Job deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting job' });
  }
});

app.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  res.sendFile(__dirname + '/views/dashboard.html');
});

app.get('/user', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json(req.session.user);
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});


async function checkEmails(auth) {
  const gmail = getGmailClient(auth);
  try {
      console.log('Starting email check...');
      const response = await gmail.users.messages.list({
          userId: 'me',
          q: 'in:inbox has:attachment subject:"Re: Documents Required for Clearance of Shipment AWB:"',
          maxResults: 10
      });

      if (!response.data.messages) {
          console.log('No new emails found');
          return;
      }

      console.log(`Found ${response.data.messages.length} emails to process`);

      for (const message of response.data.messages) {
          console.log(`Processing email ID: ${message.id}`);
          const email = await gmail.users.messages.get({
              userId: 'me',
              id: message.id,
              format: 'full'
          });

          await processEmail(email.data, auth);
      }
  } catch (error) {
      console.error('Error in checkEmails:', error);
  }
}

// Function to process email and attachments
async function processEmail(email, auth) {
  try {
      const headers = email.payload.headers;
      const subject = headers.find(h => h.name === 'Subject').value;
      console.log('Processing email with subject:', subject);

      const awbMatch = subject.match(/AWB:\s*(\d+)/);
      if (!awbMatch) {
          console.log('No AWB number found in subject');
          return;
      }

      const awbNumber = awbMatch[1];
      console.log('Found AWB number:', awbNumber);

      const job = await Job.findOne({ awbNumber });
      if (!job) {
          console.log('No matching job found for AWB:', awbNumber);
          return;
      }

      console.log('Found matching job:', job._id);

      if (!email.payload.parts) {
          console.log('No parts found in email');
          return;
      }

      for (const part of email.payload.parts) {
          if (part.filename && part.body.attachmentId) {
              console.log('Processing attachment:', part.filename);
              const attachment = await downloadAttachment(auth, email.id, part.body.attachmentId);
              await processAttachment(attachment, part.filename, job);
          }
      }
  } catch (error) {
      console.error('Error processing email:', error);
  }
}

// Function to download attachment
async function downloadAttachment(auth, messageId, attachmentId) {
  const gmail = getGmailClient(auth);
  const response = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId: messageId,
    id: attachmentId
  });

  return Buffer.from(response.data.data, 'base64');
}

// Function to process attachment
async function processAttachment(buffer, filename, job) {
  try {
      console.log('Processing attachment:', filename);
      const fileExt = path.extname(filename).toLowerCase();
      const docType = determineDocumentType(filename);
      
      if (!docType) {
          console.log('Could not determine document type for:', filename);
          return;
      }

      console.log('Determined document type:', docType);

      if (job.documentsReceived.includes(docType)) {
          console.log('Document already received:', docType);
          return;
      }

      // Save file
      const filePath = path.join(uploadDir, `${job.awbNumber}_${docType}${fileExt}`);
      await fs.writeFile(filePath, buffer);
      console.log('File saved to:', filePath);

      // Update job
      const updateData = {
          $push: { documentsReceived: docType }
      };

      // Add invoice details if applicable
      if (docType === 'Invoice' && fileExt === '.pdf') {
          console.log('Extracting invoice details...');
          const invoiceDetails = await extractInvoiceDetails(buffer);
          if (invoiceDetails) {
              updateData.invoiceDetails = invoiceDetails;
              console.log('Extracted invoice details:', invoiceDetails);
          }
      }

      // Update job with new document and details
      await Job.findByIdAndUpdate(job._id, updateData, { new: true });
      console.log('Job updated successfully');
  } catch (error) {
      console.error('Error processing attachment:', error);
  }
}

// Function to determine document type
function determineDocumentType(filename) {
  filename = filename.toLowerCase();
  const patterns = [
      { pattern: /(invoice|inv)/i, type: 'Invoice' },
      { pattern: /(gst|goods.*service.*tax)/i, type: 'GST Details' },
      { pattern: /(ad.*code|ad)/i, type: 'AD Code' },
      { pattern: /(pack.*list|pl)/i, type: 'Packing List' },
      { pattern: /(ie.*code|ie)/i, type: 'IE Code' }
  ];

  for (const { pattern, type } of patterns) {
      if (pattern.test(filename)) {
          console.log(`Matched document type ${type} for filename ${filename}`);
          return type;
      }
  }

  console.log(`No document type match found for filename ${filename}`);
  return null;
}

// Function to extract invoice details
async function extractInvoiceDetails(buffer) {
  try {
    const data = await pdfreader(buffer);
    const text = data.text;
    
    // Simple regex patterns - adjust based on your invoice format
    const invoiceNoMatch = text.match(/Invoice\s*No[.:]\s*([A-Za-z0-9-]+)/i);
    const dateMatch = text.match(/Date[.:]\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i);
    const companyMatch = text.match(/Company\s*Name[.:]\s*([^\n]+)/i);

    return {
      invoiceNumber: invoiceNoMatch ? invoiceNoMatch[1] : null,
      date: dateMatch ? dateMatch[1] : null,
      companyName: companyMatch ? companyMatch[1] : null
    };
  } catch (error) {
    console.error('Error extracting invoice details:', error);
    return null;
  }
}

// Add new routes
app.get('/jobs/:jobId/document/:docType', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const job = await Job.findById(req.params.jobId);
    if (!job || job.createdBy !== req.session.user.email) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const filePath = path.join(uploadDir, `${job.awbNumber}_${req.params.docType}.pdf`);
    res.sendFile(filePath);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching document' });
  }
});

app.post('/refresh-emails', async (req, res) => {
  if (!req.session.user || !req.session.tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
      console.log('Starting manual email refresh...');
      await checkEmails(req.session.tokens.access_token);
      const updatedJobs = await Job.find({ createdBy: req.session.user.email });
      res.json({ 
          message: 'Email refresh completed',
          jobs: updatedJobs 
      });
  } catch (error) {
      console.error('Error in refresh-emails endpoint:', error);
      res.status(500).json({ error: 'Error refreshing emails' });
  }
});


// Start email checking schedule
let emailCheckSchedule;

app.post('/start-email-monitoring', (req, res) => {
  if (!req.session.user || !req.session.tokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (emailCheckSchedule) {
    emailCheckSchedule.cancel();
  }

  emailCheckSchedule = schedule.scheduleJob('*/5 * * * * *', async () => {
    await checkEmails(req.session.tokens.access_token);
  });

  res.json({ message: 'Email monitoring started' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});