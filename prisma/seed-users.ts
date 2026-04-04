import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const adminPassword = await bcrypt.hash("admin123", 12)
  const staffPassword = await bcrypt.hash("staff123", 12)

  const admin = await prisma.user.upsert({
    where: { email: "admin@achyutamfruitam.com" },
    update: { password: adminPassword, role: "ADMIN", name: "Admin" },
    create: {
      email: "admin@achyutamfruitam.com",
      name: "Admin",
      password: adminPassword,
      role: "ADMIN",
    },
  })

  const staff = await prisma.user.upsert({
    where: { email: "staff@achyutamfruitam.com" },
    update: { password: staffPassword, role: "STAFF", name: "Staff" },
    create: {
      email: "staff@achyutamfruitam.com",
      name: "Staff",
      password: staffPassword,
      role: "STAFF",
    },
  })

  console.log("Seeded users:")
  console.log(`  Admin: ${admin.email} (password: admin123)`)
  console.log(`  Staff: ${staff.email} (password: staff123)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
