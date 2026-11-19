import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  client: text("client").notNull(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  stage: text("stage").notNull().default("visit"),
  date: text("date").notNull(),
  time: text("time").notNull(),
  location: text("location").notNull(),
  contactName: text("contact_name").notNull(),
  contactPhone: text("contact_phone").notNull(),
  brief: text("brief").notNull(),
  assignedRole: text("assigned_role").notNull(),
  owner: text("owner").notNull(),
  price: integer("price").notNull().default(0),
  filesUrl: text("files_url"),
  invoiceNo: text("invoice_no"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  updatedAt: text("updated_at").notNull(),
});
