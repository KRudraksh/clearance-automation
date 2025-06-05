window.AzureService = class AzureService {
    constructor() {
        // We'll fetch the configuration from the server
        this.init();
    }

    async init() {
        try {
            const response = await fetch('/api/config');
            const config = await response.json();
            
            // Set endpoints from config
            this.computerVisionEndpoint = config.azure.computerVision.endpoint;
            this.openAIEndpoint = config.azure.openAI.endpoint;
            this.openAIDeploymentName = config.azure.openAI.deploymentName;
            
            // Get keys from server
            const keysResponse = await fetch('/api/azure-keys');
            const keys = await keysResponse.json();
            
            this.computerVisionKey = keys.computerVision;
            this.openAIKey = keys.openAI;
        } catch (error) {
            console.error('Failed to initialize Azure service:', error);
        }
    }

    async convertPdfToImages(pdfBlob) {
        // Use pdf.js to convert PDF to images
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        const pdf = await pdfjsLib.getDocument({ data: await pdfBlob.arrayBuffer() }).promise;
        const images = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            const imageBlob = await new Promise(resolve => canvas.toBlob(resolve));
            const extractedText = await this.extractTextFromImage(imageBlob);
            images.push({ blob: imageBlob, text: extractedText[0].text });
        }

        return images;
    }

    async extractTextFromImage(imageBlob) {
        try {
            console.log('Calling Azure Computer Vision API...');
            const cleanEndpoint = this.computerVisionEndpoint.replace(/\/+$/, '');
            
            // Fix: Use correct parameter names without hyphens
            const params = new URLSearchParams({
                language: 'en',
                detectOrientation: 'true',
                modelVersion: 'latest'  // Changed from model-version to modelVersion
            });

            const response = await fetch(`${cleanEndpoint}/vision/v3.2/ocr?${params}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'Ocp-Apim-Subscription-Key': this.computerVisionKey
                },
                body: imageBlob
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OCR API request failed: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const result = await response.json();
            console.log('Raw OCR response:', JSON.stringify(result, null, 2)); // Debug log
            return this.processOCRResponse(result);
        } catch (error) {
            console.error('Error in extractTextFromImage:', error);
            throw error;
        }
    }

    processOCRResponse(ocrResult) {
        let allText = '';
        
        if (ocrResult.regions) {
            // Process each region
            ocrResult.regions.forEach(region => {
                // Process each line in the region
                region.lines.forEach(line => {
                    // Join all words in the line
                    const lineText = line.words.map(word => word.text).join(' ');
                    allText += lineText + '\n';
                });
            });
        }
        
        console.log('Extracted OCR text:', allText); // Debug log
        return [{ text: allText }];
    }

    async extractShipmentDetails(text) {
        try {
            console.log('Calling Azure OpenAI API...');
            const prompt = `Extract ALL shipping details from the following text and format the response as a valid JSON object. Pay special attention to all sections including General, Invoice, Insurance, and Packing List details.

                Use this exact format and extract ALL available values:
                {
                    "awbNo": "",
                    "customsHouseCode": "",
                    "exporterName": "",
                    "exporterAddress": "",
                    "iecCode": "",
                    "adCode": "",
                    "gstNo": "",
                    "panNumber": "",
                    "exporterCountry": "",
                    "salesContractNumber": "",
                    "consigneeName": "",
                    "consigneeAddress": "",
                    "consigneeCountry": "",
                    "portOfLanding": "",
                    "portOfDischarge": "",
                    "countryOfDischarge": "",
                    "portOfDestination": "",
                    "countryOfDestination": "",
                    "invoiceNo": "",
                    "invoiceDate": "",
                    "termsOfPayment": "",
                    "goods": [
                        {
                            "goodsName": "",
                            "hsCode": "",
                            "quantityNetWeight": 0,
                            "unitPrice": 0,
                            "amount": 0
                        }
                    ],
                    "advance": 0,
                    "grandTotal": 0,
                    "fobValue": 0,
                    "totalFreight": 0,
                    "insurance": {
                        "company": "",
                        "totalSumInsured": 0,
                        "policyNumber": "",
                        "certificateNumber": "",
                        "policyConditions": ""
                    },
                    "packingList": {
                        "containerNumber": "",
                        "sealNumber": "",
                        "packagesBundles": 0,
                        "grossWeight": 0,
                        "netWeight": 0
                    }
                }

                Important instructions:
                1. Extract ALL values from the text, including Insurance and Packing List details
                2. For numbers, convert text values to actual numbers (remove currency symbols and commas)
                3. For dates, maintain the format as found in the document
                4. Look for insurance details like policy numbers, certificate numbers, and insurance company names
                5. Look for packing details like container numbers, seal numbers, and weight information
                6. Ensure all nested objects (insurance, packingList) are properly populated
                7. Convert all monetary values to numbers without currency symbols

                Text to process: ${text}
                
                Important: Respond with only the JSON object, no markdown formatting or additional text.`;

            const cleanEndpoint = this.openAIEndpoint.replace(/\/+$/, '');
            const apiVersion = '2023-05-15';
            const url = `${cleanEndpoint}/openai/deployments/${this.openAIDeploymentName}/chat/completions?api-version=${apiVersion}`;
            
            console.log('Calling OpenAI URL:', url);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': this.openAIKey
                },
                body: JSON.stringify({
                    messages: [
                        {
                            role: "system",
                            content: "You are a specialized shipping document parser. Extract ALL details from shipping documents including general information, invoice details, insurance information, and packing list details. Be thorough and precise in extracting every available piece of information."
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    max_tokens: 2000,
                    temperature: 0.3
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI API request failed: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const result = await response.json();
            let content = result.choices[0].message.content.trim();
            
            // Remove markdown code block if present
            content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            
            // Log the cleaned response for debugging
            console.log('Cleaned OpenAI response:', content);

            try {
                return JSON.parse(content);
            } catch (parseError) {
                console.error('Failed to parse OpenAI response:', content);
                throw new Error('Failed to parse OpenAI response as JSON');
            }
        } catch (error) {
            console.error('Error in extractShipmentDetails:', error);
            throw error;
        }
    }
} 