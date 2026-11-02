// Captura e preparo da imagem antes do envio: redimensiona e comprime no
// próprio aparelho para reduzir custo, tempo de envio e dados trafegados.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { MAX_IMAGE_BYTES } from '@shared/schemas';

import { AppError } from './api';

const MAX_DIMENSION = 1280;
const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
}

export interface PreparedImage {
  uri: string;
  base64: string;
  mimeType: 'image/jpeg';
  bytes: number;
}

export type PickSource = 'camera' | 'library';

export async function pickImage(source: PickSource): Promise<PickedImage | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      throw new AppError(
        'bad_request',
        perm.canAskAgain
          ? 'Precisamos da câmera para fotografar seus ingredientes.'
          : 'A câmera está bloqueada. Libere o acesso nas configurações do aparelho ou escolha uma foto da galeria.',
      );
    }
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 0.9, allowsEditing: false };
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  if (asset.type && asset.type !== 'image') {
    throw new AppError('unsupported_media_type', 'Escolha uma foto (vídeos não são aceitos).');
  }
  if (asset.mimeType && !ACCEPTED.includes(asset.mimeType.toLowerCase())) {
    throw new AppError('unsupported_media_type', 'Formato de imagem não suportado. Use JPG, PNG ou HEIC.');
  }
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

export async function prepareImage(image: PickedImage): Promise<PreparedImage> {
  const ctx = ImageManipulator.manipulate(image.uri);
  const longest = Math.max(image.width, image.height);
  if (longest > MAX_DIMENSION) {
    ctx.resize(image.width >= image.height ? { width: MAX_DIMENSION } : { height: MAX_DIMENSION });
  }
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.72, base64: true });
  if (!saved.base64) throw new AppError('internal', 'Não foi possível processar a imagem.');
  const bytes = Math.floor((saved.base64.length * 3) / 4);
  if (bytes > MAX_IMAGE_BYTES) {
    throw new AppError('payload_too_large', 'A imagem ficou grande demais. Tente outra foto.');
  }
  return { uri: saved.uri, base64: saved.base64, mimeType: 'image/jpeg', bytes };
}
