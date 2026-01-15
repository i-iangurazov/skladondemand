'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ImportProducts from '@/components/admin/ImportProducts';
import ImportImages from '@/components/admin/ImportImages';

type Props = {
  initialDriveFolderId?: string;
};

export default function ImportArea({ initialDriveFolderId }: Props) {
  return (
    <div className="min-h-screen bg-white text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Import</h1>
          <p className="text-sm text-muted-foreground">
            Manage product and image imports from a single workspace.
          </p>
        </div>

        <Tabs defaultValue="products" className="gap-4">
          <TabsList>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
          </TabsList>
          <TabsContent value="products">
            <ImportProducts />
          </TabsContent>
          <TabsContent value="images">
            <ImportImages initialFolderId={initialDriveFolderId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
