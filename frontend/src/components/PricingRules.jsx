import { useState } from 'react'

export default function PricingRules({ rules, setRules, onApply, canApply, disabled }) {
  const [quantity, setQuantity] = useState(3)
  const [operator, setOperator] = useState('gte')
  const [percent, setPercent] = useState(10)

  const addRule = () => {
    const newRule = { condition: 'quantity', operator, value: Number(quantity), percent: Number(percent) }
    setRules([...rules, newRule])
  }

  const removeRule = (index) => {
    setRules(rules.filter((_, i) => i !== index))
  }

  return (
    <div className="card">
      <h2>⚙️ Bulk Pricing Rules</h2>
      <p className="card-desc">Set rules to adjust prices based on inventory quantity.</p>

      <div className="rule-builder">
        <div className="form-row">
          <label>
            If quantity is
            <select value={operator} onChange={(e) => setOperator(e.target.value)} className="select">
              <option value="gte">≥ (at least)</option>
              <option value="lte">≤ (at most)</option>
              <option value="eq">= (exactly)</option>
            </select>
          </label>
          <label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="input-small"
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            Increase price by
            <input
              type="number"
              min="0"
              step="0.1"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              className="input-small"
            />
          </label>
          <label>%</label>
          <button className="btn btn-secondary" onClick={addRule}>+ Add Rule</button>
        </div>
      </div>

      {rules.length > 0 && (
        <div className="rules-list">
          {rules.map((rule, i) => (
            <div key={i} className="rule-item">
              <span>Qty {rule.operator === 'gte' ? '≥' : rule.operator === 'lte' ? '≤' : '='} {rule.value} → Increase by {rule.percent}%</span>
              <button className="btn-remove" onClick={() => removeRule(i)}>✕</button>
            </div>
          ))}
        </div>
      )}

      <button
        className="btn btn-apply"
        onClick={onApply}
        disabled={!canApply || rules.length === 0 || disabled}
      >
        Apply Rules
      </button>
    </div>
  )
}
