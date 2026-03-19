import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const p = new PrismaClient({ adapter })

async function main() {
  const ea = await p.employee.findFirst({ where: { email: 'employee-a@ctr.co.kr' }, select: { id: true } });
  const eb = await p.employee.findFirst({ where: { email: 'employee-b@ctr.co.kr' }, select: { id: true } });
  const m1 = await p.employee.findFirst({ where: { email: 'manager@ctr.co.kr' }, select: { id: true } });
  const hk = await p.employee.findFirst({ where: { email: 'hr@ctr.co.kr' }, select: { id: true } });
  const co = await p.company.findFirst({ where: { code: 'CTR-KR' }, select: { id: true } });
  const dept = await p.department.findFirst({ where: { name: { contains: '생산기술' } }, select: { id: true } });
  const pos = dept ? await p.position.findFirst({ where: { departmentId: dept.id }, select: { id: true } }) : null;
  const comps = await p.competency.findMany({ take: 3, select: { id: true, name: true } });
  console.log(JSON.stringify({ea:ea?.id,eb:eb?.id,m1:m1?.id,hk:hk?.id,co:co?.id,dept:dept?.id,pos:pos?.id,comps}));

  const counts: any[] = await p.$queryRawUnsafe('SELECT (SELECT count(*)::int FROM competencies) as comp, (SELECT count(*)::int FROM employee_skill_assessments) as skill_a, (SELECT count(*)::int FROM training_courses) as courses, (SELECT count(*)::int FROM training_enrollments) as enroll, (SELECT count(*)::int FROM one_on_ones) as ooo, (SELECT count(*)::int FROM recognitions) as recog, (SELECT count(*)::int FROM pulse_surveys) as pulse, (SELECT count(*)::int FROM succession_plans) as succ, (SELECT count(*)::int FROM disciplinary_actions) as disc, (SELECT count(*)::int FROM reward_records) as reward');
  console.log(JSON.stringify(counts));

  const perms: any[] = await p.$queryRawUnsafe(`SELECT p.module, p.action FROM employee_roles er JOIN roles r ON er.role_id = r.id JOIN role_permissions rp ON r.id = rp.role_id JOIN permissions p ON rp.permission_id = p.id WHERE er.employee_id = '${ea?.id}' AND er.end_date IS NULL AND p.module IN ('EMPLOYEES','TRAINING','PERFORMANCE','PULSE','SUCCESSION','DISCIPLINE') ORDER BY p.module, p.action`);
  console.log('EA_PERMS=' + JSON.stringify(perms));

  const m1Perms: any[] = await p.$queryRawUnsafe(`SELECT p.module, p.action FROM employee_roles er JOIN roles r ON er.role_id = r.id JOIN role_permissions rp ON r.id = rp.role_id JOIN permissions p ON rp.permission_id = p.id WHERE er.employee_id = '${m1?.id}' AND er.end_date IS NULL AND p.module IN ('EMPLOYEES','TRAINING','PERFORMANCE','PULSE','SUCCESSION','DISCIPLINE') ORDER BY p.module, p.action`);
  console.log('M1_PERMS=' + JSON.stringify(m1Perms));

  await p.$disconnect();
}
main();
