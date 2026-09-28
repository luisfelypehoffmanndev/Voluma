import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { centerSquare } from '@/sync/avatar';

/** Lado da foto salva: o maior avatar do app (72dp) em tela 3x, com folga. */
const SIDE = 256;
const QUALITY = 0.8;

/**
 * Escolhe uma foto da galeria e devolve o JPEG pronto para subir, ou `null`
 * se a pessoa desistiu.
 *
 * O seletor e o do sistema: no Android 13+ ele nao pede permissao nenhuma — o
 * app so recebe a foto escolhida, nunca a galeria inteira.
 *
 * A foto SEMPRE passa pelo manipulador, mesmo ja quadrada: reencodar e o que
 * tira o EXIF, e o EXIF de uma foto de celular carrega o GPS de onde ela foi
 * tirada. Subir o arquivo original mostraria aos amigos onde a pessoa mora.
 */
export async function pickAvatar(): Promise<Uint8Array | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  // O recorte do seletor e so uma sugestao: no iOS ele nem sempre sai exato, e
  // o `aspect` e ignorado la. O quadrado central garante o formato.
  context.crop(centerSquare(asset.width, asset.height));
  context.resize({ width: SIDE, height: SIDE });

  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: QUALITY, base64: true });
  if (!saved.base64) throw new Error('Não foi possível preparar a foto');

  return fromBase64(saved.base64);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
