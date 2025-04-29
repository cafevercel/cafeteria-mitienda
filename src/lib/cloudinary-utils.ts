// lib/cloudinary-utils.ts
export const getImageUrl = (publicId: string, options?: {
    width?: number;
    height?: number;
    quality?: number;
    format?: string;
}) => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    let transformations = '';

    if (options) {
        const { width, height, quality, format } = options;
        const transforms = [];

        if (width) transforms.push(`w_${width}`);
        if (height) transforms.push(`h_${height}`);
        if (quality) transforms.push(`q_${quality}`);
        if (format) transforms.push(`f_${format}`);

        if (transforms.length > 0) {
            transformations = transforms.join(',') + '/';
        }
    }

    return `https://res.cloudinary.com/${cloudName}/image/upload/${transformations}${publicId}`;
};
