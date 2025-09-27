# 🧾 AI-Powered Amount Detection in Medical Documents

This project is an **AI-driven OCR pipeline** that extracts and classifies **monetary amounts** from medical documents such as prescriptions, invoices, and bills.  
It supports **both text and image inputs**, performs **OCR extraction**, **normalization**, and **classification**, and exposes a clean **REST API** built with **Node.js + Express**.

---

## 📌 Project Workflow

The system follows a **3-stage workflow**:

1. **OCR Extraction**  
   - Input: Raw text (JSON) or an image (JPG/PNG/PDF).  
   - Uses **Tesseract.js** to extract raw text from input.  
   - For images: preprocessed using **Sharp** (resize, grayscale, denoise).  

2. **Normalization**  
   - Cleans extracted text.  
   - Detects Indian & Western number formats (`Rs. 1,23,456.78 → 123456.78`).  
   - Removes noise like extra commas, special characters.  
   - Ensures consistent numeric + currency representation.  

3. **Classification**  
   - Identifies whether the amount is **Total, Subtotal, Paid, Balance, etc.**  
   - Uses `string-similarity` and `compromise` NLP for context analysis.  
   - Assigns **confidence scores** to each candidate.  

4. **API Response**  
   - Returns structured JSON with:  
     - `raw_text` (from OCR)  
     - `amounts` (value, currency, label, confidence, optional bounding box)  
     - `errors` (if any, like low confidence, bad input, unsupported file)  

---

## 🏗️ Architecture
{
  "step1_ocr_extraction": {
    "raw_tokens": ["99.99", "8.50", "108.49"],
    "currency_hint": "USD",
    "confidence": 0.85,
    "raw_text": "Subtotal: 99.99 Tax: 8.50 Total: 108.49",
    "error": null
  },
  "step2_normalization": {
    "normalized_amounts": [99.99, 8.50, 108.49],
    "normalization_confidence": 0.95,
    "cleaned_text": "Subtotal: 99.99 Tax: 8.50 Total: 108.49",
    "error": null
  },
  "step3_classification": {
    "amounts": [
      {"type": "subtotal", "value": 99.99},
      {"type": "tax", "value": 8.50},
      {"type": "total_bill", "value": 108.49}
    ],
    "confidence": 0.90,
    "error": null
  },
  "step4_final_output": {
    "currency": "USD",
    "amounts": [
      {"type": "subtotal", "value": 99.99, "source": "text: 'Subtotal: 99.99'"},
      {"type": "tax", "value": 8.50, "source": "text: 'Tax: 8.50'"},
      {"type": "total_bill", "value": 108.49, "source": "text: 'Total: 108.49'"}
    ],
    "status": "ok",
    "error_reason": null
  }
}
