import Papa from 'papaparse'

/**
 * Parse a CSV file and return an array of objects (one per row).
 */
export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (err) => reject(err),
    })
  })
}

/**
 * Apply baseline pricing to inventory.
 * For each item, take whichever is greater:
 *   - TCG Market Price
 *   - (TCG Low Price With Shipping − shippingCost)
 * Then multiply by (percent / 100) and round to 2 decimals.
 * If ignoreZeroQty is true, items with qty 0 are left unchanged.
 */
export function applyBaseline(inventory, percent = 105, shippingCost = 0.70, ignoreZeroQty = false) {
  const multiplier = percent / 100
  return inventory.map((item) => {
    const qty = parseInt(item['Total Quantity']) || 0
    if (ignoreZeroQty && qty === 0) return item

    const marketPrice = parseFloat(item['TCG Market Price']) || 0
    const lowWithShip = parseFloat(item['TCG Low Price With Shipping']) || 0
    const shipOption = lowWithShip > 0 ? lowWithShip - shippingCost : 0
    let price = Math.max(marketPrice, shipOption) * multiplier
    price = Math.round(price * 100) / 100
    return { ...item, 'TCG Marketplace Price': price.toFixed(2) }
  })
}

/**
 * Apply bulk pricing rules to inventory.
 * Each rule: if quantity condition met, increase price by rule.percent%.
 * If ignoreZeroQty is true, items with qty 0 are left unchanged.
 */
export function applyRules(inventory, rules, ignoreZeroQty = false) {
  return inventory.map((item) => {
    const qty = parseInt(item['Total Quantity']) || 0
    if (ignoreZeroQty && qty === 0) return item

    let price = parseFloat(item['TCG Marketplace Price']) || 0

    for (const rule of rules) {
      let conditionMet = false
      if (rule.condition === 'quantity') {
        if (rule.operator === 'gte' && qty >= rule.value) conditionMet = true
        if (rule.operator === 'lte' && qty <= rule.value) conditionMet = true
        if (rule.operator === 'eq' && qty === rule.value) conditionMet = true
      }
      if (conditionMet) {
        price = price * (1 + rule.percent / 100)
      }
    }

    price = Math.round(price * 100) / 100
    return { ...item, 'TCG Marketplace Price': price.toFixed(2) }
  })
}

/**
 * Export inventory as a CSV Blob for download.
 */
export function exportCSV(inventory) {
  const csvString = Papa.unparse(inventory)
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'inventory_pricing_updated.csv'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

