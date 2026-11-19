import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { jobs } from "@/db/schema";

export const dynamic = "force-dynamic";

const seed = [
  { id: "JOB-1048", client: "ABC Company", title: "November social media campaign", type: "Graphic Design", stage: "production", date: "2026-11-09", time: "10:00", location: "Colombo 03", contactName: "Nimali Perera", contactPhone: "+94 77 234 8890", brief: "Create 8 social posts for the November product campaign. Use the blue brand palette and include Sinhala + English copy.", assignedRole: "graphics", owner: "Kavindu", price: 85000, filesUrl: "drive.google.com/abc-campaign", invoiceNo: null, paymentStatus: "pending", updatedAt: "2026-11-08T13:20:00Z" },
  { id: "JOB-1047", client: "Lanka Fresh", title: "Product photography", type: "Capturing", stage: "visit", date: "2026-11-10", time: "14:30", location: "Wattala", contactName: "Ruwan Silva", contactPhone: "+94 71 456 1020", brief: "On-site shoot for the new beverage range. 25 edited product photos required.", assignedRole: "capturing", owner: "Sahan", price: 65000, filesUrl: null, invoiceNo: null, paymentStatus: "pending", updatedAt: "2026-11-08T11:05:00Z" },
  { id: "JOB-1046", client: "Ceylon Homes", title: "Lead generation campaign", type: "Digital Marketing", stage: "review", date: "2026-11-08", time: "09:00", location: "Online", contactName: "Fathima Rizna", contactPhone: "+94 76 882 4431", brief: "Meta lead campaign for the Homagama apartment launch. Target 150 qualified leads.", assignedRole: "marketing", owner: "Dinithi", price: 120000, filesUrl: "drive.google.com/ceylon-homes", invoiceNo: null, paymentStatus: "pending", updatedAt: "2026-11-08T09:45:00Z" },
  { id: "JOB-1045", client: "Aura Wellness", title: "Brand launch content", type: "Graphic Design", stage: "invoice", date: "2026-11-07", time: "11:30", location: "Nugegoda", contactName: "Shanika Fernando", contactPhone: "+94 75 774 2266", brief: "Launch kit with logo applications, 6 social posts and story templates.", assignedRole: "finance", owner: "Hasini", price: 145000, filesUrl: "drive.google.com/aura-launch", invoiceNo: "INV-2026-118", paymentStatus: "pending", updatedAt: "2026-11-08T08:30:00Z" },
  { id: "JOB-1044", client: "Northstar Academy", title: "Admissions video", type: "Capturing", stage: "closed", date: "2026-11-06", time: "08:30", location: "Kandy", contactName: "Malith Jay", contactPhone: "+94 70 321 9921", brief: "90-second admissions video with campus b-roll and principal interview.", assignedRole: "finance", owner: "Sahan", price: 175000, filesUrl: "drive.google.com/northstar-video", invoiceNo: "INV-2026-114", paymentStatus: "verified", updatedAt: "2026-11-07T16:10:00Z" },
];

export async function GET() {
  const db = getDb();
  let rows = await db.select().from(jobs).orderBy(asc(jobs.date));
  if (!rows.length) {
    await db.insert(jobs).values(seed);
    rows = await db.select().from(jobs).orderBy(asc(jobs.date));
  }
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const now = new Date().toISOString();
  const record = {
    id: `JOB-${Math.floor(1050 + Math.random() * 8000)}`,
    client: String(body.client || "New client"), title: String(body.title || "Untitled job"),
    type: String(body.type || "Graphic Design"), stage: "visit", date: String(body.date),
    time: String(body.time || "09:00"), location: String(body.location || "TBC"),
    contactName: String(body.contactName || "Client contact"), contactPhone: String(body.contactPhone || ""),
    brief: String(body.brief || "Brief pending"), assignedRole: "marketing", owner: String(body.owner || "Customer Care"),
    price: Number(body.price || 0), filesUrl: null, invoiceNo: null, paymentStatus: "pending", updatedAt: now,
  };
  await getDb().insert(jobs).values(record);
  return NextResponse.json(record, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const allowed = ["stage", "assignedRole", "owner", "price", "filesUrl", "invoiceNo", "paymentStatus"] as const;
  const update: Record<string, string | number> = { updatedAt: new Date().toISOString() };
  for (const key of allowed) if (body[key] !== undefined) update[key] = body[key];
  await getDb().update(jobs).set(update).where(eq(jobs.id, String(body.id)));
  const [row] = await getDb().select().from(jobs).where(eq(jobs.id, String(body.id)));
  return NextResponse.json(row);
}
