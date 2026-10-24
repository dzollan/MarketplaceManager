import { useState } from 'react'
import {
  CONDITION_FIELDS,
  NUMERIC_OPERATORS,
  TEXT_OPERATORS,
  ACTION_TYPES,
  makeRule,
  countMatches,
  describeCondition,
} from '../utils/pricingPipeline'

function BaselineStep({ baseline, setBaseline, inventory, ignoreZeroQty }) {
  const [editing, setEditing] = useState(false)
  const matches = countMatches(inventory, baseline, ignoreZeroQty)

  return (
    <div className="pipeline-step step-baseline">
      <div className="step-header">
        <span className="step-number">1</span>
        <span className="step-title">Baseline Pricing</span>
        <span className="step-matches">{matches} items</span>
        <button className="btn-icon" onClick={() => setEditing(!editing)} title="Edit baseline">
          {editing ? '✓' : '✎'}
        </button>
      </div>
      <div className="step-summary">
        {baseline.percent}% of max(market, low+ship − ${baseline.shippingCost.toFixed(2)})
      </div>
      {editing && (
        <div className="step-settings">
          <label>
            Markup %
            <input
              type="number"
              min="1"
              step="0.1"
              value={baseline.percent}
              onChange={(e) => setBaseline({ ...baseline, percent: Number(e.target.value) })}
              className="input-small"
            />
          </label>
          <label>
            Shipping cost ($)
            <input
              type="number"
              min="0"
              step="0.01"
              value={baseline.shippingCost}
              onChange={(e) => setBaseline({ ...baseline, shippingCost: Number(e.target.value) })}
              className="input-small"
            />
          </label>
        </div>
      )}
    </div>
  )
}

function RuleStep({ rule, setRule, remove, moveUp, moveDown, canMoveUp, canMoveDown, inventory, ignoreZeroQty }) {
  const matches = countMatches(inventory, rule, ignoreZeroQty)
  const field = CONDITION_FIELDS.find((f) => f.id === rule.condition.field)
  const isText = field?.kind === 'text'
  const operators = isText ? TEXT_OPERATORS : NUMERIC_OPERATORS
  const action = ACTION_TYPES.find((a) => a.id === rule.action.type)

  const handleFieldChange = (fieldId) => {
    const nextField = CONDITION_FIELDS.find((f) => f.id === fieldId)
    const condition = { ...rule.condition, field: fieldId }
    if (nextField.kind === 'text') {
      condition.operator = 'isOneOf'
      condition.value = ''
    } else if (condition.operator === 'isOneOf') {
      condition.operator = 'gte'
      condition.value = 3
    }
    setRule({ ...rule, condition })
  }

  return (
    <div className="pipeline-step step-rule">
      <div className="step-header">
        <span className="step-title">{describeCondition(rule.condition)}</span>
        <span className="step-matches">{matches} items</span>
        <div className="step-actions">
          <button className="btn-icon" onClick={moveUp} disabled={!canMoveUp} title="Move up">↑</button>
          <button className="btn-icon" onClick={moveDown} disabled={!canMoveDown} title="Move down">↓</button>
          <button className="btn-icon btn-danger" onClick={remove} title="Remove rule">✕</button>
        </div>
      </div>
      <div className="step-summary">
        → {action?.label}: {rule.action.type === 'amount' ? `$${rule.action.value}` : rule.action.value}
        {rule.action.type === 'percent' && '%'}
      </div>
      <div className="step-settings">
        <div className="form-row">
          <label>
            If
            <select
              value={rule.condition.field}
              onChange={(e) => handleFieldChange(e.target.value)}
              className="select"
            >
              {CONDITION_FIELDS.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </label>
          <label>
            <select
              value={rule.condition.operator}
              onChange={(e) => setRule({ ...rule, condition: { ...rule.condition, operator: e.target.value } })}
              className="select"
            >
              {operators.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>
          {isText ? (
            <label>
              <input
                type="text"
                placeholder="Comma-separated values…"
                value={rule.condition.value}
                onChange={(e) => setRule({ ...rule, condition: { ...rule.condition, value: e.target.value } })}
                className="input-small input-wide"
              />
            </label>
          ) : (
            <label>
              <input
                type="number"
                step="any"
                value={rule.condition.value}
                onChange={(e) => setRule({ ...rule, condition: { ...rule.condition, value: e.target.value } })}
                className="input-small"
              />
            </label>
          )}
        </div>
        <div className="form-row">
          <label>
            Then
            <select
              value={rule.action.type}
              onChange={(e) => setRule({ ...rule, action: { ...rule.action, type: e.target.value } })}
              className="select"
            >
              {ACTION_TYPES.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="number"
              step="any"
              value={rule.action.value}
              onChange={(e) => setRule({ ...rule, action: { ...rule.action, value: e.target.value } })}
              className="input-small"
            />
          </label>
        </div>
      </div>
    </div>
  )
}

export default function PipelinePanel({
  baseline,
  setBaseline,
  rules,
  setRules,
  onRun,
  canRun,
  disabled,
  inventory,
  ignoreZeroQty,
}) {
  const updateRule = (newRule) => {
    setRules(rules.map((r) => (r.id === newRule.id ? newRule : r)))
  }

  const moveRule = (index, dir) => {
    const target = index + dir
    if (target < 0 || target >= rules.length) return
    const next = [...rules]
    ;[next[index], next[target]] = [next[target], next[index]]
    setRules(next)
  }

  return (
    <div className="card">
      <h2>🔀 Pricing Pipeline</h2>
      <p className="card-desc">Steps run top to bottom. Each step sees the price set by the one before it.</p>

      <div className="pipeline">
        <BaselineStep
          baseline={baseline}
          setBaseline={setBaseline}
          inventory={inventory}
          ignoreZeroQty={ignoreZeroQty}
        />

        {rules.map((rule, i) => (
          <RuleStep
            key={rule.id}
            rule={rule}
            setRule={updateRule}
            remove={() => setRules(rules.filter((r) => r.id !== rule.id))}
            moveUp={() => moveRule(i, -1)}
            moveDown={() => moveRule(i, 1)}
            canMoveUp={i > 0}
            canMoveDown={i < rules.length - 1}
            inventory={inventory}
            ignoreZeroQty={ignoreZeroQty}
          />
        ))}
      </div>

      <button
        className="btn btn-add-rule"
        onClick={() => setRules([...rules, makeRule()])}
        disabled={disabled}
      >
        + Add Rule
      </button>

      <button
        className="btn btn-run-pipeline"
        onClick={onRun}
        disabled={!canRun || disabled}
      >
        ▶ Run Pipeline
      </button>
    </div>
  )
}
