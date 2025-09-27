require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function processImageWithPipeline(imagePath) {
  try {
    if (!fs.existsSync(imagePath)) {
      return {
        step1_ocr_extraction: {
          raw_tokens: [],
          currency_hint: "unknown",
          confidence: 0,
          raw_text: "",
          error: "Image file not found"
        },
        step2_normalization: {
          normalized_amounts: [],
          normalization_confidence: 0,
          cleaned_text: "",
          error: "No data to normalize"
        },
        step3_classification: {
          amounts: [],
          confidence: 0,
          error: "No amounts to classify"
        },
        step4_final_output: {
          currency: "unknown",
          amounts: [],
          status: "failed",
          error_reason: "Image file not found"
        }
      };
    }

    console.log(`\nProcessing: ${path.basename(imagePath)}`);
    
    const imageData = fs.readFileSync(imagePath);
    const base64Image = imageData.toString('base64');
    
    const model = genAI.getGenerativeModel({ model: 'gemini-pro-vision' });
    
    const prompt = `You are an OCR and financial document analysis system. Analyze this medical bill/receipt image and provide a detailed 4-step breakdown.

IMPORTANT: Return ONLY a valid JSON object with this EXACT structure:

{
  "step1_ocr_extraction": {
    "raw_tokens": ["1200", "1000", "200", "10%"],
    "currency_hint": "INR|USD|EUR|GBP|unknown",
    "confidence": 0.74,
    "raw_text": "exact text you can read from the image",
    "error": null
  },
  "step2_normalization": {
    "normalized_amounts": [1200, 1000, 200],
    "normalization_confidence": 0.82,
    "cleaned_text": "cleaned version of raw_text with OCR errors fixed",
    "error": null
  },
  "step3_classification": {
    "amounts": [
      {"type": "total_bill", "value": 1200},
      {"type": "paid", "value": 1000},
      {"type": "due", "value": 200}
    ],
    "confidence": 0.80,
    "error": null
  },
  "step4_final_output": {
    "currency": "INR",
    "amounts": [
      {"type": "total_bill", "value": 1200, "source": "text: 'Total: INR 1200'"},
      {"type": "paid", "value": 1000, "source": "text: 'Paid: 1000'"},
      {"type": "due", "value": 200, "source": "text: 'Due: 200'"}
    ],
    "status": "ok",
    "error_reason": null
  }
}

Rules:
1. Step 1: Extract ALL numbers that look like monetary amounts, percentages, or quantities. Include raw OCR text exactly as you see it.
2. Step 2: Convert raw tokens to clean numbers, fix common OCR errors (O->0, l->1, S->5, etc.)
3. Step 3: Classify each amount by context - types can be: total_bill, subtotal, paid, due, tax, discount, consultation_fee, medicine_cost, test_fee, extra
4. Step 4: Add source attribution and final status

If no amounts found, use empty arrays but maintain the structure.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: getImageMimeType(imagePath),
          data: base64Image
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();
    
    console.log('Raw Gemini Response:');
    console.log(text);
    
    // Extract and parse JSON
    try {
      // Look for JSON block
      let jsonText = text;
      
      // Remove markdown code blocks if present
      jsonText = jsonText.replace(/```json\s*|\s*```/g, '');
      jsonText = jsonText.replace(/```\s*|\s*```/g, '');
      
      // Find JSON object
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const parsedResult = JSON.parse(jsonMatch[0]);
      
      // Validate structure
      if (!parsedResult.step1_ocr_extraction || 
          !parsedResult.step2_normalization || 
          !parsedResult.step3_classification || 
          !parsedResult.step4_final_output) {
        throw new Error('Invalid JSON structure');
      }
      
      console.log('\n=== STRUCTURED PIPELINE OUTPUT ===');
      console.log(JSON.stringify(parsedResult, null, 2));
      
      return parsedResult;
      
    } catch (parseError) {
      console.log(`JSON Parse Error: ${parseError.message}`);
      
      // Fallback: create structured output from raw response
      const fallbackResult = createFallbackStructure(text, imagePath);
      console.log('\n=== FALLBACK STRUCTURED OUTPUT ===');
      console.log(JSON.stringify(fallbackResult, null, 2));
      
      return fallbackResult;
    }

  } catch (error) {
    console.error(`Error processing ${imagePath}: ${error.message}`);
    
    return {
      step1_ocr_extraction: {
        raw_tokens: [],
        currency_hint: "unknown",
        confidence: 0,
        raw_text: "",
        error: error.message
      },
      step2_normalization: {
        normalized_amounts: [],
        normalization_confidence: 0,
        cleaned_text: "",
        error: "OCR failed"
      },
      step3_classification: {
        amounts: [],
        confidence: 0,
        error: "No amounts to classify"
      },
      step4_final_output: {
        currency: "unknown",
        amounts: [],
        status: "failed",
        error_reason: error.message
      }
    };
  }
}

function createFallbackStructure(rawResponse, imagePath) {
  // Extract amounts from free-form response
  const amounts = [];
  const numberMatches = rawResponse.match(/\d+\.?\d*/g) || [];
  const currencyMatch = rawResponse.match(/INR|USD|EUR|GBP|\$|€|£|₹|Rs/i);
  
  const rawTokens = numberMatches.slice(0, 10); // Limit to reasonable amount
  const normalizedAmounts = rawTokens.map(token => parseFloat(token)).filter(num => !isNaN(num));
  
  // Basic classification
  normalizedAmounts.forEach((value, index) => {
    let type = 'unknown';
    if (index === 0 || value === Math.max(...normalizedAmounts)) {
      type = 'total_bill';
    } else if (value < 100) {
      type = 'tax';
    } else {
      type = 'consultation_fee';
    }
    
    amounts.push({
      type: type,
      value: value,
      source: `inferred from response`
    });
  });

  return {
    step1_ocr_extraction: {
      raw_tokens: rawTokens,
      currency_hint: currencyMatch ? currencyMatch[0] : "unknown",
      confidence: 0.5,
      raw_text: rawResponse.substring(0, 200) + "...",
      error: null
    },
    step2_normalization: {
      normalized_amounts: normalizedAmounts,
      normalization_confidence: 0.7,
      cleaned_text: rawResponse.substring(0, 200) + "...",
      error: null
    },
    step3_classification: {
      amounts: amounts.map(a => ({ type: a.type, value: a.value })),
      confidence: 0.6,
      error: null
    },
    step4_final_output: {
      currency: currencyMatch ? currencyMatch[0] : "unknown",
      amounts: amounts,
      status: amounts.length > 0 ? "ok" : "failed",
      error_reason: amounts.length === 0 ? "No amounts detected" : null
    }
  };
}

function getImageMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.bmp':
      return 'image/bmp';
    default:
      return 'image/jpeg';
  }
}

function findImageFiles() {
  const searchPaths = ['./uploads/', './Uploads/', '../sample/', './sample/'];
  const foundImages = [];

  for (const searchPath of searchPaths) {
    if (fs.existsSync(searchPath)) {
      try {
        const files = fs.readdirSync(searchPath);
        files.forEach(file => {
          if (/\.(jpg|jpeg|png|gif|bmp)$/i.test(file)) {
            foundImages.push(path.join(searchPath, file));
          }
        });
      } catch (error) {
        console.log(`Warning: Could not read ${searchPath}`);
      }
    }
  }

  // Remove duplicates
  return [...new Set(foundImages)];
}

async function main() {
  console.log('GEMINI 4-STEP MEDICAL AMOUNT DETECTION PIPELINE\n');

  if (!process.env.GEMINI_API_KEY) {
    console.error('ERROR: GEMINI_API_KEY not found in .env file');
    return;
  }

  const imageFiles = findImageFiles();
  
  if (imageFiles.length === 0) {
    console.log('No image files found');
    return;
  }

  console.log(`Found ${imageFiles.length} images to process\n`);

  // Process first 3 images as examples
  const testCount = Math.min(3, imageFiles.length);
  
  for (let i = 0; i < testCount; i++) {
    const imagePath = imageFiles[i];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`PROCESSING IMAGE ${i + 1}/${testCount}: ${path.basename(imagePath)}`);
    console.log('='.repeat(80));
    
    const result = await processImageWithPipeline(imagePath);
    
    // Show summary
    const step4 = result.step4_final_output;
    console.log(`\nSUMMARY: ${step4.status.toUpperCase()}`);
    console.log(`Currency: ${step4.currency}`);
    console.log(`Amounts found: ${step4.amounts?.length || 0}`);
    
    if (step4.amounts && step4.amounts.length > 0) {
      step4.amounts.forEach((amt, idx) => {
        console.log(`  ${idx + 1}. ${amt.value} (${amt.type})`);
      });
    }
    
    // Wait between requests
    if (i < testCount - 1) {
      console.log('\nWaiting 3 seconds before next image...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.log('\nProcessing complete! Use this format in your actual pipeline.');
}

main().catch(console.error);