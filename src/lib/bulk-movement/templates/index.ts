import type { MovementTemplate, MovementType } from '../types'
import { transferTemplate } from './transfer'
import { promotionTemplate } from './promotion'
import { entityTransferTemplate } from './entity-transfer'
import { terminationTemplate } from './termination'
import { compensationTemplate } from './compensation'

const templateRegistry = new Map<MovementType, MovementTemplate>([
  ['transfer', transferTemplate],
  ['promotion', promotionTemplate],
  ['entity-transfer', entityTransferTemplate],
  ['termination', terminationTemplate],
  ['compensation', compensationTemplate],
])

export function getTemplate(type: MovementType): MovementTemplate {
  const template = templateRegistry.get(type)
  if (!template) throw new Error(`알 수 없는 이동 유형: ${type}`)
  return template
}

export function getAllTemplates(): MovementTemplate[] {
  return Array.from(templateRegistry.values())
}
