// components/ImageUpload.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import { Upload } from 'lucide-react';
import Image from 'next/image';

interface ImageUploadProps {
    onChange: (value: string) => void;
    value: string;
    disabled?: boolean;
}

export const ImageUpload = ({
    onChange,
    value,
    disabled
}: ImageUploadProps) => {
    const [loading, setLoading] = useState(false);
    const [currentValue, setCurrentValue] = useState(value);
    const [isUploading, setIsUploading] = useState(false);

    // Efecto para sincronizar el valor interno con el prop value
    useEffect(() => {
        console.log('ImageUpload - value prop actualizado:', value);
        setCurrentValue(value);
    }, [value]);

    const handleImageChange = useCallback((url: string) => {
        console.log('ImageUpload - Nueva URL generada:', url);
        setCurrentValue(url);
        onChange(url);
    }, [onChange]);

    const onDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();

        try {
            const file = e.dataTransfer.files[0];
            await uploadImage(file);
        } catch (error) {
            console.error('Error en onDrop:', error);
        }
    }, []);

    const onChooseFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            await uploadImage(e.target.files[0]);
        }
    }, []);

    const uploadImage = async (file: File) => {
        try {
            setIsUploading(true);
            setLoading(true);
            console.log('ImageUpload - Iniciando carga de imagen');

            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            console.log('ImageUpload - Respuesta del servidor:', data);

            if (!response.ok) {
                throw new Error(data.error || 'Error al subir la imagen');
            }

            console.log('ImageUpload - URL de imagen recibida:', data.url);
            handleImageChange(data.url);
        } catch (error) {
            console.error('Error al subir imagen:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4 w-full flex flex-col items-center justify-center">
            <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                className={`
                    relative 
                    w-full 
                    min-h-[200px]
                    flex 
                    flex-col 
                    items-center 
                    justify-center 
                    rounded-lg 
                    border-2 
                    border-dashed
                    gap-4
                    hover:opacity-75
                    transition
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    ${loading ? 'opacity-50' : ''}
                `}
            >
                <input
                    type="file"
                    accept="image/*"
                    onChange={onChooseFile}
                    disabled={disabled || loading}
                    className="hidden"
                    id="image"
                />
                <label
                    htmlFor="image"
                    className="w-full h-full flex flex-col items-center justify-center cursor-pointer"
                >
                    {currentValue ? (
                        <div className="relative w-full h-[200px]">
                            <Image
                                src={currentValue}
                                alt="Upload"
                                fill
                                style={{ objectFit: 'cover' }}
                                className="rounded-lg"
                                sizes="(max-width: 200px) 100vw, 200px"
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-2">
                            <Upload className="h-10 w-10" />
                            <div className="text-sm text-gray-600">
                                Arrastra una imagen o haz click aquí
                            </div>
                        </div>
                    )}
                </label>
            </div>
        </div>
    );
};
