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
  // Get MANAGER role
  const mgr = await p.role.findFirst({ where: { name: 'Manager' }, select: { id: true } })
  if (!mgr) { console.log('Manager role not found'); return }
  
  // Get performance:create permission
  const perm = await p.permission.findFirst({ where: { module: 'performance', action: 'create' }, select: { id: true } })
  if (!perm) { console.log('performance:create not found'); return }
  
  // Add to manager
  const rpId = dUUID('role-permission', 'MANAGER_performance_create')
  await p.rolePermission.upsert({
    where: { id: rpId },
    create: { id: rpId, roleId: mgr.id, permissionId: perm.id },
    update: {},
  })
  console.log('✅ Added performance:create to MANAGER')
  
  // Also add discipline:create and discipline:update for MANAGER (for CFR dashboard, etc.)
  for (const action of ['create', 'update']) {
    const dperm = await p.permission.findFirst({ where: { module: 'discipline', action }, select: { id: true } })
    if (dperm) {
      const did = dUUID('role-permission', `MANAGER_discipline_${action}`)
      await p.rolePermission.upsert({
        where: { id: did },
        create: { id: did, roleId: mgr.id, permissionId: dperm.id },
        update: {},
      })
      console.log(`✅ Added discipline:${action} to MANAGER`)
    }
  }
  
  await p.$disconnect()
}
main()
