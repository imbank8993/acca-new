/**
 * Ensures a URL is absolute and correctly formatted.
 * Specifically fixes issues where protocol might have a single slash (e.g., https:/host)
 * or is missing entirely (e.g., host.com).
 */
export function ensureAbsoluteUrl(url: string | null | undefined): string {
    if (!url) return '';
    
    let sanitized = url.trim();
    
    // Fix https:/ (single slash) or http:/
    if (sanitized.startsWith('https:/') && !sanitized.startsWith('https://')) {
        sanitized = sanitized.replace('https:/', 'https://');
    } else if (sanitized.startsWith('http:/') && !sanitized.startsWith('http://')) {
        sanitized = sanitized.replace('http:/', 'http://');
    }
    
    // If it starts with file.icgowa.sch.id or any other domain without protocol
    if (!sanitized.includes('://')) {
        // If it looks like a domain (has dots and no spaces)
        if (/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+/.test(sanitized)) {
            sanitized = 'https://' + sanitized;
        }
    }
    
    return sanitized;
}
