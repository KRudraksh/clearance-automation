document.addEventListener('DOMContentLoaded', async () => {
    const shipmentModal = document.getElementById('shipmentModal');
    const newShipmentBtn = document.getElementById('newShipmentBtn');
    const cancelShipmentBtn = document.getElementById('cancelShipment');
    const shipmentForm = document.getElementById('shipmentForm');
    const fileUpload = document.getElementById('fileUpload');
    const fileUploadBtn = document.getElementById('fileUploadBtn');
    const fileList = document.getElementById('fileList');
    const shipmentsList = document.getElementById('shipmentsList');
    const notification = document.getElementById('notification');
    const autoFillBtn = document.getElementById('autoFillBtn');
    
    // Initialize Azure Service at the start
    const azureService = new AzureService();
    try {
        await azureService.init(); // Wait for initialization
    } catch (error) {
        console.error('Failed to initialize Azure service:', error);
    }
    
    // Display username
    fetchUserInfo();

    // Store selected files
    let selectedFiles = [];
    let currentShipmentId = null;

    // Initialize goods table
    const goodsTableBody = document.getElementById('goodsTableBody');
    const addGoodsRowBtn = document.getElementById('addGoodsRow');

    function addGoodsRow() {
        const newRow = document.createElement('tr');
        newRow.innerHTML = `
            <td><input type="text" class="goods-name"></td>
            <td><input type="text" class="hs-code"></td>
            <td><input type="number" class="quantity" step="0.001" placeholder="MT"></td>
            <td><input type="number" class="unit-price" step="0.01" placeholder="USD"></td>
            <td><input type="number" class="amount" readonly placeholder="USD"></td>
            <td><button type="button" class="remove-row-btn">✕</button></td>
        `;

        // Add event listeners for calculations
        const quantityInput = newRow.querySelector('.quantity');
        const unitPriceInput = newRow.querySelector('.unit-price');
        const amountInput = newRow.querySelector('.amount');

        function calculateAmount() {
            const quantity = parseFloat(quantityInput.value) || 0;
            const unitPrice = parseFloat(unitPriceInput.value) || 0;
            const amount = quantity * unitPrice;
            amountInput.value = amount.toFixed(2);
            calculateTotals();
        }

        quantityInput.addEventListener('input', calculateAmount);
        unitPriceInput.addEventListener('input', calculateAmount);

        // Add remove button listener
        newRow.querySelector('.remove-row-btn').addEventListener('click', () => {
            newRow.remove();
            calculateTotals();
        });

        goodsTableBody.appendChild(newRow);
    }

    function calculateTotals() {
        const amounts = Array.from(document.querySelectorAll('.amount'))
            .map(input => parseFloat(input.value) || 0);
        
        const grandTotal = amounts.reduce((sum, amount) => sum + amount, 0);
        document.getElementById('grandTotal').value = grandTotal.toFixed(2);
    }

    addGoodsRowBtn.addEventListener('click', addGoodsRow);

    // Show shipment modal
    newShipmentBtn.addEventListener('click', () => {
        console.log('New Shipment button clicked');
        const shipmentModal = document.getElementById('shipmentModal');
        if (!shipmentModal) {
            console.error('Modal element not found');
            return;
        }
        shipmentModal.style.display = 'block';
        clearForm();
    });

    // Hide shipment modal
    cancelShipmentBtn.addEventListener('click', () => {
        console.log('Cancel button clicked');
        const shipmentModal = document.getElementById('shipmentModal');
        shipmentModal.style.display = 'none';
        clearForm();
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === shipmentModal) {
            shipmentModal.style.display = 'none';
            clearForm();
        }
    });

    // Handle file upload button click
    fileUploadBtn.addEventListener('click', () => {
        fileUpload.click();
    });

    // Handle file selection
    fileUpload.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        selectedFiles = [...selectedFiles, ...files];
        displayFiles();
    });

    // Handle form submission
    shipmentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData();
        if (selectedFiles.length > 0) {
        selectedFiles.forEach(file => {
            formData.append('files', file);
        });
        }

        try {
            const response = await fetch('/api/shipments', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                showNotification('Shipment created successfully!', 'success');
                shipmentModal.style.display = 'none';
                clearForm();
                loadShipments();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Error creating shipment');
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification(error.message, 'error');
        }
    });

    function displayFiles() {
        fileList.innerHTML = selectedFiles.map((file, index) => `
            <div class="file-item">
                <span>
                    <i class="file-icon ${getFileIconClass(file.name)}" title="${getFileType(file.name)}"></i>
                    ${file.name}
                </span>
                <button type="button" class="remove-file" data-index="${index}">✕</button>
            </div>
        `).join('');

        // Add event listeners to remove buttons
        document.querySelectorAll('.remove-file').forEach(button => {
            button.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                removeFile(index);
            });
        });
    }

    function removeFile(index) {
        selectedFiles.splice(index, 1);
        displayFiles();
    }

    function clearForm() {
        // Clear the new shipment form
        shipmentForm.reset();
        selectedFiles = [];
        fileList.innerHTML = '';

        // Clear all input fields in shipment details
        const allInputs = document.querySelectorAll('input, textarea');
        allInputs.forEach(input => {
            input.value = '';
        });

        // Clear goods table
        goodsTableBody.innerHTML = '';

        // Add one empty row to goods table
        addGoodsRow();

        // Reset calculated fields
        document.getElementById('grandTotal').value = '';

        // Clear insurance section
        document.getElementById('insuranceCompany').value = '';
        document.getElementById('totalSumInsured').value = '';
        document.getElementById('policyNumber').value = '';
        document.getElementById('certificateNumber').value = '';
        document.getElementById('policyConditions').value = '';

        // Clear packing list section
        document.getElementById('containerNumber').value = '';
        document.getElementById('sealNumber').value = '';
        document.getElementById('packagesBundles').value = '';
        document.getElementById('grossWeight').value = '';
        document.getElementById('netWeight').value = '';

        // Hide shipment details panel
        document.getElementById('shipmentDetails').classList.add('hidden');

        // Reset current shipment ID
        currentShipmentId = null;
    }

    async function fetchUserInfo() {
        try {
            const response = await fetch('/api/user');
            if (response.ok) {
                const user = await response.json();
                document.getElementById('username').textContent = user.name;
            }
        } catch (error) {
            console.error('Error fetching user info:', error);
        }
    }

    async function loadShipments() {
        try {
            const response = await fetch('/api/shipments');
            if (response.ok) {
                const shipments = await response.json();
                shipmentsList.innerHTML = shipments.map(shipment => `
                    <div class="shipment-item" data-id="${shipment.id}">
                        <span>${shipment.jobNumber}</span>
                    </div>
                `).join('');

                // Add click handlers to shipment items
                document.querySelectorAll('.shipment-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const shipmentId = item.dataset.id;
                        loadShipmentDetails(shipmentId);
                    });
                });
            }
        } catch (error) {
            console.error('Error loading shipments:', error);
        }
    }

    async function loadShipmentDetails(shipmentId) {
        if (!shipmentId) return;

        try {
            const response = await fetch(`/api/shipments/${shipmentId}`);
            if (!response.ok) {
                throw new Error('Failed to load shipment details');
            }

            const shipment = await response.json();
            console.log('Loaded shipment data:', shipment);
            
            // Update job number and creation date display
            document.getElementById('detailsJobNumber').textContent = shipment.jobNumber;
            const createdDate = new Date(shipment.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            document.getElementById('detailsCreatedDate').textContent = createdDate;
            
            // Update sender info display
            const senderInfo = document.getElementById('senderInfo');
            if (shipment.emailSender) {
                senderInfo.textContent = `Email from: ${shipment.senderName} <${shipment.emailSender}>`;
                senderInfo.style.display = 'block';
            } else {
                senderInfo.style.display = 'none';
            }
            
            // Display files
            displayShipmentFiles(shipment.files);
            
            // Show shipment details panel
            document.getElementById('shipmentDetails').classList.remove('hidden');

            // Fill form fields from nested structure
            if (shipment.general) {
                document.getElementById('awbNo').value = shipment.general.awbNo || '';
                document.getElementById('dateCreated').value = shipment.general.dateCreated || '';
                document.getElementById('customsHouseCode').value = shipment.general.customsHouseCode || '';

                if (shipment.general.exporter) {
                    document.getElementById('exporterName').value = shipment.general.exporter.name || '';
                    document.getElementById('exporterAddress').value = shipment.general.exporter.address || '';
                    document.getElementById('iecCode').value = shipment.general.exporter.iecCode || '';
                    document.getElementById('adCode').value = shipment.general.exporter.adCode || '';
                    document.getElementById('gstNo').value = shipment.general.exporter.gstNo || '';
                    document.getElementById('panNumber').value = shipment.general.exporter.panNumber || '';
                    document.getElementById('exporterCountry').value = shipment.general.exporter.country || '';
                    document.getElementById('salesContractNumber').value = shipment.general.exporter.salesContractNumber || '';
                }

                if (shipment.general.consignee) {
                    document.getElementById('consigneeName').value = shipment.general.consignee.name || '';
                    document.getElementById('consigneeAddress').value = shipment.general.consignee.address || '';
                    document.getElementById('consigneeCountry').value = shipment.general.consignee.country || '';
                }

                if (shipment.general.port) {
                    document.getElementById('portOfLanding').value = shipment.general.port.portOfLanding || '';
                    document.getElementById('portOfDischarge').value = shipment.general.port.portOfDischarge || '';
                    document.getElementById('countryOfDischarge').value = shipment.general.port.countryOfDischarge || '';
                    document.getElementById('portOfDestination').value = shipment.general.port.portOfDestination || '';
                    document.getElementById('countryOfDestination').value = shipment.general.port.countryOfDestination || '';
                }
            }

            if (shipment.invoice) {
                document.getElementById('invoiceNo').value = shipment.invoice.invoiceNo || '';
                document.getElementById('invoiceDate').value = shipment.invoice.invoiceDate || '';
                document.getElementById('termsOfPayment').value = shipment.invoice.termsOfPayment || '';
                document.getElementById('advance').value = shipment.invoice.advance || '';
                document.getElementById('grandTotal').value = shipment.invoice.grandTotal || '';
                document.getElementById('fobValue').value = shipment.invoice.fobValue || '';
                document.getElementById('totalFreight').value = shipment.invoice.totalFreight || '';

                // Clear existing goods rows
                goodsTableBody.innerHTML = '';
                
                // Add goods rows if they exist
                if (shipment.invoice.goods && shipment.invoice.goods.length > 0) {
                    shipment.invoice.goods.forEach(item => {
                        addGoodsRow();
                        const lastRow = goodsTableBody.lastElementChild;
                        lastRow.querySelector('.goods-name').value = item.goodsName || '';
                        lastRow.querySelector('.hs-code').value = item.hsCode || '';
                        lastRow.querySelector('.quantity').value = item.quantityNetWeight || '';
                        lastRow.querySelector('.unit-price').value = item.unitPrice || '';
                        lastRow.querySelector('.amount').value = item.amount || '';
                    });
                } else {
                    addGoodsRow(); // Add one empty row if no goods exist
                }
            }

            if (shipment.insurance) {
                document.getElementById('insuranceCompany').value = shipment.insurance.company || '';
                document.getElementById('totalSumInsured').value = shipment.insurance.totalSumInsured || '';
                document.getElementById('policyNumber').value = shipment.insurance.policyNumber || '';
                document.getElementById('certificateNumber').value = shipment.insurance.certificateNumber || '';
                document.getElementById('policyConditions').value = shipment.insurance.policyConditions || '';
            }

            if (shipment.packingList) {
                document.getElementById('containerNumber').value = shipment.packingList.containerNumber || '';
                document.getElementById('sealNumber').value = shipment.packingList.sealNumber || '';
                document.getElementById('packagesBundles').value = shipment.packingList.packagesBundles || '';
                document.getElementById('grossWeight').value = shipment.packingList.grossWeight || '';
                document.getElementById('netWeight').value = shipment.packingList.netWeight || '';
            }

            currentShipmentId = shipmentId;
            updateSectionProgress();
        } catch (error) {
            console.error('Error loading shipment details:', error);
            showNotification('Error loading shipment details', 'error');
        }
    }

    function displayShipmentFiles(files) {
        const filesContainer = document.getElementById('shipmentFiles');
        filesContainer.innerHTML = files.map(file => `
            <div class="file-item">
                <span class="file-link" data-filename="${file.filename}" data-original-name="${file.originalName}">
                    <i class="file-icon ${getFileIconClass(file.originalName)}" title="${getFileType(file.originalName)}"></i>
                    ${file.originalName}
                </span>
                <button type="button" class="remove-file" data-id="${file._id}">✕</button>
            </div>
        `).join('');

        // Add event listeners to remove buttons
        document.querySelectorAll('#shipmentFiles .remove-file').forEach(button => {
            button.addEventListener('click', async (e) => {
                const fileId = e.target.dataset.id;
                await deleteFile(fileId);
            });
        });

        // Add click event listeners to file links
        document.querySelectorAll('#shipmentFiles .file-link').forEach(link => {
            link.addEventListener('click', () => {
                const filename = link.dataset.filename;
                const originalName = link.dataset.originalName;
                // Open file in new tab
                window.open(`/uploads/${filename}`, '_blank');
            });

            // Add pointer cursor style
            link.style.cursor = 'pointer';
        });
    }

    // Handle adding files to existing shipment
    const addFilesBtn = document.getElementById('addFilesBtn');
    const additionalFiles = document.getElementById('additionalFiles');

    addFilesBtn.addEventListener('click', () => {
        additionalFiles.click();
    });

    additionalFiles.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length || !currentShipmentId) return;

        const formData = new FormData();
        files.forEach(file => {
            formData.append('files', file);
        });

        try {
            const response = await fetch(`/api/shipments/${currentShipmentId}/files`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                showNotification('Files added successfully!', 'success');
                loadShipmentDetails(currentShipmentId);
            } else {
                showNotification('Error adding files', 'error');
            }
        } catch (error) {
            showNotification('Server error', 'error');
        }
    });

    // Handle file deletion
    async function deleteFile(fileId) {
        try {
            const response = await fetch(`/api/files/${fileId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                showNotification('File deleted successfully', 'success');
                loadShipmentDetails(currentShipmentId);
            } else {
                showNotification('Error deleting file', 'error');
            }
        } catch (error) {
            showNotification('Server error', 'error');
        }
    }

    // Handle shipment deletion
    document.getElementById('deleteShipmentBtn').addEventListener('click', async () => {
        if (!currentShipmentId) return;

        if (confirm('Are you sure you want to delete this shipment? This action cannot be undone.')) {
            try {
                const response = await fetch(`/api/shipments/${currentShipmentId}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    showNotification('Shipment deleted successfully', 'success');
                    document.getElementById('shipmentDetails').classList.add('hidden');
                    currentShipmentId = null;
                    loadShipments();
                } else {
                    showNotification('Error deleting shipment', 'error');
                }
            } catch (error) {
                showNotification('Server error', 'error');
            }
        }
    });

    function showNotification(message, type = 'success') {
        notification.textContent = message;
        notification.style.backgroundColor = type === 'success' ? 'var(--success-color)' : 'var(--error-color)';
        notification.style.display = 'block';

        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }

    // Save shipment details
    document.getElementById('saveShipmentBtn').addEventListener('click', async () => {
        if (!currentShipmentId) return;

        const shipmentData = {
            general: {
                awbNo: document.getElementById('awbNo').value,
                dateCreated: document.getElementById('dateCreated').value,
                customsHouseCode: document.getElementById('customsHouseCode').value,
                
                exporter: {
                    name: document.getElementById('exporterName').value,
                    address: document.getElementById('exporterAddress').value,
                    iecCode: document.getElementById('iecCode').value,
                    adCode: document.getElementById('adCode').value,
                    gstNo: document.getElementById('gstNo').value,
                    panNumber: document.getElementById('panNumber').value,
                    country: document.getElementById('exporterCountry').value,
                    salesContractNumber: document.getElementById('salesContractNumber').value
                },

                consignee: {
                    name: document.getElementById('consigneeName').value,
                    address: document.getElementById('consigneeAddress').value,
                    country: document.getElementById('consigneeCountry').value
                },

                port: {
                    portOfLanding: document.getElementById('portOfLanding').value,
                    portOfDischarge: document.getElementById('portOfDischarge').value,
                    countryOfDischarge: document.getElementById('countryOfDischarge').value,
                    portOfDestination: document.getElementById('portOfDestination').value,
                    countryOfDestination: document.getElementById('countryOfDestination').value
                }
            },

            invoice: {
                invoiceNo: document.getElementById('invoiceNo').value,
                invoiceDate: document.getElementById('invoiceDate').value,
                termsOfPayment: document.getElementById('termsOfPayment').value,
                goods: Array.from(goodsTableBody.querySelectorAll('tr')).map(row => ({
                    goodsName: row.querySelector('.goods-name').value,
                    hsCode: row.querySelector('.hs-code').value,
                    quantityNetWeight: parseFloat(row.querySelector('.quantity').value) || 0,
                    unitPrice: parseFloat(row.querySelector('.unit-price').value) || 0,
                    amount: parseFloat(row.querySelector('.amount').value) || 0
                })),
                advance: parseFloat(document.getElementById('advance').value) || 0,
                grandTotal: parseFloat(document.getElementById('grandTotal').value) || 0,
                fobValue: parseFloat(document.getElementById('fobValue').value) || 0,
                totalFreight: parseFloat(document.getElementById('totalFreight').value) || 0
            },

            insurance: {
                company: document.getElementById('insuranceCompany').value,
                totalSumInsured: parseFloat(document.getElementById('totalSumInsured').value) || 0,
                policyNumber: document.getElementById('policyNumber').value,
                certificateNumber: document.getElementById('certificateNumber').value,
                policyConditions: document.getElementById('policyConditions').value
            },

            packingList: {
                containerNumber: document.getElementById('containerNumber').value,
                sealNumber: document.getElementById('sealNumber').value,
                packagesBundles: parseInt(document.getElementById('packagesBundles').value) || 0,
                grossWeight: parseFloat(document.getElementById('grossWeight').value) || 0,
                netWeight: parseFloat(document.getElementById('netWeight').value) || 0
            }
        };

        try {
            const response = await fetch(`/api/shipments/${currentShipmentId}/details`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(shipmentData)
            });

            if (response.ok) {
                showNotification('Data Saved!', 'success');
            } else {
                showNotification('Error saving data', 'error');
            }
        } catch (error) {
            showNotification('Server error', 'error');
        }
    });

    function fillFormFields(data) {
        console.log('Data received for filling:', data); // Debug log

        // General Section
        document.getElementById('awbNo').value = data.awbNo || '';
        document.getElementById('customsHouseCode').value = data.customsHouseCode || '';
        
        // Exporter Details
        document.getElementById('exporterName').value = data.exporterName || '';
        document.getElementById('exporterAddress').value = data.exporterAddress || '';
        document.getElementById('iecCode').value = data.iecCode || '';
        document.getElementById('adCode').value = data.adCode || '';
        document.getElementById('gstNo').value = data.gstNo || '';
        document.getElementById('panNumber').value = data.panNumber || '';
        document.getElementById('exporterCountry').value = data.exporterCountry || '';
        document.getElementById('salesContractNumber').value = data.salesContractNumber || '';
        
        // Consignee Details
        document.getElementById('consigneeName').value = data.consigneeName || '';
        document.getElementById('consigneeAddress').value = data.consigneeAddress || '';
        document.getElementById('consigneeCountry').value = data.consigneeCountry || '';
        
        // Port Details
        document.getElementById('portOfLanding').value = data.portOfLanding || '';
        document.getElementById('portOfDischarge').value = data.portOfDischarge || '';
        document.getElementById('countryOfDischarge').value = data.countryOfDischarge || '';
        document.getElementById('portOfDestination').value = data.portOfDestination || '';
        document.getElementById('countryOfDestination').value = data.countryOfDestination || '';
        
        // Invoice Section
        document.getElementById('invoiceNo').value = data.invoiceNo || '';
        document.getElementById('invoiceDate').value = data.invoiceDate || '';
        document.getElementById('termsOfPayment').value = data.termsOfPayment || '';
        
        // Clear existing goods rows
        const goodsTableBody = document.getElementById('goodsTableBody');
        goodsTableBody.innerHTML = '';
        
        // Add goods rows if they exist
        if (data.goods && data.goods.length > 0) {
            data.goods.forEach(item => {
                addGoodsRow();
                const lastRow = goodsTableBody.lastElementChild;
                lastRow.querySelector('.goods-name').value = item.goodsName || '';
                lastRow.querySelector('.hs-code').value = item.hsCode || '';
                lastRow.querySelector('.quantity').value = item.quantityNetWeight || '';
                lastRow.querySelector('.unit-price').value = item.unitPrice || '';
                lastRow.querySelector('.amount').value = item.amount || '';
            });
        } else {
            // Add one empty row if no goods exist
            addGoodsRow();
        }
        
        // Invoice Totals
        document.getElementById('advance').value = data.advance || '';
        document.getElementById('grandTotal').value = data.grandTotal || '';
        document.getElementById('fobValue').value = data.fobValue || '';
        document.getElementById('totalFreight').value = data.totalFreight || '';
        
        // Insurance Section
        if (data.insurance) {
            document.getElementById('insuranceCompany').value = data.insurance.company || '';
            document.getElementById('totalSumInsured').value = data.insurance.totalSumInsured || '';
            document.getElementById('policyNumber').value = data.insurance.policyNumber || '';
            document.getElementById('certificateNumber').value = data.insurance.certificateNumber || '';
            document.getElementById('policyConditions').value = data.insurance.policyConditions || '';
        }
        
        // Packing List Section
        if (data.packingList) {
            document.getElementById('containerNumber').value = data.packingList.containerNumber || '';
            document.getElementById('sealNumber').value = data.packingList.sealNumber || '';
            document.getElementById('packagesBundles').value = data.packingList.packagesBundles || '';
            document.getElementById('grossWeight').value = data.packingList.grossWeight || '';
            document.getElementById('netWeight').value = data.packingList.netWeight || '';
        }

        // Update progress indicators
        updateSectionProgress();
    }

    // Initial load of shipments
    loadShipments();

    // Helper functions for file type display
    function getFileType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        if (ext === 'pdf') return 'PDF Document';
        if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'Image';
        return 'File';
    }

    function getFileIconClass(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        if (ext === 'pdf') return 'fas fa-file-pdf';
        if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'fas fa-file-image';
        return 'fas fa-file';
    }

    // Add these functions at the top level
    function updateProgress(percent, status) {
        const progressBar = document.getElementById('progressBar');
        const progressStatus = document.getElementById('progressStatus');
        const progressContainer = document.getElementById('progressContainer');
        
        progressBar.style.width = `${percent}%`;
        if (status) {
            progressStatus.textContent = status;
        }
        progressContainer.style.display = 'block';
    }

    function resetProgress() {
        const progressBar = document.getElementById('progressBar');
        const progressContainer = document.getElementById('progressContainer');
        const progressStatus = document.getElementById('progressStatus');
        
        progressBar.style.width = '0%';
        progressStatus.textContent = 'Processing...';
        progressContainer.style.display = 'none';
        progressContainer.classList.remove('error', 'success');
    }

    // Update the Auto Fill button handler
    autoFillBtn.addEventListener('click', async () => {
        try {
            resetProgress();
            updateProgress(0, 'Initializing...');
            
            if (!azureService.computerVisionKey || !azureService.openAIKey) {
                throw new Error('Azure service not properly initialized');
            }

            if (!currentShipmentId) {
                throw new Error('No shipment selected');
            }
            
            updateProgress(10, 'Fetching shipment details...');
            const shipmentResponse = await fetch(`/api/shipments/${currentShipmentId}`);
            if (!shipmentResponse.ok) {
                throw new Error(`Failed to fetch shipment: ${shipmentResponse.status} ${shipmentResponse.statusText}`);
            }
            
            const shipment = await shipmentResponse.json();
            const files = shipment.files;
            
            if (!files || files.length === 0) {
                throw new Error('No files found in the shipment');
            }
            
            updateProgress(20, 'Processing files...');
            let allExtractedText = '';
            const totalFiles = files.length;
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const progressPercent = 20 + ((i + 1) / totalFiles) * 40;
                updateProgress(progressPercent, `Processing file ${i + 1} of ${totalFiles}: ${file.originalName}`);
                
                const fileResponse = await fetch(`/uploads/${file.filename}`);
                if (!fileResponse.ok) {
                    throw new Error(`Failed to fetch file ${file.originalName}`);
                }
                
                const fileBlob = await fileResponse.blob();
                
                try {
                    if (file.originalName.toLowerCase().endsWith('.pdf')) {
                        const images = await azureService.convertPdfToImages(fileBlob);
                        for (const image of images) {
                            allExtractedText += '\n' + image.text;
                        }
                    } else {
                        const ocrResult = await azureService.extractTextFromImage(fileBlob);
                        allExtractedText += '\n' + ocrResult[0].text;
                    }
                } catch (fileError) {
                    throw new Error(`Failed to process file ${file.originalName}: ${fileError.message}`);
                }
            }
            
            updateProgress(70, 'Analyzing extracted text...');
            const extractedData = await azureService.extractShipmentDetails(allExtractedText);
            
            updateProgress(90, 'Filling form fields...');
            fillFormFields(extractedData);
            
            updateProgress(100, 'Complete!');
            document.getElementById('progressContainer').classList.add('success');
            
            setTimeout(() => {
                resetProgress();
            }, 2000);
            
            showNotification('Data Auto Fill complete!', 'success');
        } catch (error) {
            console.error('Auto-fill error:', error);
            document.getElementById('progressContainer').classList.add('error');
            updateProgress(100, `Error: ${error.message}`);
            showNotification(`Error: ${error.message}`, 'error');
            
            setTimeout(() => {
                resetProgress();
            }, 3000);
        }
    });

    function updateSectionProgress() {
        // General section
        const generalFields = {
            awbNo: document.getElementById('awbNo').value,
            customsHouseCode: document.getElementById('customsHouseCode').value,
            exporterName: document.getElementById('exporterName').value,
            exporterAddress: document.getElementById('exporterAddress').value,
            consigneeName: document.getElementById('consigneeName').value,
            consigneeAddress: document.getElementById('consigneeAddress').value,
            portOfLanding: document.getElementById('portOfLanding').value,
            portOfDischarge: document.getElementById('portOfDischarge').value
        };
        
        // Invoice section
        const invoiceFields = {
            invoiceNo: document.getElementById('invoiceNo').value,
            invoiceDate: document.getElementById('invoiceDate').value,
            termsOfPayment: document.getElementById('termsOfPayment').value,
            goods: Array.from(document.querySelectorAll('#goodsTableBody tr')).length > 0,
            advance: document.getElementById('advance').value,
            grandTotal: document.getElementById('grandTotal').value
        };
        
        // Insurance section
        const insuranceFields = {
            company: document.getElementById('insuranceCompany').value,
            totalSumInsured: document.getElementById('totalSumInsured').value,
            policyNumber: document.getElementById('policyNumber').value,
            certificateNumber: document.getElementById('certificateNumber').value
        };
        
        // Packing List section
        const packingFields = {
            containerNumber: document.getElementById('containerNumber').value,
            sealNumber: document.getElementById('sealNumber').value,
            packagesBundles: document.getElementById('packagesBundles').value,
            grossWeight: document.getElementById('grossWeight').value,
            netWeight: document.getElementById('netWeight').value
        };

        // Calculate completion for each section
        function calculateCompletion(fields) {
            const total = Object.keys(fields).length;
            const filled = Object.values(fields).filter(value => value && value.toString().trim() !== '').length;
            return filled / total;
        }

        // Update progress indicators
        function updateProgressIndicator(id, completion) {
            const element = document.getElementById(id);
            element.classList.remove('complete', 'partial');
            if (completion === 1) {
                element.classList.add('complete');
            } else if (completion > 0) {
                element.classList.add('partial');
            }
        }

        updateProgressIndicator('generalProgress', calculateCompletion(generalFields));
        updateProgressIndicator('invoiceProgress', calculateCompletion(invoiceFields));
        updateProgressIndicator('insuranceProgress', calculateCompletion(insuranceFields));
        updateProgressIndicator('packingProgress', calculateCompletion(packingFields));
    }

    // Add event listeners to all input fields
    document.querySelectorAll('input, textarea').forEach(input => {
        input.addEventListener('change', updateSectionProgress);
    });

    // Update progress when goods table changes
    const observer = new MutationObserver(updateSectionProgress);
    observer.observe(document.getElementById('goodsTableBody'), { childList: true, subtree: true });

    // Add this function to handle PDF generation
    async function generatePDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Set initial font styles
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        
        // Add title and job number
        doc.text('Shipment Details', 105, 15, { align: 'center' });
        doc.text(`Job Number: ${document.getElementById('detailsJobNumber').textContent}`, 20, 25);
        
        let yPos = 35;
        
        // Helper function to add section data in tabular format
        function addSection(title, fields) {
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(title, 20, yPos);
            yPos += 10;
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            
            const data = fields.map(field => [
                field.label,
                document.getElementById(field.id).value || '---'
            ]);
            
            doc.autoTable({
                startY: yPos,
                head: [['Field', 'Value']],
                body: data,
                theme: 'grid',
                headStyles: { fillColor: [69, 69, 69] },
                styles: { fontSize: 9 },
                margin: { left: 20, right: 20 },
                columnStyles: {
                    0: { cellWidth: 60 },
                    1: { cellWidth: 110 }
                }
            });
            
            yPos = doc.lastAutoTable.finalY + 10;
            
            // Add new page if needed
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }
        }
        
        // General Section
        const generalFields = [
            { label: 'AWB No.', id: 'awbNo' },
            { label: 'Date Created', id: 'dateCreated' },
            { label: 'Customs House Code', id: 'customsHouseCode' }
        ];
        
        const exporterFields = [
            { label: 'Exporter Name', id: 'exporterName' },
            { label: 'Exporter Address', id: 'exporterAddress' },
            { label: 'IEC Code', id: 'iecCode' },
            { label: 'AD Code', id: 'adCode' },
            { label: 'GST No.', id: 'gstNo' },
            { label: 'PAN Number', id: 'panNumber' },
            { label: 'Exporter Country', id: 'exporterCountry' },
            { label: 'Sales Contract Number', id: 'salesContractNumber' }
        ];
        
        const consigneeFields = [
            { label: 'Consignee Name', id: 'consigneeName' },
            { label: 'Consignee Address', id: 'consigneeAddress' },
            { label: 'Consignee Country', id: 'consigneeCountry' }
        ];
        
        const portFields = [
            { label: 'Port of Landing', id: 'portOfLanding' },
            { label: 'Port of Discharge', id: 'portOfDischarge' },
            { label: 'Country of Discharge', id: 'countryOfDischarge' },
            { label: 'Port of Destination', id: 'portOfDestination' },
            { label: 'Country of Destination', id: 'countryOfDestination' }
        ];
        
        addSection('GENERAL DETAILS', generalFields);
        addSection('EXPORTER DETAILS', exporterFields);
        addSection('CONSIGNEE DETAILS', consigneeFields);
        addSection('PORT DETAILS', portFields);
        
        // Invoice Section
        const invoiceFields = [
            { label: 'Invoice No.', id: 'invoiceNo' },
            { label: 'Invoice Date', id: 'invoiceDate' },
            { label: 'Terms of Payment', id: 'termsOfPayment' }
        ];
        addSection('INVOICE DETAILS', invoiceFields);
        
        // Goods Table
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('GOODS DETAILS', 20, yPos);
        yPos += 10;
        
        const goodsData = Array.from(document.querySelectorAll('#goodsTableBody tr')).map(row => [
            row.querySelector('.goods-name').value || '---',
            row.querySelector('.hs-code').value || '---',
            `${row.querySelector('.quantity').value || '0'} MT`,
            `USD ${row.querySelector('.unit-price').value || '0'}`,
            `USD ${row.querySelector('.amount').value || '0'}`
        ]);
        
        doc.autoTable({
            startY: yPos,
            head: [['Goods Name', 'HS Code', 'Quantity', 'Unit Price', 'Amount']],
            body: goodsData,
            theme: 'grid',
            headStyles: { fillColor: [69, 69, 69] },
            styles: { fontSize: 9 }
        });
        
        yPos = doc.lastAutoTable.finalY + 10;
        
        // Invoice Totals
        const totalsFields = [
            { label: 'Advance', id: 'advance' },
            { label: 'Grand Total', id: 'grandTotal' },
            { label: 'FOB Value', id: 'fobValue' },
            { label: 'Total Freight', id: 'totalFreight' }
        ];
        
        const totalsData = totalsFields.map(field => [
            field.label,
            `USD ${document.getElementById(field.id).value || '0'}`
        ]);
        
        doc.autoTable({
            startY: yPos,
            body: totalsData,
            theme: 'grid',
            styles: { fontSize: 9 },
            margin: { left: 100 },
            columnStyles: {
                0: { cellWidth: 40 },
                1: { cellWidth: 50 }
            }
        });
        
        yPos = doc.lastAutoTable.finalY + 10;
        
        if (yPos > 270) {
            doc.addPage();
            yPos = 20;
        }
        
        // Insurance Section
        const insuranceFields = [
            { label: 'Company of Insurance', id: 'insuranceCompany' },
            { label: 'Total Sum Insured', id: 'totalSumInsured' },
            { label: 'Policy Number', id: 'policyNumber' },
            { label: 'Certificate Number', id: 'certificateNumber' },
            { label: 'Policy Conditions', id: 'policyConditions' }
        ];
        addSection('INSURANCE DETAILS', insuranceFields);
        
        // Packing List Section
        const packingFields = [
            { label: 'Container Number', id: 'containerNumber' },
            { label: 'Seal Number', id: 'sealNumber' },
            { label: 'Packages/Bundles', id: 'packagesBundles' },
            { label: 'Gross Weight', id: 'grossWeight' },
            { label: 'Net Weight', id: 'netWeight' }
        ];
        addSection('PACKING LIST DETAILS', packingFields);
        
        // Documents Section
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('DOCUMENTS SUBMITTED', 20, yPos);
        yPos += 10;
        
        const files = Array.from(document.querySelectorAll('#shipmentFiles .file-item'))
            .map(item => [item.querySelector('.file-link').dataset.originalName]);
        
        doc.autoTable({
            startY: yPos,
            head: [['Document Name']],
            body: files,
            theme: 'grid',
            headStyles: { fillColor: [69, 69, 69] },
            styles: { fontSize: 9 }
        });
        
        // Before saving, add uploaded documents
        try {
            // Get all files
            const files = Array.from(document.querySelectorAll('#shipmentFiles .file-item'));
            
            // Process each file (removed the section break page)
            for (const file of files) {
                const filename = file.querySelector('.file-link').dataset.filename;
                const originalName = file.querySelector('.file-link').dataset.originalName;
                
                try {
                    // Fetch the file
                    const response = await fetch(`/uploads/${filename}`);
                    const blob = await response.blob();

                    // Convert blob to base64
                    const base64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });

                    // If it's a PDF file
                    if (originalName.toLowerCase().endsWith('.pdf')) {
                        // Load the PDF
                        const pdfDoc = await pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
                        
                        // Add each page
                        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
                            // Add new page to our document
                            doc.addPage();
                            
                            // Add page label
                            doc.setFontSize(10);
                            doc.setTextColor(128);
                            doc.text(`${originalName} - Page ${pageNum}`, 20, 10);
                            
                            // Get the page
                            const page = await pdfDoc.getPage(pageNum);
                            const viewport = page.getViewport({ scale: 1.5 });
                            
                            // Create canvas
                            const canvas = document.createElement('canvas');
                            const context = canvas.getContext('2d');
                            canvas.height = viewport.height;
                            canvas.width = viewport.width;
                            
                            // Render PDF page to canvas
                            await page.render({
                                canvasContext: context,
                                viewport: viewport
                            }).promise;
                            
                            // Add canvas image to PDF
                            const imgData = canvas.toDataURL('image/jpeg', 0.75);
                            doc.addImage(imgData, 'JPEG', 20, 15, 170, 250);
                        }
                    }
                    // If it's an image file
                    else if (/\.(jpe?g|png|gif)$/i.test(originalName)) {
                        // Add new page
                        doc.addPage();
                        
                        // Add image label
                        doc.setFontSize(10);
                        doc.setTextColor(128);
                        doc.text(originalName, 20, 10);
                        
                        // Add image
                        doc.addImage(base64, 'JPEG', 20, 15, 170, 250);
                    }
                } catch (error) {
                    console.error(`Error processing file ${originalName}:`, error);
                    // Add error note in PDF
                    doc.addPage();
                    doc.setFontSize(12);
                    doc.setTextColor(255, 0, 0);
                    doc.text(`Error including file: ${originalName}`, 20, 20);
                }
            }
        } catch (error) {
            console.error('Error processing attachments:', error);
            showNotification('Error adding attachments to PDF', 'error');
        }

        // Reset text color to black for any subsequent text
        doc.setTextColor(0);

        // Save the complete PDF
        const jobNumber = document.getElementById('detailsJobNumber').textContent;
        const fileName = `Shipment_${jobNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
        
        doc.save(fileName);
        showNotification('Form Printed with Attachments!', 'success');
    }

    // Add event listener for the submit button
    document.getElementById('submitBtn').addEventListener('click', generatePDF);

    // Add this near the top of the file with other event listeners
    document.getElementById('logoutBtn').addEventListener('click', () => {
        // You might want to add any cleanup here
        window.location.href = '/'; // Redirect to login page
    });

    // Add with other event listeners
    document.getElementById('configEmailBtn').addEventListener('click', async () => {
        try {
            // Check if already configured
            const response = await fetch('/api/email/status');
            const { configured } = await response.json();
            
            if (!configured) {
                // Redirect to Google auth
                window.location.href = '/auth/google';
            } else {
                showNotification('Email already configured!', 'info');
            }
        } catch (error) {
            console.error('Error checking email configuration:', error);
            showNotification('Error checking email configuration', 'error');
        }
    });

    // Add with other event listeners
    document.getElementById('checkEmailBtn').addEventListener('click', async () => {
        try {
            const response = await fetch('/api/check-emails');
            if (!response.ok) {
                const error = await response.json();
                if (response.status === 401) {
                    showNotification('Please configure email first', 'error');
                } else {
                    throw new Error(error.message);
                }
                return;
            }

            const { shipments } = await response.json();
            if (shipments.length === 0) {
                showNotification('No new shipments found in email', 'info');
            } else {
                showNotification(`Created ${shipments.length} new shipment(s) from email!`, 'success');
                loadShipments(); // Refresh the shipments list
            }
        } catch (error) {
            console.error('Error checking emails:', error);
            showNotification('Error checking emails', 'error');
        }
    });
}); 