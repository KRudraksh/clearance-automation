const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  awbNumber: { type: String, required: true, unique: true },
  goodsDescription: { type: String, required: true },
  importerEmail: { type: String, required: true },
  status: { type: String, default: 'New' },
  documentsRequested: {
    type: [String],
    default: ['Invoice', 'GST Details', 'AD Code', 'Packing List', 'IE Code']
  },
  invoiceDetails: {
    invoiceNumber: String,
    date: String,
    companyName: String
  },
  documentsReceived: [{
    type: String,
    filePath: String,
    receivedAt: Date
  }],
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  emailStatus: {
    sent: { type: Boolean, default: false },
    sentAt: Date,
    error: String
  }
});

module.exports = mongoose.model('Job', jobSchema);
