// Client Cloudflare R2 (API S3) — upload des vidéos lourdes du BO.
//
// Config via variables d'environnement (fichier /etc/lesgriotsxstudio-backoffice.env
// sur le VPS, chargé par systemd — cf. docs/SECRETS.md) :
//   R2_ACCOUNT_ID        → endpoint https://<id>.r2.cloudflarestorage.com
//   R2_ACCESS_KEY_ID     → token R2 "Object Read & Write" sur le bucket
//   R2_SECRET_ACCESS_KEY
//   R2_BUCKET            → lesgriots-media
//   R2_PUBLIC_BASE       → https://media.lesgriotsxstudio.com (custom domain)
//   R2_MIN_UPLOAD_MB     → seuil : vidéos plus grosses → R2 (défaut 10 Mo)
//
// Si ces variables sont absentes (dev local par ex.), r2Enabled() renvoie
// false et l'upload retombe sur le disque local — zéro régression.
//
// Multipart automatique via @aws-sdk/lib-storage (parts de 10 Mo, 3 en
// parallèle) → les fichiers de plusieurs Go passent sans tenir en RAM
// côté envoi et avec reprise interne par part.
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { createReadStream } from "fs";

export function r2Enabled() {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET &&
    process.env.R2_PUBLIC_BASE
  );
}

export function r2MinBytes() {
  return (Number(process.env.R2_MIN_UPLOAD_MB) || 10) * 1024 * 1024;
}

function publicUrl(key) {
  return `${process.env.R2_PUBLIC_BASE.replace(/\/+$/, "")}/${key}`;
}

let _client = null;
function client() {
  if (!_client) {
    _client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return _client;
}

async function doUpload(key, body, contentType) {
  const up = new Upload({
    client: client(),
    params: {
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      // Cache long : les noms de fichiers sont uniques (slug + timestamp).
      CacheControl: "public, max-age=31536000, immutable",
    },
    queueSize: 3,
    partSize: 10 * 1024 * 1024,
  });
  await up.done();
  return publicUrl(key);
}

// Upload d'un Buffer déjà en mémoire (cas : fichier reçu, pas de conversion).
export async function r2UploadBuffer(key, buffer, contentType) {
  return doUpload(key, buffer, contentType);
}

// Upload d'un fichier local en streaming (cas : après conversion ffmpeg).
export async function r2UploadFile(key, filePath, contentType) {
  return doUpload(key, createReadStream(filePath), contentType);
}

export function videoContentType(name) {
  if (/\.webm$/i.test(name)) return "video/webm";
  return "video/mp4";
}
