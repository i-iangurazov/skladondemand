declare module 'pdf-parse' {
  type PdfParseOptions = {
    pagerender?: (pageData: unknown) => Promise<string> | string;
  };

  type PdfParseResult = {
    numpages?: number;
    numrender?: number;
    info?: unknown;
    metadata?: unknown;
    text: string;
    version?: string;
  };

  export default function pdfParse(
    dataBuffer: Buffer,
    options?: PdfParseOptions
  ): Promise<PdfParseResult>;
}
