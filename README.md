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

