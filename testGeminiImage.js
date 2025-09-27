require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testImage(imagePath) {
  try {
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    console.log(`Testing image: ${imagePath}`);
    console.log(`File size: ${fs.statSync(imagePath).size} bytes`);

    const imageData = fs.readFileSync(imagePath);
    const base64Image = imageData.toString('base64');

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
    You are an AI assistant specialized in extracting and analyzing financial amounts from medical bills, receipts, and invoices.

    Please analyze this image and extract:
    1. All monetary amounts (numbers with currency symbols or that appear to be prices/costs)
    2. The context for each amount (what it represents - total, subtotal, tax, discount, consultation fee, medicine cost, etc.)
    3. The currency used
    4. Your confidence level in the extraction

    Return the response in this JSON format:
    {
      "extracted_amounts": [
        {
          "value": 123.45,
          "type": "total_bill|subtotal|tax|discount|consultation_fee|medicine_cost|test_fee|paid|due",
          "context": "description of where this amount was found",
          "confidence": 0.95
        }
      ],
      "currency": "USD|EUR|INR|etc",
      "overall_confidence": 0.90,
      "raw_text": "any text you can read from the image"
    }
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();
    
    console.log('Gemini Response:');
    console.log(text);
    
    // Try to parse JSON response
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedResponse = JSON.parse(jsonMatch[0]);
        console.log('\nParsed JSON Response:');
        console.log(JSON.stringify(parsedResponse, null, 2));
        return parsedResponse;
      }
    } catch (parseError) {
      console.log('Could not parse as JSON, raw response above');
    }

  } catch (error) {
    console.error('Gemini Image Test Error:', error);
  }
}

// Function to find image files in common locations
function findImageFiles() {
  const commonPaths = [
    './sample/',
    './samples/',
    './images/',
    './test/',
    './uploads/',
    './Uploads/',
    '../sample/',
    '../samples/',
    '../images/',
  ];

  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'];
  const foundImages = [];

  for (const basePath of commonPaths) {
    if (fs.existsSync(basePath)) {
      const files = fs.readdirSync(basePath);
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (imageExtensions.includes(ext)) {
          foundImages.push(path.join(basePath, file));
        }
      }
    }
  }

  return foundImages;
}

// Main execution
async function main() {
  console.log('=== Gemini Image Analysis Test ===\n');

  // Check if GEMINI_API_KEY is set
  if (!process.env.GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY not found in environment variables');
    console.log('Please add GEMINI_API_KEY to your .env file');
    return;
  }

  // Try to find image files
  const foundImages = findImageFiles();
  
  if (foundImages.length === 0) {
    console.log('No image files found in common directories.');
    console.log('Please place test images in one of these directories:');
    console.log('- ./sample/');
    console.log('- ./samples/');
    console.log('- ./images/');
    console.log('- ./uploads/');
    console.log('\nSupported formats: .jpg, .jpeg, .png, .gif, .bmp');
    return;
  }

  console.log('Found images:');
  foundImages.forEach((img, index) => {
    console.log(`${index + 1}. ${img}`);
  });

  // Test the first found image
  console.log(`\nTesting first image: ${foundImages[0]}`);
  await testImage(foundImages[0]);

  // If you want to test a specific image, uncomment and modify this line:
  // await testImage('./path/to/your/specific/image.jpg');
}

main().catch(console.error);