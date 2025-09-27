function cleanText(text) {
  if (typeof text !== 'string') {
    return '';
  }
  return text
    .replace(/l/gi, '1')
    .replace(/O/gi, '0')
    .replace(/S/gi, '5')
    .replace(/B/gi, '8')
    .replace(/T0ta1/gi, 'Total')
    .replace(/Pa1d/gi, 'Paid')
    .replace(/pakient/gi, 'Patient');
}

function normalizeAmounts(rawTokens, rawText) {
  try {
    const cleanedText = cleanText(rawText || rawTokens.join(' '));
    if (!cleanedText) {
      throw new Error('No valid text provided for normalization');
    }
    // Match multiple formats: Total: Rs/$/€/£/₹ <number> | Paid: <number> | etc.
    const patterns = [
      /Total: (?:Rs|\$|€|£|₹)\s*(\d+\.?\d*) \| Paid: (\d+\.?\d*) \| Due: (\d+\.?\d*) \| Extra: (\d+\.?\d*)%/i,
      /(?:Total|Amount|Bill): (?:Rs|\$|€|£|₹)\s*(\d+\.?\d*)/i,
      /(?:Paid|Payment): (\d+\.?\d*)/i,
      /(?:Due|Balance): (\d+\.?\d*)/i,
      /(?:Extra|Tax|Surcharge): (\d+\.?\d*)%/i,
    ];

    let normalizedAmounts = [];
    let matched = false;

    // Try structured patterns
    for (const pattern of patterns) {
      const match = cleanedText.match(pattern);
      if (match) {
        matched = true;
        normalizedAmounts.push(
          ...match
            .slice(1)
            .filter((val) => val)
            .map((val) => (val.includes('%') ? parseFloat(val.replace('%', '')) : parseFloat(val)))
        );
      }
    }

    let normalizationConfidence = matched ? 0.9 : 0;

    if (!matched) {
      // Fallback: Normalize tokens
      normalizedAmounts = rawTokens
        .map((token) => {
          const cleaned = cleanText(token);
          if (cleaned.includes('%')) {
            const num = parseFloat(cleaned.replace('%', ''));
            return isNaN(num) ? null : num;
          }
          const num = parseFloat(cleaned.replace(/[^0-9.]/g, ''));
          return isNaN(num) ? null : num;
        })
        .filter((num) => num !== null);
      const tokenCount = rawTokens.length || 1;
      const noiseLevel = (cleanedText.match(/[^a-zA-Z0-9\s:|.]/g) || []).length / (cleanedText.length || 1);
      normalizationConfidence = normalizedAmounts.length > 0 ? Math.max(0.5, (normalizedAmounts.length / tokenCount) - noiseLevel) : 0.1;
    }

    return {
      normalized_amounts: normalizedAmounts,
      normalization_confidence: normalizationConfidence,
      cleaned_text: cleanedText,
      error: null,
    };
  } catch (err) {
    console.error('Normalization Error:', err);
    return {
      normalized_amounts: [],
      normalization_confidence: 0,
      cleaned_text: rawText || '',
      error: err.message,
    };
  }
}

module.exports = { normalizeAmounts };