-- Add CloudShop Excel import source type (safe for fresh DBs)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ImportSourceType') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'ImportSourceType' AND e.enumlabel = 'CLOUDSHOP_XLSX'
    ) THEN
      ALTER TYPE "ImportSourceType" ADD VALUE 'CLOUDSHOP_XLSX';
    END IF;
  END IF;
END $$;
