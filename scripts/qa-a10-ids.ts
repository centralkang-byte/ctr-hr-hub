import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const emps = await prisma.employee.findMany({
    where: { email: { in: ['hr@ctr.co.kr', 'employee-a@ctr.co.kr'] } },
    select: { id: true, name: true, email: true }
  });
  console.log('EMPLOYEES:' + JSON.stringify(emps));
  
  const company = await prisma.company.findFirst({ where: { code: 'CTR-KR' }, select: { id: true, code: true } });
  console.log('COMPANY:' + JSON.stringify(company));
  
  const grades = await prisma.jobGrade.findMany({ take: 5, select: { id: true, code: true, name: true } });
  console.log('JOB_GRADES:' + JSON.stringify(grades));
  
  const cycles = await prisma.performanceCycle.findMany({ orderBy: { year: 'desc' }, take: 3, select: { id: true, name: true, year: true } });
  console.log('PERF_CYCLES:' + JSON.stringify(cycles));
  
  const sb = await prisma.salaryBand.count();
  const sam = await prisma.salaryAdjustmentMatrix.count();
  const bp = await prisma.benefitPolicy.count();
  const eb = await prisma.employeeBenefit.count();
  const ch = await prisma.compensationHistory.count();
  console.log('COUNTS:' + JSON.stringify({ salaryBand: sb, matrix: sam, benefitPolicy: bp, enrollment: eb, compHistory: ch }));
}
main().then(() => prisma.$disconnect());
