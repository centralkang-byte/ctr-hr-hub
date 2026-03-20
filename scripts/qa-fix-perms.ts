import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import crypto from 'crypto'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const p = new PrismaClient({ adapter })

function dUUID(prefix: string, key: string): string {
  const hash = crypto.createHash('sha256').update(`${prefix}:${key}`).digest('hex')
  return [hash.slice(0,8), hash.slice(8,12), '4'+hash.slice(13,16), 'a'+hash.slice(17,20), hash.slice(20,32)].join('-')
}

async function main() {
  const missingModules = ['training', 'pulse', 'succession']
  const actions = ['create', 'read', 'update', 'delete', 'export', 'manage']
  
  console.log('=== Adding missing permission modules ===')
  
  const permMap: Record<string, string> = {}
  for (const mod of missingModules) {
    for (const act of actions) {
      const code = `${mod}_${act}`
      const id = dUUID('permission', code)
      await p.permission.upsert({
        where: { id },
        create: { id, module: mod, resource: mod, action: act },
        update: {},
      })
      permMap[code] = id
    }
    console.log(`  ✅ ${mod}: 6 permissions`)
  }
  
  const roles = await p.role.findMany({ select: { id: true, name: true } })
  const roleMap: Record<string, string> = {}
  for (const r of roles) roleMap[r.name.toUpperCase().replace(/\s+/g, '_')] = r.id
  
  const rolePerms: Record<string, string[]> = {
    HR_ADMIN: missingModules.flatMap(m => actions.map(a => `${m}_${a}`)),
    MANAGER: ['training_read','training_create','pulse_read','succession_read'],
    EMPLOYEE: ['training_read','training_create','pulse_read','pulse_create'],
    EXECUTIVE: [...missingModules.map(m => `${m}_read`), ...missingModules.map(m => `${m}_export`)],
  }
  
  for (const [roleName, perms] of Object.entries(rolePerms)) {
    const roleId = roleMap[roleName]
    if (!roleId) continue
    for (const permCode of perms) {
      const permId = permMap[permCode]
      if (!permId) continue
      const rpId = dUUID('role-permission', `${roleName}_${permCode}`)
      await p.rolePermission.upsert({
        where: { id: rpId },
        create: { id: rpId, roleId, permissionId: permId },
        update: {},
      })
    }
    console.log(`  ✅ ${roleName}: ${perms.length} role-permissions`)
  }
  
  // Verify
  const hkPerms: any[] = await p.$queryRawUnsafe(`SELECT p.module, p.action FROM employee_roles er JOIN roles r ON er.role_id = r.id JOIN role_permissions rp ON r.id = rp.role_id JOIN permissions p ON rp.permission_id = p.id WHERE er.employee_id = '7d3b45b2-7d3b-4d3b-a7d3-7d3b45b20000' AND er.end_date IS NULL AND p.module IN ('training','pulse','succession') ORDER BY p.module, p.action`)
  console.log('HK:', hkPerms.map(r => `${r.module}:${r.action}`).join(', '))
  
  const eaPerms: any[] = await p.$queryRawUnsafe(`SELECT p.module, p.action FROM employee_roles er JOIN roles r ON er.role_id = r.id JOIN role_permissions rp ON r.id = rp.role_id JOIN permissions p ON rp.permission_id = p.id WHERE er.employee_id = '14a0ccad-14a0-44a0-a14a-14a0ccad0000' AND er.end_date IS NULL AND p.module IN ('training','pulse','succession') ORDER BY p.module, p.action`)
  console.log('EA:', eaPerms.map(r => `${r.module}:${r.action}`).join(', '))
  
  const m1Perms: any[] = await p.$queryRawUnsafe(`SELECT p.module, p.action FROM employee_roles er JOIN roles r ON er.role_id = r.id JOIN role_permissions rp ON r.id = rp.role_id JOIN permissions p ON rp.permission_id = p.id WHERE er.employee_id = '6998b283-6998-4998-a699-6998b2830000' AND er.end_date IS NULL AND p.module IN ('training','pulse','succession') ORDER BY p.module, p.action`)
  console.log('M1:', m1Perms.map(r => `${r.module}:${r.action}`).join(', '))
  
  await p.$disconnect()
  console.log('=== Done ===')
}
main()
