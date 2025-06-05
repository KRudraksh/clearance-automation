import pytesseract
from PIL import Image
import re
import cv2
import numpy as np

def preprocess_image(image_path):
    """
    Preprocess the image to improve OCR accuracy
    """
    # Read image using opencv
    img = cv2.imread(image_path)
    
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Apply thresholding to preprocess the image
    gray = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    
    # Apply dilation to connect text components
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3,3))
    gray = cv2.dilate(gray, kernel, iterations=1)
    
    return gray

def extract_invoice_data(image_path):
    """
    Extract data from invoice using OCR
    """
    # Preprocess the image
    processed_image = preprocess_image(image_path)
    
    # Perform OCR on the processed image
    text = pytesseract.image_to_string(processed_image)
    print(text)

def main():
    # Path to your invoice image
    image_path = 'sample.jpg'
    
    try:
        extract_invoice_data(image_path)
    except Exception as e:
        print(f"Error processing invoice: {str(e)}")

if __name__ == "__main__":
    main()