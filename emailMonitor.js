const { google } = require('googleapis');
const { simpleParser } = require('mailparser');
const pdf = require('pdf-parse');
const Job = require('./models/job');

class EmailMonitor {
    constructor(oauth2Client) {
        this.oauth2Client = oauth2Client;
        this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    }

    async checkNewEmails(userId) {
        try {
            const jobs = await Job.find({ createdBy: userId });
            
            for (const job of jobs) {
                if (!job.emailStatus.threadId) continue;

                const response = await this.gmail.users.messages.list({
                    userId: 'me',
                    q: `in:inbox newer_than:1h thread:${job.emailStatus.threadId}`,
                });

                if (response.data.messages) {
                    for (const message of response.data.messages) {
                        await this.processEmail(message.id, job);
                    }
                }
            }
            return true;
        } catch (error) {
            console.error('Error checking emails:', error);
            return false;
        }
    }

    async processEmail(messageId, job) {
        try {
            const message = await this.gmail.users.messages.get({
                userId: 'me',
                id: messageId,
                format: 'full'
            });

            // Process attachments
            if (message.data.payload.parts) {
                for (const part of message.data.payload.parts) {
                    if (part.filename && part.body.attachmentId) {
                        const attachment = await this.gmail.users.messages.attachments.get({
                            userId: 'me',
                            messageId: messageId,
                            id: part.body.attachmentId
                        });

                        const documentType = this.identifyDocumentType(part.filename);
                        if (documentType) {
                            const fileContent = Buffer.from(attachment.data.data, 'base64');
                            
                            let extractedData = {};
                            if (documentType === 'Invoice') {
                                extractedData = await this.extractInvoiceData(fileContent);
                            }

                            // Update job with received document
                            await this.updateJobDocument(job, {
                                type: documentType,
                                receivedDate: new Date(),
                                fileName: part.filename,
                                fileContent: fileContent,
                                mimeType: part.mimeType,
                                extractedData
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error processing email:', error);
        }
    }

    identifyDocumentType(filename) {
        const lowercaseFilename = filename.toLowerCase();
        if (lowercaseFilename.includes('invoice')) return 'Invoice';
        if (lowercaseFilename.includes('gst')) return 'GST Details';
        if (lowercaseFilename.includes('ad')) return 'AD Code';
        if (lowercaseFilename.includes('packing')) return 'Packing List';
        if (lowercaseFilename.includes('ie')) return 'IE Code';
        return null;
    }

    async extractInvoiceData(fileContent) {
        try {
            const data = await pdf(fileContent);
            const text = data.text;
            
            // Basic regex patterns - adjust based on your invoice format
            const invoiceNumberMatch = text.match(/Invoice[:\s]+([A-Z0-9-]+)/i);
            const companyNameMatch = text.match(/Company[:\s]+([^\n]+)/i);
            const dateMatch = text.match(/Date[:\s]+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i);

            return {
                invoiceNumber: invoiceNumberMatch ? invoiceNumberMatch[1] : '',
                companyName: companyNameMatch ? companyNameMatch[1] : '',
                date: dateMatch ? new Date(dateMatch[1]) : null
            };
        } catch (error) {
            console.error('Error extracting invoice data:', error);
            return {};
        }
    }

    async updateJobDocument(job, document) {
        const existingDocIndex = job.documentsReceived.findIndex(
            doc => doc.type === document.type
        );

        if (existingDocIndex > -1) {
            job.documentsReceived[existingDocIndex] = document;
        } else {
            job.documentsReceived.push(document);
        }

        await job.save();
    }
}

module.exports = EmailMonitor;