import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const p = new PrismaClient({ adapter })

async function main() {
  // HK all permissions
  const hkAll: any[] = await p.$queryRawUnsafe(`SELECT r.name as role_name, p.module, p.action FROM employee_roles er JOIN roles r ON er.role_id = r.id JOIN role_permissions rp ON r.id = rp.role_id JOIN permissions p ON rp.permission_id = p.id WHERE er.employee_id = '7d3b45b2-7d3b-4d3b-a7d3-7d3b45b20000' AND er.end_date IS NULL ORDER BY p.module, p.action`);
  console.log('HK_ALL (' + hkAll.length + '):', JSON.stringify(hkAll.map(r => r.module + ':' + r.action)));

  // Check if training/pulse/succession permissions exist at all in DB
  const tps: any[] = await p.$queryRawUnsafe(`SELECT id, module, action FROM permissions WHERE module IN ('training','pulse','succession') ORDER BY module, action`);
  console.log('TPS_PERMS:', JSON.stringify(tps));
  
  // Check HK user role
  const hkUser: any[] = await p.$queryRawUnsafe(`SELECT u.email, si.role FROM users u JOIN sso_identities si ON si.user_id = u.id WHERE u.email = 'hr@ctr.co.kr'`);
  console.log('HK_USER:', JSON.stringify(hkUser));
  
  // Check how session gets role
  const hkRoles: any[] = await p.$queryRawUnsafe(`SELECT r.name FROM employee_roles er JOIN roles r ON er.role_id = r.id WHERE er.employee_id = '7d3b45b2-7d3b-4d3b-a7d3-7d3b45b20000' AND er.end_date IS NULL`);
  console.log('HK_ROLES:', JSON.stringify(hkRoles));

  await p.$disconnect();
}
main();
