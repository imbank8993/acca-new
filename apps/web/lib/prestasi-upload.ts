export async function validatePrestasiUpload(file: File): Promise<boolean> {
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) return false;
    const ext = file.name.toLowerCase().split('.').pop();
    const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    if (ext === 'pdf') return new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-';
    if (ext === 'png') return [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
    if (ext === 'jpg' || ext === 'jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    return false;
}
