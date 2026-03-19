import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const p = new PrismaClient({ adapter })

async function main() {
  // All EA permissions
  const eaAll: any[] = await p.$queryRawUnsafe(`SELECT r.name as role_name, p.module, p.action FROM employee_roles er JOIN roles r ON er.role_id = r.id JOIN role_permissions rp ON r.id = rp.role_id JOIN permissions p ON rp.permission_id = p.id WHERE er.employee_id = '14a0ccad-14a0-44a0-a14a-14a0ccad0000' AND er.end_date IS NULL ORDER BY p.module, p.action`);
  console.log('EA_ALL_PERMS (' + eaAll.length + '):', JSON.stringify(eaAll.map(r => r.module + ':' + r.action)));

  // All M1 permissions  
  const m1All: any[] = await p.$queryRawUnsafe(`SELECT r.name as role_name, p.module, p.action FROM employee_roles er JOIN roles r ON er.role_id = r.id JOIN role_permissions rp ON r.id = rp.role_id JOIN permissions p ON rp.permission_id = p.id WHERE er.employee_id = '6998b283-6998-4998-a699-6998b2830000' AND er.end_date IS NULL ORDER BY p.module, p.action`);
  console.log('M1_ALL_PERMS (' + m1All.length + '):', JSON.stringify(m1All.map(r => r.module + ':' + r.action)));

  // HK permissions for relevant modules
  const hkPerms: any[] = await p.$queryRawUnsafe(`SELECT p.module, p.action FROM employee_roles er JOIN roles r ON er.role_id = r.id JOIN role_permissions rp ON r.id = rp.role_id JOIN permissions p ON rp.permission_id = p.id WHERE er.employee_id = '7d3b45b2-7d3b-4d3b-a7d3-7d3b45b20000' AND er.end_date IS NULL AND p.module IN ('EMPLOYEES','TRAINING','PERFORMANCE','PULSE','SUCCESSION','DISCIPLINE') ORDER BY p.module, p.action`);
  console.log('HK_RELEVANT (' + hkPerms.length + '):', JSON.stringify(hkPerms.map(r => r.module + ':' + r.action)));

  // Check what modules exist in permissions table
  const modules: any[] = await p.$queryRawUnsafe(`SELECT DISTINCT module FROM permissions WHERE module IN ('EMPLOYEES','TRAINING','PERFORMANCE','PULSE','SUCCESSION','DISCIPLINE','SKILLS','CFR','REWARDS') ORDER BY module`);
  console.log('AVAILABLE_MODULES:', JSON.stringify(modules.map(r => r.module)));

  // Check how the routes actually check permissions - look at the perm function
  const allModules: any[] = await p.$queryRawUnsafe(`SELECT DISTINCT module FROM permissions ORDER BY module`);
  console.log('ALL_MODULES:', JSON.stringify(allModules.map(r => r.module)));

  await p.$disconnect();
}
main();
