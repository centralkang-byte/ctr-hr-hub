const fs = require('fs')
const path = require('path')

const EN_PATH = path.join(process.cwd(), 'messages', 'en.json')
const KO_PATH = path.join(process.cwd(), 'messages', 'ko.json')
const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'))
const ko = JSON.parse(fs.readFileSync(KO_PATH, 'utf8'))

function titleCase(str) {
  return str.split(/[-_]+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

const DOMAIN_MAP = {
  'payroll': 'Payroll',
  'performance': 'Performance',
  'analytics': 'Insights',
  'attendance': 'Attendance',
  'recruitment': 'Recruitment',
  'onboarding': 'Onboarding',
  'settings': 'Settings',
  'mySpace': 'My Space',
  'skills': 'Skills',
  'leave': 'Leave',
  'benefits': 'Benefits',
  'compliance': 'Compliance',
  'training': 'Training',
  'directory': 'Directory',
  'organization': 'Organization',
  'system': 'System'
}

let filledCount = 0

function traverse(koObj, enObj, currentPath = []) {
  for (const key of Object.keys(koObj)) {
    const fullKey = [...currentPath, key].join('.')
    
    if (typeof koObj[key] === 'object' && koObj[key] !== null) {
      if (!enObj[key]) enObj[key] = {}
      traverse(koObj[key], enObj[key], [...currentPath, key])
    } else {
      if (enObj[key] === '' || enObj[key] === undefined) {
        
        const ns = currentPath[0] || ''
        const domainName = DOMAIN_MAP[ns] || titleCase(ns)
        
        if (ns === 'menu') {
          enObj[key] = titleCase(key)
          filledCount++
        } else if (key === 'pageTitle') {
          if (currentPath.length > 1) {
             const subModule = DOMAIN_MAP[currentPath[1]] || titleCase(currentPath[1])
             enObj[key] = `${domainName} - ${subModule}`
          } else {
             enObj[key] = domainName
          }
          filledCount++
        } else if (key.endsWith('Title') && typeof key === 'string') {
           const sub = key.replace('Title', '')
           enObj[key] = `${domainName} - ${titleCase(sub)}`
           filledCount++
        } else if (key === 'emptyTitle') {
          enObj[key] = `No ${domainName} Data`
          filledCount++
        } else if (key === 'emptyDesc') {
          enObj[key] = `There are no ${domainName} records found.`
          filledCount++
        } else if (key.toLowerCase().includes('searchplaceholder') || key === 'searchPlaceholder') {
          enObj[key] = `Search...`
          filledCount++
        } else if (key === 'title') {
          enObj[key] = `Title`
          filledCount++
        } else if (key === 'description') {
          enObj[key] = `Description`
          filledCount++
        }
      }
    }
  }
}

traverse(ko, en)
fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 2) + '\n', 'utf8')
console.log(`Filled ${filledCount} critical English keys in en.json.`)
