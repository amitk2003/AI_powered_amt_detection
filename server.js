const express = require('express');
const multer = require('multer');
const path = require('path');
const { extractTextFromImage } = require('./services/ocrService.js');
const { normalizeAmounts } = require('./services/normalization.js');
const { classifyByContext } = require('./services/classification.js');

const app = express();
const upload = multer({ dest: path.join(__dirname, 'Uploads') });

app.use(express.json());

app.post('/endpoint', upload.single('image'), async (req, res) => {
  try {
    const text = req.body.text || '';
    const file = req.file;

    if (!file && !text) {
      throw new Error('No file or text provided');
    }
    if (text && text.length < 5) {
      throw new Error('Text input too short');
    }

    let ocrResult = { raw_tokens: [], raw_text: text, currency_hint: 'unknown', confidence: 0 };
    let filePath = '';

    if (file) {
      filePath = path.join(__dirname, 'Uploads', file.filename);
      ocrResult = await extractTextFromImage(filePath);
    } else if (text) {
      ocrResult = await extractTextFromImage(null, text);
    }

    console.log('OCR Result:', ocrResult);
    const normResult = normalizeAmounts(ocrResult.raw_tokens, ocrResult.raw_text || text);
    console.log('Normalization Result:', normResult);
    const classResult = classifyByContext(normResult.normalized_amounts, normResult.cleaned_text);
    console.log('Classification Result:', classResult);

    const currencyRegex = /Rs|\$|€|£|₹|¥|₣|₽|A\$|C\$|HK\$|S\$|₩|R\$|kr|USD|EUR|GBP|INR|JPY|CAD|AUD|CHF|RUB|SGD|HKD|BRL|KRW/gi;
    const currencyMatches = (ocrResult.raw_text.match(currencyRegex) || []).filter((c, i, arr) => arr.indexOf(c) === i);
    const currency = currencyMatches.length === 1 ? currencyMatches[0] : (currencyMatches.length > 1 ? currencyMatches[0] : ocrResult.currency_hint);

    const finalOutput = {
      currency,
      amounts: classResult.amounts,
      status: classResult.confidence > 0.5 || normResult.normalization_confidence > 0.7 ? 'ok' : 'failed',
      error_reason: classResult.error || normResult.error || ocrResult.error || (currencyMatches.length > 1 ? 'Multiple currencies detected, selected first: ' + currency : null),
    };

    res.json({
      step1_ocr_extraction: ocrResult,
      step2_normalization: normResult,
      step3_classification: classResult,
      step4_final_output: finalOutput,
    });
  } catch (err) {
    console.error('Server Error:', err);
    res.status(500).json({
      error: err.message,
      step4_final_output: { status: 'failed', error_reason: err.message },
    });
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));