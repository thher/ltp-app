import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { pickImageFromGallery, pickImageFromCamera } from '../services/imageService';

export function useImagePicker() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [pickingImage, setPickingImage] = useState(false);

  const pickFromGallery = useCallback(async () => {
    setPickingImage(true);
    try {
      const uri = await pickImageFromGallery();
      if (uri) setSelectedImage(uri);
      return uri;
    } finally {
      setPickingImage(false);
    }
  }, []);

  const pickFromCamera = useCallback(async () => {
    setPickingImage(true);
    try {
      const uri = await pickImageFromCamera();
      if (uri) setSelectedImage(uri);
      return uri;
    } finally {
      setPickingImage(false);
    }
  }, []);

  const clearImage = useCallback(() => {
    setSelectedImage(null);
  }, []);

  return {
    selectedImage,
    pickingImage,
    pickFromGallery,
    pickFromCamera,
    clearImage,
    setSelectedImage,
  };
}
