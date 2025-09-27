function classifyByContext(normalizedAmounts, cleanedText, rawText) {
  if (typeof cleanedText !== 'string' || typeof rawText !== 'string') {
    throw new TypeError('cleanedText and rawText must be strings');
  }
  
  // Enhanced text processing for medical documents
  const segments = [];
  
  // Split by various delimiters common in medical bills
  const splitSegments = rawText.split(/[|\n\r\t]/).map(s => s.trim()).filter(s => s);
  segments.push(...splitSegments);
  
  // If no segments from splitting, use the full text
  if (segments.length === 0) {
    segments.push(rawText.trim());
  }
  
  // Also process cleaned text if different
  if (cleanedText.trim() && cleanedText !== rawText) {
    const cleanedSegments = cleanedText.split(/[|\n\r\t]/).map(s => s.trim()).filter(s => s);
    segments.push(...cleanedSegments);
    if (cleanedSegments.length === 0) {
      segments.push(cleanedText.trim());
    }
  }
  
  // Remove duplicates
  const uniqueSegments = [...new Set(segments)];
  console.log('Processing segments:', uniqueSegments);

  const amounts = [];
  let matchCount = 0;

  normalizedAmounts.forEach((value, index) => {
    let bestMatch = null;
    let bestScore = 0;
    
    const valueStr = value % 1 === 0 ? value.toString() : value.toFixed(2);
    const valueRegex = new RegExp(`\\b${valueStr}\\b`, 'i');
    
    // Find the best matching segment
    for (const segment of uniqueSegments) {
      if (valueRegex.test(segment)) {
        const score = calculateMatchScore(segment, value, normalizedAmounts);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = segment;
        }
      }
    }
    
    let type = 'unknown';
    let confidence = 0;
    let source = bestMatch ? `text: '${bestMatch}'` : `inferred from context`;
    
    if (bestMatch) {
      const result = classifyMedicalAmount(bestMatch, value, normalizedAmounts, index);
      type = result.type;
      confidence = result.confidence;
    } else {
      // Fallback classification without direct text match
      const fallbackResult = fallbackClassification(value, normalizedAmounts, index);
      type = fallbackResult.type;
      confidence = fallbackResult.confidence;
    }
    
    console.log(`Amount ${value}: classified as '${type}' with confidence ${confidence}`);
    
    if (type !== 'unknown') matchCount++;
    amounts.push({ type, value, source });
  });

  const overallConfidence = normalizedAmounts.length > 0 ? 
    Math.min(0.95, (matchCount / normalizedAmounts.length) * 0.8 + 0.2) : 0;
  
  return { amounts, confidence: overallConfidence, error: null };
}

function calculateMatchScore(segment, value, allAmounts) {
  let score = 1; // Base score for finding the value
  
  // Boost score for medical billing keywords
  const medicalKeywords = /consultation|doctor|treatment|medicine|prescription|hospital|clinic|fee|charge|bill|invoice|medical|health/i;
  if (medicalKeywords.test(segment)) score += 0.5;
  
  // Boost for financial keywords
  const financialKeywords = /total|amount|paid|due|balance|cost|price|fee|charge/i;
  if (financialKeywords.test(segment)) score += 0.3;
  
  return score;
}

function classifyMedicalAmount(segment, value, allAmounts, index) {
  const lowerSegment = segment.toLowerCase();
  
  // Medical-specific classification patterns
  const patterns = {
    total_bill: /total|grand total|invoice total|bill total|final amount|net amount|amount due|total amount|total cost|total fee|invoice amount/i,
    consultation_fee: /consultation|doctor fee|visit fee|appointment|consultation charge/i,
    medicine_cost: /medicine|medication|prescription|drug|pharmacy|tablet|capsule/i,
    test_fee: /test|lab|laboratory|scan|x-ray|blood test|diagnostic|investigation/i,
    procedure_fee: /procedure|surgery|operation|treatment|therapy/i,
    paid: /paid|payment made|amount paid|payment received|settled/i,
    due: /due|balance|outstanding|remaining|pending|payable/i,
    discount: /discount|reduction|offer|concession|rebate/i,
    tax: /tax|gst|vat|service tax|cgst|sgst|igst/i,
    extra: /extra|additional|miscellaneous|other charges|surcharge/i
  };
  
  // Check each pattern
  for (const [type, pattern] of Object.entries(patterns)) {
    if (pattern.test(lowerSegment)) {
      return { type, confidence: 0.9 };
    }
  }
  
  // Context-based classification
  if (lowerSegment.includes('total') || lowerSegment.includes('invoice') || lowerSegment.includes('bill')) {
    return { type: 'total_bill', confidence: 0.8 };
  }
  
  // If it's the largest amount and no specific classification found
  if (value === Math.max(...allAmounts)) {
    return { type: 'total_bill', confidence: 0.6 };
  }
  
  return { type: 'unknown', confidence: 0.1 };
}

function fallbackClassification(value, allAmounts, index) {
  // Single amount - likely total bill
  if (allAmounts.length === 1) {
    return { type: 'total_bill', confidence: 0.7 };
  }
  
  // Multiple amounts - use position and value analysis
  const maxAmount = Math.max(...allAmounts);
  const minAmount = Math.min(...allAmounts);
  
  if (value === maxAmount) {
    return { type: 'total_bill', confidence: 0.6 };
  } else if (value === minAmount && allAmounts.length > 2) {
    return { type: 'extra', confidence: 0.4 }; // Could be tax or small fee
  } else {
    return { type: 'consultation_fee', confidence: 0.3 }; // Middle amounts often consultation fees
  }
}

module.exports = { classifyByContext };