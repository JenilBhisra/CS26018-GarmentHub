import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { processMarketDataset } from "@/lib/csv-parser";
import { NextResponse } from "next/server";
import { Readable } from "stream";
import path from "path";
import fs from "fs";
import busboy from "busboy";

export const maxDuration = 300; // Allow longer serverless timeout if configured

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized access. Admin only." }, { status: 401 });
  }

  // Create temporary directory outside public folder
  const tempDir = path.join(process.cwd(), "temp-uploads");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  try {
    const headersObj: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headersObj[key] = value;
    });

    const contentType = headersObj["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Invalid Content-Type. Must be multipart/form-data." }, { status: 400 });
    }

    const bb = busboy({
      headers: headersObj,
      limits: { fileSize: 500 * 1024 * 1024 } // 500MB safety limit
    });

    // Create the dataset record in PENDING first to get an ID
    const dataset = await prisma.marketDataset.create({
      data: {
        fileName: "uploading...",
        originalName: "uploading...",
        status: "PENDING",
        uploadedById: session.user.id,
        columns: []
      }
    });

    // Parse request body stream using Busboy
    const parseResult = await new Promise<{ tempPath: string; fileName: string; extension: string }>((resolve, reject) => {
      let tempPath = "";
      let originalName = "";
      let fileExt = "";
      let fileStreamError = false;
      let limitReached = false;

      bb.on("file", (name, fileStream, info) => {
        const { filename } = info;
        if (name !== "file") {
          fileStream.resume();
          return;
        }

        originalName = filename;
        fileExt = path.extname(filename).toLowerCase();

        if (![".csv", ".zip", ".gz", ".gzip"].includes(fileExt)) {
          fileStream.resume();
          reject(new Error("Invalid file format. Supported extensions: .csv, .zip, .gz, .gzip"));
          return;
        }

        tempPath = path.join(tempDir, `${dataset.id}${fileExt}`);
        const writeStream = fs.createWriteStream(tempPath);

        fileStream.pipe(writeStream);

        fileStream.on("limit", () => {
          limitReached = true;
          writeStream.destroy();
          if (fs.existsSync(tempPath)) {
            try { fs.unlinkSync(tempPath); } catch {}
          }
          reject(new Error("File size exceeds the allowed 500MB limit."));
        });

        fileStream.on("error", (err) => {
          fileStreamError = true;
          writeStream.destroy();
          if (fs.existsSync(tempPath)) {
            try { fs.unlinkSync(tempPath); } catch {}
          }
          reject(err);
        });

        writeStream.on("finish", () => {
          if (!limitReached && !fileStreamError) {
            resolve({ tempPath, fileName: originalName, extension: fileExt });
          }
        });

        writeStream.on("error", (err) => {
          reject(err);
        });
      });

      bb.on("error", (err) => {
        reject(err);
      });

      bb.on("finish", () => {
        setTimeout(() => {
          if (!tempPath) {
            reject(new Error("No file was found in the form data."));
          }
        }, 100);
      });

      if (!req.body) {
        reject(new Error("Request body is empty."));
        return;
      }

      const nodeStream = Readable.fromWeb(req.body as any);
      nodeStream.pipe(bb);
    }).catch(async (err) => {
      // If parsing failed, delete the db record we created
      await prisma.marketDataset.delete({
        where: { id: dataset.id }
      }).catch(() => null);
      throw err;
    });

    // Update dataset record with correct file info now that upload succeeded
    await prisma.marketDataset.update({
      where: { id: dataset.id },
      data: {
        fileName: `${dataset.id}${parseResult.extension}`,
        originalName: parseResult.fileName
      }
    });

    // TODO: move this background async processing to a BackgroundJob/worker before production
    // for serverless compatibility, as Vercel serverless functions will terminate soon after response.
    processMarketDataset(dataset.id, parseResult.tempPath).catch((err) => {
      console.error(`[Background Processing Error] Dataset ID ${dataset.id}:`, err);
    });

    return NextResponse.json({
      success: true,
      message: "Dataset uploaded successfully. Processing has started in the background.",
      dataset: {
        id: dataset.id,
        fileName: parseResult.fileName,
        status: "PENDING",
        createdAt: dataset.createdAt
      }
    });

  } catch (err: any) {
    console.error("Market dataset upload API error:", err);
    return NextResponse.json({ error: err.message || "Failed to process dataset upload." }, { status: 500 });
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized access. Admin only." }, { status: 401 });
  }

  try {
    const datasets = await prisma.marketDataset.findMany({
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({
      success: true,
      datasets: datasets.map(d => ({
        id: d.id,
        fileName: d.fileName,
        originalName: d.originalName,
        status: d.status,
        rowCount: d.rowCount,
        columns: d.columns,
        errorMessage: d.errorMessage,
        createdAt: d.createdAt.toISOString(),
        processedAt: d.processedAt ? d.processedAt.toISOString() : null
      }))
    });
  } catch (err: any) {
    console.error("Market dataset retrieve API error:", err);
    return NextResponse.json({ error: err.message || "Failed to retrieve datasets." }, { status: 505 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized access. Admin only." }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing dataset ID parameter." }, { status: 400 });
    }

    // Find dataset first to get file name
    const dataset = await prisma.marketDataset.findUnique({
      where: { id }
    });

    if (dataset) {
      // Physically delete saved file from disk
      const filePath = path.join(process.cwd(), "temp-uploads", dataset.fileName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error("Failed to physically delete file:", err);
        }
      }

      // Delete the dataset (cascade delete active insights/recs)
      await prisma.marketDataset.delete({
        where: { id }
      });
    }

    return NextResponse.json({
      success: true,
      message: "Dataset and associated insights deleted successfully."
    });
  } catch (err: any) {
    console.error("Market dataset delete API error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete dataset." }, { status: 500 });
  }
}
