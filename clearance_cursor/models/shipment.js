const mongoose = require('mongoose');

const goodsItemSchema = new mongoose.Schema({
    goodsName: String,
    hsCode: String,
    quantityNetWeight: Number,
    unitPrice: Number,
    amount: Number
});

const exporterSchema = new mongoose.Schema({
    name: String,
    address: String,
    iecCode: String,
    adCode: String,
    gstNo: String,
    panNumber: String,
    country: String,
    salesContractNumber: String
});

const consigneeSchema = new mongoose.Schema({
    name: String,
    address: String,
    country: String
});

const portSchema = new mongoose.Schema({
    portOfLanding: String,
    portOfDischarge: String,
    countryOfDischarge: String,
    portOfDestination: String,
    countryOfDestination: String
});

const shipmentSchema = new mongoose.Schema({
    jobNumber: { type: String, required: true, unique: true },
    userId: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
    emailSender: String,
    senderName: String,
    files: [{
        filename: String,
        originalName: String,
        created_at: { type: Date, default: Date.now }
    }],
    general: {
        awbNo: String,
        dateCreated: Date,
        customsHouseCode: String,
        exporter: exporterSchema,
        consignee: consigneeSchema,
        port: portSchema
    },
    invoice: {
        invoiceNo: String,
        invoiceDate: Date,
        termsOfPayment: String,
        goods: [goodsItemSchema],
        advance: Number,
        grandTotal: Number,
        fobValue: Number,
        totalFreight: Number
    },
    insurance: {
        company: String,
        totalSumInsured: Number,
        policyNumber: String,
        certificateNumber: String,
        policyConditions: String
    },
    packingList: {
        containerNumber: String,
        sealNumber: String,
        packagesBundles: Number,
        grossWeight: Number,
        netWeight: Number
    }
});

module.exports = mongoose.model('Shipment', shipmentSchema); 