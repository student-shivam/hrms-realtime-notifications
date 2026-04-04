const crypto = require('crypto');

const algorithm = 'aes-256-cbc';
const secret = process.env.DOCUMENT_METADATA_SECRET || process.env.JWT_SECRET || 'hrms-document-metadata-secret';
const key = crypto.createHash('sha256').update(secret).digest();

exports.encryptText = (value) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
};

exports.decryptText = (value) => {
  if (!value) return '';
  const [ivHex, encryptedHex] = String(value).split(':');
  if (!ivHex || !encryptedHex) return '';

  const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(ivHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
};
