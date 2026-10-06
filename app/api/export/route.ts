import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { getReportData } from "@/actions/analytics";
import { Role } from "@prisma/client";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  try {
    // 1. Session verification
    const session = await auth();
    if (!session?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized: Please log in." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const role = session.user.role;

    // 2. Parse query parameters
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "sales";
    const filter = searchParams.get("filter") || "30days";
    const start = searchParams.get("start") || undefined;
    const end = searchParams.get("end") || undefined;
    const format = searchParams.get("format") || "csv";

    // 3. Extra security boundaries by role
    const isSeller = role === Role.SELLER;
    const isB2B = role === Role.B2B_VENDOR;
    const isCustomer = role === Role.CUSTOMER;

    if (isCustomer && type !== "sales") {
      return new Response(JSON.stringify({ error: "Forbidden: Access denied." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (isB2B && type !== "sales" && type !== "rfq") {
      return new Response(JSON.stringify({ error: "Forbidden: Access denied." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (isSeller && !["sales", "product", "inventory", "seller_ledger", "payout_report", "transaction_history"].includes(type)) {
      return new Response(JSON.stringify({ error: "Forbidden: Access denied." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 4. Fetch the report data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reportData = (await getReportData(type, filter, start, end)) as any[];

    if (reportData.length === 0) {
      // Return empty report structure
      reportData.push({ "No Data": "No records found matching filters." });
    }

    // 5. Generate sheet using SheetJS
    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const filename = `${type}_report_${Date.now()}`;

    if (format === "xlsx") {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Report Data");
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      return new Response(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
        },
      });
    } else {
      // Default to CSV
      const csvString = XLSX.utils.sheet_to_csv(worksheet);
      return new Response(csvString, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${filename}.csv"`,
        },
      });
    }
  } catch (err: unknown) {
    console.error("Export API error:", err);
    const errMsg = err instanceof Error ? err.message : "An unexpected error occurred.";
    const status = errMsg.includes("Access denied") || errMsg.includes("Unauthorized") ? 403 : 500;

    return new Response(JSON.stringify({ error: errMsg }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
