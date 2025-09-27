function classifyByContext(normalizedAmounts, cleanedText, rawText) {
  if (typeof cleanedText !== 'string' || typeof rawText !== 'string') {
    throw new TypeError('cleanedText and rawText must be strings');
  }
  const segments = rawText.split(/[|\n]/).map(s => s.trim()).filter(s => s);
  console.log('Segments:', segments);

  const amounts = [];
  let matchCount = 0;

  normalizedAmounts.forEach((value) => {
    let segment = '';
    let source = '';
    const valueStr = value % 1 === 0 ? value.toString() : `${value}%`; // Handle percentages
    for (const seg of segments) {
      if (seg.includes(valueStr)) {
        segment = seg;
        source = `text: '${seg}'`;
        break;
      }
    }

    const label = segment.split(/[=:]/)[0]?.trim().toLowerCase() || '';
    console.log('Label for value', value, ':', label);

    let type = 'unknown';
    if (label.match(/total|amount|bill|final|grand|net/i)) type = 'total_bill';
    else if (label.match(/paid|payment|received/i)) type = 'paid';
    else if (label.match(/due|balance|remaining|owing/i)) type = 'due';
    else if (label.match(/tax|gst|vat|extra|surcharge|discount/i)) type = 'extra';
    else if (value === Math.max(...normalizedAmounts)) type = 'total_bill'; // Fallback

    if (type !== 'unknown') matchCount++;
    amounts.push({ type, value, source });
  });

  const confidence = normalizedAmounts.length > 0 ? Math.min(0.80, matchCount / normalizedAmounts.length) : 0; // Cap at 0.80
  return { amounts, confidence, error: null };
}

module.exports = { classifyByContext };