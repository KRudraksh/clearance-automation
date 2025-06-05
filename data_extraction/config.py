# config_template.py
"""
Template for configuration settings.
Copy this file to config.py and fill in your actual credentials.
"""

# Azure Computer Vision credentials
VISION_KEY = "FoEeWjVkDJ0YWDgeOHNvDNieOJdd507phZhbH7ZVwL6U7ohlxCvkJQQJ99BBAC8vTInXJ3w3AAAFACOGwIH8"
VISION_ENDPOINT = "https://ocr-rudy.cognitiveservices.azure.com/"

# Azure OpenAI credentials
OPENAI_KEY = "FDRhmOhcvUVwLkONV5Rv4YvAGYWbFdXYS2Wse73XT3OKp2ShXPHbJQQJ99BBACYeBjFXJ3w3AAABACOGf6AW"
OPENAI_ENDPOINT = "https://ocr-rudy-llm.openai.azure.com/"
OPENAI_DEPLOYMENT_NAME = "gpt-4o-mini"

# File paths
DEFAULT_IMAGE_PATH = "sample.jpg"
OUTPUT_DIR = "output"