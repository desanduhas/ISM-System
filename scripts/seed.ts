/**
 * scripts/seed.ts
 * ISM Flow — Create sample auth users via Supabase Admin API
 *
 * Usage: npm run seed
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local if present
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch {}

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "❌ Missing required environment variables.\n" +
      "   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set.\n" +
      "   Check your .env.local file."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface SeedUser {
  email: string;
  password: string;
  full_name: string;
  role: string;
}

const SEED_USERS: SeedUser[] = [
  {
    email: "manager1@example.com",
    password: "Change-Me-123!",
    full_name: "Kasun Rajapaksa",
    role: "MANAGEMENT",
  },
  {
    email: "manager2@example.com",
    password: "Change-Me-123!",
    full_name: "Dilini Jayawardena",
    role: "MANAGEMENT",
  },
  {
    email: "mcc1@example.com",
    password: "Change-Me-123!",
    full_name: "Chamara Silva",
    role: "MARKETING_CUSTOMER_CARE",
  },
  {
    email: "designer1@example.com",
    password: "Change-Me-123!",
    full_name: "Nethmi Fernando",
    role: "GRAPHIC_DESIGNER",
  },
  {
    email: "capture1@example.com",
    password: "Change-Me-123!",
    full_name: "Ruwan Gunasekara",
    role: "CAPTURING",
  },
  {
    email: "finance1@example.com",
    password: "Change-Me-123!",
    full_name: "Amali Wickramasinghe",
    role: "FINANCE",
  },
];

async function seedUsers(): Promise<void> {
  console.log("🌱 ISM Flow — Seeding sample users to live Supabase...\n");

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of SEED_USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: {
        full_name: user.full_name,
        role: user.role,
      },
    });

    if (error) {
      if (error.message.toLowerCase().includes("already registered")) {
        console.log(`  ℹ  Skipped  ${user.email} (already exists)`);
        skipped++;
      } else {
        console.error(`  ✕  Failed   ${user.email}: ${error.message}`);
        failed++;
      }
    } else {
      console.log(`  ✓  Created  ${user.email} → ${user.role} (id: ${data.user?.id})`);
      created++;
    }
  }

  console.log(`\n📊 Summary: ${created} created, ${skipped} skipped, ${failed} failed`);

  if (failed > 0) {
    console.error("\n⚠️  Some users failed to create. Check the errors above.");
    process.exit(1);
  }

  console.log("\n✅ Seed complete! Default password for all users: Change-Me-123!");
  console.log("   You can now log in at http://localhost:3000/login\n");
}

seedUsers().catch((err) => {
  console.error("Fatal error during seeding:", err);
  process.exit(1);
});
