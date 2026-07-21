import { useState } from 'react'

export default function PricingRules({ onApply, canApply, disabled }) {
  const [quantity, setQuantity] = useState(3)
  const [operator, setOperator] = useState('gte')
  const [percent, setPercent] = useState(10)

  const apply = () => {
    const rule = { condition: 'quantity', operator, value: Number(quantity), percent: Number(percent) }
    onApply([rule])
  }

  return (
    <div className="card">
      <h2>⚙️ Bulk Pricing Rules</h2>
      <p className="card-desc">Adjust prices based on inventory quantity.</p>

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
        </div>
      </div>

      <button
        className="btn btn-apply"
        onClick={apply}
        disabled={!canApply || disabled}
      >
        Apply Rule
      </button>
    </div>
  )
}
