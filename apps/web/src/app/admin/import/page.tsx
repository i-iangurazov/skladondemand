import ImportArea from '@/components/admin/ImportArea';

export default async function ImportPage() {
  const driveFolderId = process.env.DRIVE_IMAGES_FOLDER_ID ?? '';
  return <ImportArea initialDriveFolderId={driveFolderId} />;
}
