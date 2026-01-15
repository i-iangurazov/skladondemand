import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const requireEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is not set`);
  }
  return value;
};

export const uploadToStorage = async (params: {
  key: string;
  body: Buffer;
  contentType: string;
}) => {
  const endpoint = requireEnv('S3_ENDPOINT');
  const bucket = requireEnv('S3_BUCKET');
  const accessKeyId = requireEnv('S3_ACCESS_KEY_ID');
  const secretAccessKey = requireEnv('S3_SECRET_ACCESS_KEY');

  const client = new S3Client({
    region: process.env.S3_REGION ?? 'auto',
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: params.key,
    Body: params.body,
    ContentType: params.contentType,
  });

  await client.send(command);

  const publicBase = requireEnv('S3_PUBLIC_BASE_URL').replace(/\/$/, '');
  return `${publicBase}/${params.key}`;
};
