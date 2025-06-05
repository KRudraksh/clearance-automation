# document_extractor.py
import requests
import time
import json
import os
from typing import Dict, Any
from openai import AzureOpenAI
from datetime import datetime
import config

class DocumentExtractor:
    def __init__(self):
        self.vision_key = config.VISION_KEY
        self.vision_endpoint = config.VISION_ENDPOINT
        
        # Configure Azure OpenAI client
        self.client = AzureOpenAI(
            api_key=config.OPENAI_KEY,
            api_version="2024-02-15-preview",
            azure_endpoint=config.OPENAI_ENDPOINT
        )

    def extract_text_from_image(self, image_path: str) -> str:
        """Extract text from image using Azure Computer Vision."""
        read_url = f"{self.vision_endpoint}/vision/v3.2/read/analyze"
        
        headers = {
            'Ocp-Apim-Subscription-Key': self.vision_key,
            'Content-Type': 'application/octet-stream'
        }
        
        try:
            with open(image_path, 'rb') as image_file:
                image_data = image_file.read()
            
            response = requests.post(read_url, headers=headers, data=image_data)
            response.raise_for_status()
            
            operation_location = response.headers["Operation-Location"]
            
            while True:
                time.sleep(1)
                result_response = requests.get(
                    operation_location,
                    headers={'Ocp-Apim-Subscription-Key': self.vision_key}
                )
                result = result_response.json()
                
                if result.get("status") not in ['notStarted', 'running']:
                    break
            
            extracted_text = []
            if result.get("status") == "succeeded":
                for read_result in result.get("analyzeResult", {}).get("readResults", []):
                    for line in read_result.get("lines", []):
                        extracted_text.append(line.get("text", ""))
                        
            return "\n".join(extracted_text)
                
        except Exception as e:
            print(f"Error in OCR extraction: {str(e)}")
            return None

    def extract_fields(self, text: str) -> Dict[str, Any]:
        """Extract specific fields from text using Azure OpenAI."""
        try:
            prompt = """Please analyze the following text and extract these specific fields into a JSON format. 
            If a field is not found, use null as the value.
            
            Fields to extract:
            {
                "importer_name": "",
                "importer_address": "",
                "importer_email": "",
                "importer_iec_code": "",
                "importer_gst_number": "",
                "invoice_no": "",
                "date": "",
                "exporter_name": "",
                "exporter_address": "",
                "shipped_vessel": "",
                "sailing_date": "",
                "port_of_landing": "",
                "port_of_discharge": "",
                "final_destination": "",
                "terms_of_delivery": "",
                "payment_terms": "",
                "goods_name": "",
                "goods_hs_code": "",
                "quantity": "",
                "grand_total_amount": "",
                "total_fob_value": "",
                "total_freight_amount": ""
            }

            Text to analyze:
            {text_content}

            Please respond only with the JSON object, no additional text."""

            # Create messages with the template and the actual text
            messages = [
                {"role": "system", "content": "You are a precise document information extractor. Respond only with valid JSON."},
                {"role": "user", "content": prompt.replace("{text_content}", text)}
            ]

            # Make the API call
            response = self.client.chat.completions.create(
                model=config.OPENAI_DEPLOYMENT_NAME,
                messages=messages,
                temperature=0,
                max_tokens=2000,
                response_format={"type": "json_object"}  # Ensure JSON response
            )

            # Get the response content
            response_content = response.choices[0].message.content
            
            # Debug print
            # print("Raw API Response:", response_content)

            # Parse JSON response
            try:
                result = json.loads(response_content)
                return result
            except json.JSONDecodeError as e:
                print(f"JSON parsing error: {e}")
                print(f"Response content: {response_content}")
                return None

        except Exception as e:
            print(f"Error in field extraction: {str(e)}")
            print(f"Text being processed: {text[:200]}...")  # Print first 200 chars of input
            return None

    def process_document(self, image_path: str) -> Dict[str, Any]:
        """Process document from image to extracted fields."""
        # Extract text from image
        extracted_text = self.extract_text_from_image(image_path)
        if not extracted_text:
            print("No text was extracted from the image")
            return None
            
        # Print extracted text for debugging
        # print("\nExtracted text from image:")
        # print(extracted_text)
        print("\nProcessing extracted text...")
            
        # Extract fields from text
        fields = self.extract_fields(extracted_text)
        return fields

def setup_output_directory():
    """Create output directory if it doesn't exist."""
    os.makedirs(config.OUTPUT_DIR, exist_ok=True)

def main():
    try:
        # Create extractor instance
        extractor = DocumentExtractor()
        
        # Setup output directory
        setup_output_directory()
        
        # Process document
        image_path = config.DEFAULT_IMAGE_PATH
        
        # Verify image path exists
        if not os.path.exists(image_path):
            print(f"Error: Image file not found at {image_path}")
            return
            
        print(f"Processing image: {image_path}")
        results = extractor.process_document(image_path)
        
        if results:
            # Save results to file
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = os.path.join(config.OUTPUT_DIR, f"extracted_fields_{timestamp}.json")
            
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(results, f, indent=2)
                
            print(f"\nResults saved to {output_file}")
            # print("\nExtracted Fields:")
            # print(json.dumps(results, indent=2))
        else:
            print("No results were extracted from the document")

    except Exception as e:
        print(f"Main execution error: {str(e)}")

if __name__ == "__main__":
    main()