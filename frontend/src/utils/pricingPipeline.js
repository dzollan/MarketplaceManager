/**
 * Pricing pipeline engine.
 *
 * A pipeline is an ordered list of steps. Each step is either:
 *   - { type: 'baseline', percent, shippingCost }
 *   - { type: 'rule', condition: { field, operator, value }, action: { type, value } }
 *
 * Steps are applied sequentially; each step operates on the price produced
 * by the previous step.
 *
 * Rule fields:
 *   - numeric (qty, avgDailySold): operators gte / lte / gt / lt / eq
 *   - text (set, rarity, condition): operator "isOneOf" — value is a
 *     comma-separated list; the rule matches if the item's value is in the list.
 *   - date (releaseDate): operators before / after — value is an ISO date
 *     (YYYY-MM-DD); items without a release date never match.
 */

export const CONDITION_FIELDS = [
  { id: 'quantity', label: 'Quantity', column: 'Total Quantity', kind: 'numeric' },
  { id: 'avgDailySold', label: 'Avg Daily Sold', column: 'Avg Daily Sold', kind: 'numeric' },
  { id: 'releaseDate', label: 'Release Date', column: 'Release Date', kind: 'date' },
  { id: 'set', label: 'Set', column: 'Set Name', kind: 'text' },
  { id: 'rarity', label: 'Rarity', column: 'Rarity', kind: 'text' },
  { id: 'condition', label: 'Condition', column: 'Condition', kind: 'text' },
]

export const NUMERIC_OPERATORS = [
  { id: 'gte', label: '≥' },
  { id: 'lte', label: '≤' },
  { id: 'gt', label: '>' },
  { id: 'lt', label: '<' },
  { id: 'eq', label: '=' },
]

export const TEXT_OPERATORS = [
  { id: 'isOneOf', label: 'is one of' },
]

export const DATE_OPERATORS = [
  { id: 'before', label: 'before' },
  { id: 'after', label: 'after' },
]

export const ACTION_TYPES = [
  { id: 'percent', label: 'Adjust by %' },
  { id: 'amount', label: 'Adjust by $' },
  { id: 'set', label: 'Set price to $' },
]

let ruleCounter = 0
export function makeRule() {
  ruleCounter += 1
  return {
    id: `rule-${Date.now()}-${ruleCounter}`,
    type: 'rule',
    condition: { field: 'quantity', operator: 'gte', value: 3 },
    action: { type: 'percent', value: 10 },
  }
}

function getField(item, fieldId) {
  const field = CONDITION_FIELDS.find((f) => f.id === fieldId)
  if (!field) return field?.kind === 'text' ? '' : 0
  const raw = item[field.column]
  if (raw === undefined || raw === null) return field.kind === 'text' ? '' : 0
  if (field.kind === 'text') return String(raw).trim()
  if (field.kind === 'date') return String(raw).trim()
  return parseFloat(raw) || 0
}

/** Parse an ISO-ish date string (YYYY-MM-DD) to a UTC timestamp, or NaN. */
function parseDateValue(raw) {
  const s = String(raw || '').trim()
  if (!s) return NaN
  const t = Date.parse(s)
  return Number.isNaN(t) ? NaN : t
}

export function conditionMet(item, condition) {
  const field = CONDITION_FIELDS.find((f) => f.id === condition.field)
  if (!field) return false

  if (field.kind === 'text') {
    const v = getField(item, condition.field)
    if (!v) return false
    const list = String(condition.value)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    return list.includes(v)
  }

  if (field.kind === 'date') {
    const v = parseDateValue(getField(item, condition.field))
    const target = parseDateValue(condition.value)
    if (Number.isNaN(v) || Number.isNaN(target)) return false
    switch (condition.operator) {
      case 'before': return v < target
      case 'after': return v > target
      default: return false
    }
  }

  const v = getField(item, condition.field)
  const target = parseFloat(condition.value) || 0
  switch (condition.operator) {
    case 'gte': return v >= target
    case 'lte': return v <= target
    case 'gt': return v > target
    case 'lt': return v < target
    case 'eq': return v === target
    default: return false
  }
}

/**
 * Split the combined TCGplayer "Condition" column into a pure condition
 * (e.g. "Near Mint") and an edition (e.g. "1st Edition", "Unlimited",
 * "Limited", "Holofoil", "Foil"). Foil/foil-foil variants are treated as
 * editions. Returns { condition, edition }.
 */
export function splitCondition(raw) {
  const value = (raw || '').trim()
  if (!value) return { condition: '', edition: '' }
  const parts = value.split(/\s+/)
  const editionWords = ['1st', 'Unlimited', 'Limited', 'Holofoil', 'Foil', 'Foilfoil', 'Foil-Foil']
  const editionIdx = parts.findIndex((p) => editionWords.includes(p))
  if (editionIdx === -1) return { condition: value, edition: '' }
  const edition = parts.slice(editionIdx).join(' ')
  const condition = parts.slice(0, editionIdx).join(' ')
  return { condition, edition }
}

/** Human-readable summary of a rule condition, e.g. "Rarity is one of: Secret Rare, Gold Rare". */
export function describeCondition(condition) {
  const field = CONDITION_FIELDS.find((f) => f.id === condition.field)
  if (!field) return ''
  if (field.kind === 'text') {
    return `${field.label} is one of: ${condition.value || '…'}`
  }
  if (field.kind === 'date') {
    const op = DATE_OPERATORS.find((o) => o.id === condition.operator)
    return `${field.label} ${op?.label ?? ''} ${condition.value || '…'}`
  }
  const op = NUMERIC_OPERATORS.find((o) => o.id === condition.operator)
  return `${field.label} ${op?.label ?? ''} ${condition.value}`
}

function applyAction(price, action) {
  const value = parseFloat(action.value) || 0
  switch (action.type) {
    case 'percent': return price * (1 + value / 100)
    case 'amount': return price + value
    case 'set': return value
    default: return price
  }
}

function applyStep(item, step) {
  if (step.type === 'baseline') {
    const marketPrice = parseFloat(item['TCG Market Price']) || 0
    const lowWithShip = parseFloat(item['TCG Low Price With Shipping']) || 0
    const shipOption = lowWithShip > 0 ? lowWithShip - (step.shippingCost || 0) : 0
    let price = Math.max(marketPrice, shipOption) * ((step.percent || 100) / 100)
    price = Math.round(price * 100) / 100
    return { ...item, 'TCG Marketplace Price': price.toFixed(2) }
  }

  if (step.type === 'rule') {
    if (!conditionMet(item, step.condition)) return item
    const price = parseFloat(item['TCG Marketplace Price']) || 0
    const newPrice = Math.round(applyAction(price, step.action) * 100) / 100
    return { ...item, 'TCG Marketplace Price': newPrice.toFixed(2) }
  }

  return item
}

/**
 * Apply the full pipeline sequentially.
 * steps: array of step objects (baseline and/or rules, in order).
 */
export function applyPipeline(inventory, steps) {
  let result = inventory
  for (const step of steps) {
    result = result.map((item) => applyStep(item, step))
  }
  return result
}

/** How many items a single step would affect (baseline: all items). */
export function countMatches(inventory, step) {
  if (step.type === 'baseline') return inventory.length
  return inventory.filter((i) => conditionMet(i, step.condition)).length
}

