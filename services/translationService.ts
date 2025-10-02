

export const flattenObjectKeys = (obj: any, prefix = ''): string[] => {
  return Object.keys(obj).reduce((acc: string[], key: string) => {
    const pre = prefix.length ? prefix + '.' : '';
    const newKey = pre + key;

    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      acc.push(...flattenObjectKeys(obj[key], newKey));
    } else {
      acc.push(newKey);
    }
    
    return acc;
  }, []);
};

export const getValueByPath = (obj: any, path: string): any => {
  try {
    return path.split('.').reduce((o, i) => o[i], obj);
  } catch (e) {
    return undefined;
  }
};

export const setValueByPath = (obj: any, path: string, value: any): any => {
  const keys = path.split('.');
  const newObj = JSON.parse(JSON.stringify(obj)); // Deep clone to avoid mutation
  let current = newObj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] === undefined || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {}; // Create nested objects if they don't exist
    }
    current = current[key];
  }

  current[keys[keys.length - 1]] = value;
  return newObj;
};

export const getLineNumber = (jsonData: Record<string, any>, keyPath: string): number | null => {
  if (!jsonData || !keyPath) return null;

  const jsonString = JSON.stringify(jsonData, null, 2);
  const lines = jsonString.split('\n');
  
  const keyParts = keyPath.split('.');
  const lastKey = keyParts[keyParts.length - 1];

  // Escape special regex characters in the key
  const escapedKey = lastKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // A regex to find the key definition, matching optional indentation and the quoted key.
  const regex = new RegExp(`^\\s*"${escapedKey}":`);
  
  const lineIndex = lines.findIndex(line => regex.test(line));
  
  return lineIndex !== -1 ? lineIndex + 1 : null;
};