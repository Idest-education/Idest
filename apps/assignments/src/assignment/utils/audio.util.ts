export function concatenateAudioFiles(
  audioFiles: Express.Multer.File[],
): { buffer: Buffer; mimetype: string; filename: string } {
  const validFiles = audioFiles.filter(file => file !== undefined);
  
  if (validFiles.length === 0) {
    throw new Error('No audio files provided for concatenation');
  }

  const buffers = validFiles.map(file => file.buffer);
  const combinedBuffer = Buffer.concat(buffers);

  const mimetype = validFiles[0].mimetype;
  
  const extension = validFiles[0].originalname.split('.').pop() || 'audio';
  const filename = `combined.${extension}`;

  return {
    buffer: combinedBuffer,
    mimetype,
    filename,
  };
}

export function getExtensionFromMimetype(mimetype: string): string {
  const mimetypeMap: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/wave': 'wav',
    'audio/x-wav': 'wav',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/aac': 'aac',
    'audio/flac': 'flac',
  };
  
  return mimetypeMap[mimetype] || 'audio';
}

