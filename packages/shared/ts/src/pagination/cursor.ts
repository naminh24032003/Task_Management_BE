export interface CursorData {
  id: string;
  value: string;
}

/**
 * Encodes a document ID and sort field value into a base64 cursor string
 */
export function encodeCursor(id: string, sortValue: string): string {
  const data: CursorData = { id, value: sortValue };
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

/**
 * Decodes a base64 cursor string back into document ID and sort field value
 */
export function decodeCursor(cursor: string): CursorData {
  if (!cursor) {
    throw new Error('Empty cursor');
  }

  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf-8');
    const data: CursorData = JSON.parse(json);

    if (!data.id) {
      throw new Error('Cursor missing document ID');
    }

    return data;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid cursor data');
    }
    throw error;
  }
}
