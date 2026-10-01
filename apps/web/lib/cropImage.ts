export const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image()
        image.addEventListener('load', () => resolve(image))
        image.addEventListener('error', (error) => reject(error))
        image.setAttribute('crossOrigin', 'anonymous') // needed to avoid cross-origin issues
        image.src = url
    })

export function getRadianAngle(degreeValue: number) {
    return (degreeValue * Math.PI) / 180
}

/**
 * Returns the rotated box size of a rectangle.
 */
export function rotateSize(width: number, height: number, rotation: number) {
    const rotRad = getRadianAngle(rotation)

    return {
        width:
            Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
        height:
            Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
    }
}

/**
 * This function crops an image, optionally resizes it to maxDimension,
 * and converts it to WebP format for optimal file size and high quality.
 */
export default async function getCroppedImg(
    imageSrc: string,
    pixelCrop: { x: number; y: number; width: number; height: number },
    rotation = 0,
    flip = { horizontal: false, vertical: false },
    outputFormat = 'image/webp',
    quality = 0.85,
    maxDimension = 800
): Promise<Blob | null> {
    const image = await createImage(imageSrc)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
        return null
    }

    const rotRad = getRadianAngle(rotation)

    // calculate bounding box of the rotated image
    const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
        image.width,
        image.height,
        rotation
    )

    // set canvas size to match the bounding box
    canvas.width = bBoxWidth
    canvas.height = bBoxHeight

    // translate canvas context to a central point to allow rotating and flipping around the center
    ctx.translate(bBoxWidth / 2, bBoxHeight / 2)
    ctx.rotate(rotRad)
    ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1)
    ctx.translate(-image.width / 2, -image.height / 2)

    // draw rotated image
    ctx.drawImage(image, 0, 0)

    // croppedAreaPixels values are bounding box relative
    // extract the cropped image using these values
    const data = ctx.getImageData(
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height
    )

    // set canvas width to final desired crop size - also clears canvas
    canvas.width = pixelCrop.width
    canvas.height = pixelCrop.height

    // paste generated rotate image with correct offsets for x,y crop values.
    ctx.putImageData(data, 0, 0)

    // Smoothly scale down if cropped area exceeds maxDimension (crystal clear avatar, small size)
    let finalCanvas = canvas
    if (maxDimension > 0 && (pixelCrop.width > maxDimension || pixelCrop.height > maxDimension)) {
        const ratio = Math.min(maxDimension / pixelCrop.width, maxDimension / pixelCrop.height)
        const targetWidth = Math.max(1, Math.round(pixelCrop.width * ratio))
        const targetHeight = Math.max(1, Math.round(pixelCrop.height * ratio))

        const resizeCanvas = document.createElement('canvas')
        resizeCanvas.width = targetWidth
        resizeCanvas.height = targetHeight
        const resizeCtx = resizeCanvas.getContext('2d')
        if (resizeCtx) {
            resizeCtx.imageSmoothingEnabled = true
            resizeCtx.imageSmoothingQuality = 'high'
            resizeCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight)
            finalCanvas = resizeCanvas
        }
    }

    // Convert to WebP blob (fallback to JPEG if webp export is unsupported by browser)
    return new Promise((resolve) => {
        finalCanvas.toBlob((blob) => {
            if (blob) {
                resolve(blob)
            } else {
                finalCanvas.toBlob((fallbackBlob) => {
                    resolve(fallbackBlob)
                }, 'image/jpeg', quality)
            }
        }, outputFormat, quality)
    })
}

/**
 * Konversi berkas gambar apapun ke format WebP terkompresi dengan resolusi optimal.
 */
export async function convertFileToWebp(file: File, maxDimension = 800, quality = 0.85): Promise<File> {
    if (typeof window === 'undefined' || typeof document === 'undefined') return file
    return new Promise((resolve) => {
        const img = new Image()
        const objectUrl = URL.createObjectURL(file)
        img.onload = () => {
            URL.revokeObjectURL(objectUrl)
            let { width, height } = img
            if (maxDimension > 0 && (width > maxDimension || height > maxDimension)) {
                const ratio = Math.min(maxDimension / width, maxDimension / height)
                width = Math.max(1, Math.round(width * ratio))
                height = Math.max(1, Math.round(height * ratio))
            }
            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')
            if (!ctx) {
                resolve(file)
                return
            }
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'high'
            ctx.drawImage(img, 0, 0, width, height)
            canvas.toBlob((blob) => {
                if (blob) {
                    const baseName = file.name.replace(/\.[^/.]+$/, '')
                    resolve(new File([blob], `${baseName}.webp`, { type: 'image/webp' }))
                } else {
                    resolve(file)
                }
            }, 'image/webp', quality)
        }
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl)
            resolve(file)
        }
        img.src = objectUrl
    })
}
