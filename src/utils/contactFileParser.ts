import { PhoneContact } from "./contactSync";

/**
 * Parse vCard (.vcf) files - standard contact export format
 * Supports vCard 2.1, 3.0, and 4.0 formats
 */
export const parseVCardFile = async (file: File): Promise<PhoneContact[]> => {
  const text = await file.text();
  const contacts: PhoneContact[] = [];
  
  console.log('[vCard Parser] Parsing file:', file.name, 'Size:', file.size);
  
  // vCard format uses BEGIN:VCARD and END:VCARD blocks
  const vcardBlocks = text.split(/BEGIN:VCARD/i).filter(v => v.trim());
  
  console.log('[vCard Parser] Found', vcardBlocks.length, 'vCard blocks');
  
  for (const vcard of vcardBlocks) {
    // Extract FN (Formatted Name) - preferred
    let name = 'Unknown';
    const fnMatch = vcard.match(/^FN[;:](.*?)(?:\r?\n|\r)/im);
    if (fnMatch) {
      name = fnMatch[1].trim();
    } else {
      // Fall back to N (Name) field - format is Last;First;Middle;Prefix;Suffix
      const nMatch = vcard.match(/^N[;:](.*?)(?:\r?\n|\r)/im);
      if (nMatch) {
        const parts = nMatch[1].split(';');
        const lastName = parts[0]?.trim() || '';
        const firstName = parts[1]?.trim() || '';
        name = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';
      }
    }
    
    // Extract TEL (phone) fields - can have multiple per contact
    // Handles formats like TEL;TYPE=CELL:+1234567890 or TEL:+1234567890
    const telRegex = /^TEL[^:]*:(.*?)(?:\r?\n|\r)/gim;
    let telMatch;
    
    while ((telMatch = telRegex.exec(vcard)) !== null) {
      const phone = telMatch[1].trim().replace(/[^\d+]/g, '');
      if (phone && phone.length >= 7) {
        contacts.push({ name, phoneNumber: phone });
        console.log('[vCard Parser] Found contact:', name, phone);
      }
    }
  }
  
  console.log('[vCard Parser] Total contacts extracted:', contacts.length);
  return contacts;
};

/**
 * Parse CSV files with flexible column detection
 * Supports various column naming conventions
 */
export const parseCSVFile = async (file: File): Promise<PhoneContact[]> => {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  
  console.log('[CSV Parser] Parsing file:', file.name, 'Lines:', lines.length);
  
  if (lines.length < 2) {
    throw new Error('CSV file must have a header row and at least one data row');
  }
  
  // Parse header row - handle quoted fields
  const parseCSVRow = (row: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
  };
  
  const headers = parseCSVRow(lines[0]).map(h => h.toLowerCase());
  
  console.log('[CSV Parser] Headers found:', headers);
  
  // Find name column - try various common names
  const namePatterns = ['name', 'full name', 'fullname', 'display name', 'displayname', 'contact name', 'first name', 'given name'];
  let nameCol = -1;
  for (const pattern of namePatterns) {
    const idx = headers.findIndex(h => h.includes(pattern));
    if (idx !== -1) {
      nameCol = idx;
      break;
    }
  }
  
  // Find phone column - try various common names
  const phonePatterns = ['phone', 'tel', 'mobile', 'cell', 'number', 'phone number', 'mobile number', 'telephone'];
  let phoneCol = -1;
  for (const pattern of phonePatterns) {
    const idx = headers.findIndex(h => h.includes(pattern));
    if (idx !== -1) {
      phoneCol = idx;
      break;
    }
  }
  
  if (phoneCol === -1) {
    throw new Error('No phone column found. CSV must have a column containing "phone", "tel", "mobile", or "number" in the header.');
  }
  
  console.log('[CSV Parser] Using columns - Name:', nameCol, 'Phone:', phoneCol);
  
  const contacts: PhoneContact[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVRow(lines[i]);
    const name = nameCol >= 0 ? (cols[nameCol]?.trim() || 'Contact') : 'Contact';
    const phone = cols[phoneCol]?.trim().replace(/[^\d+]/g, '');
    
    if (phone && phone.length >= 7) {
      contacts.push({ name, phoneNumber: phone });
    }
  }
  
  console.log('[CSV Parser] Total contacts extracted:', contacts.length);
  return contacts;
};

/**
 * Generate vCard content from contacts for export
 */
export const generateVCardContent = (contacts: Array<{ name: string; phone: string }>): string => {
  let vcardContent = '';
  
  contacts.forEach(contact => {
    vcardContent += 'BEGIN:VCARD\n';
    vcardContent += 'VERSION:3.0\n';
    vcardContent += `FN:${contact.name}\n`;
    vcardContent += `TEL;TYPE=CELL:${contact.phone}\n`;
    vcardContent += 'END:VCARD\n';
  });
  
  return vcardContent;
};

/**
 * Download contacts as vCard file
 */
export const downloadContactsAsVCard = (contacts: Array<{ name: string; phone: string }>, filename: string = 'finmo-contacts.vcf') => {
  const vcardContent = generateVCardContent(contacts);
  const blob = new Blob([vcardContent], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
