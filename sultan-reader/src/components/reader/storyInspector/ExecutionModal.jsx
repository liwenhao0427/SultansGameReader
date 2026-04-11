import { useMemo, useState } from 'react'
import { useResolvedImage } from '../../../services/imageResolver'
import { CARD_RENDER_CONFIG, getCardFrameHeight, getCardRarityFrameAsset } from '../../../resourceConfig'
import { executionStyles as styles } from './executionStyles'

function CardPortrait({ card, compact = false, showName = true, widthOverride = null }) {
  const { url } = useResolvedImage(card?.image)
  const { url: rareFrameUrl } = useResolvedImage(getCardRarityFrameAsset(card?.rare))
  const width = widthOverride || (compact ? 54 : 66)
  const height = getCardFrameHeight(width)
  const artInset = compact
    ? '1px 2px 9px'
    : width > 66
      ? '5px 6px 24px'
      : '4px 5px 20px'

  return (
    <div style={{
      width,
      height,
      borderRadius: 16,
      overflow: 'hidden',
      border: '1px solid rgba(233, 219, 183, 0.22)',
      boxShadow: '0 14px 26px rgba(0, 0, 0, 0.26)',
      backgroundColor: 'rgba(18, 15, 11, 0.92)',
      backgroundImage: rareFrameUrl ? `url("${rareFrameUrl}")` : 'none',
      backgroundRepeat: 'no-repeat',
      backgroundSize: '100% 100%',
      backgroundPosition: 'center',
      position: 'relative',
      flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute',
        inset: artInset,
        overflow: 'hidden',
        borderRadius: compact ? 14 : 18,
        background: 'linear-gradient(180deg, rgba(87, 78, 58, 0.55), rgba(21, 17, 12, 0.88))',
      }}>
        {url ? (
          <img
            src={url}
            alt={card?.name || ''}
            style={{
              width: '100%',
              height: '100%',
              objectFit: CARD_RENDER_CONFIG.imageObjectFit,
              objectPosition: CARD_RENDER_CONFIG.imageObjectPosition,
              display: 'block',
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 8,
            textAlign: 'center',
            color: '#f4e9cd',
            fontSize: compact ? 11 : width > 66 ? 13 : 12,
            lineHeight: 1.5,
          }}>
            {card?.name || '未知卡牌'}
          </div>
        )}
      </div>
      {showName ? (
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: compact ? '6px 6px 7px' : '8px 8px 9px',
          backgroundImage: 'linear-gradient(180deg, transparent, rgba(4, 3, 2, 0.9))',
          color: '#fff7e6',
          fontSize: compact ? 10 : width > 66 ? 13 : 11,
          lineHeight: 1.4,
          zIndex: 2,
          fontWeight: 700,
        }}>
          {card?.name}
        </div>
      ) : null}
    </div>
  )
}

function formatExecutionActionLabel(action, targetNameMap = {}) {
  if (!action) return ''

  const typeLabelMap = {
    event: '幕后',
    rite: '仪式',
    loot: '掉落池',
    over: '结局',
    card: '卡牌',
  }

  if (action.targetType && action.targetId) {
    const key = `${action.targetType}:${action.targetId}`
    const targetEntry = targetNameMap[key]
    const targetName = typeof targetEntry === 'object' ? targetEntry?.name : targetEntry
    return `${typeLabelMap[action.targetType] || action.targetType}：${targetName || action.targetId}`
  }

  return action.text || action.key || ''
}

function resolvePopCard(pop, executionSlotCards) {
  if (!pop?.slotId) return null
  return executionSlotCards?.[pop.slotId] || null
}

function ExecutionEffectList({ effects, onOpenCard }) {
  if (!effects?.length) return null

  return (
    <div style={styles.effectList}>
      {effects.map((effect, index) => (
        <div key={`${effect.label}:${index}`} style={styles.effectItem}>
          <div style={{ color: '#f1dfbb', fontSize: 13, lineHeight: 1.6 }}>{effect.label}</div>
          {effect.cards?.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {effect.cards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onOpenCard?.(card)}
                  style={styles.effectCardButton}
                >
                  <CardPortrait card={card} compact />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function ExecutionActionBadge({ action, targetData }) {
  const { url } = useResolvedImage(targetData?.image)

  return (
    <div style={styles.effectChip}>
      {url ? <img src={url} alt="" style={{ width: 24, height: 24, borderRadius: 6, objectFit: 'cover', objectPosition: 'center', flexShrink: 0 }} /> : null}
      <span>{formatExecutionActionLabel(action, targetData ? { [`${action.targetType}:${action.targetId}`]: targetData.name } : {})}</span>
    </div>
  )
}

function StoryPopLine({ pop, executionSlotCards }) {
  const card = resolvePopCard(pop, executionSlotCards)

  return (
    <div style={styles.popLine}>
      <div style={{ paddingTop: 2 }}>
        <CardPortrait card={card} compact showName={false} widthOverride={48} />
      </div>
      <div style={{ ...styles.contentBlock, ...styles.text }}>
        {pop.text}
      </div>
    </div>
  )
}

function ConditionGridGroup({ group, selectedId, onSelect }) {
  return (
    <div style={styles.conditionGroup}>
      <div style={{ display: 'grid', gap: 4 }}>
        <div style={styles.headerLabel}>{group.title}</div>
        <div style={{ fontSize: 13, lineHeight: 1.7, color: '#dbc7a1' }}>{group.description}</div>
      </div>
      <div style={styles.conditionOptionList}>
        {group.options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(group.id, option.id === selectedId ? null : option.id)}
            style={option.id === selectedId ? { ...styles.conditionOption, ...styles.conditionOptionActive } : styles.conditionOption}
          >
            <div style={{ fontSize: 14, lineHeight: 1.7, color: '#fff4de', whiteSpace: 'pre-wrap' }}>
              {option.label}
            </div>
            {option.detail ? (
              <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.6, color: '#d8c5a0', whiteSpace: 'pre-wrap' }}>
                {option.detail}
              </div>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  )
}

function ConditionPagerGroup({ group, selectedId, onSelect, onOpenDetail }) {
  const selectedIndex = Math.max(0, group.options.findIndex((option) => option.id === selectedId))
  const activeIndex = selectedId ? selectedIndex : 0
  const activeOption = group.options[activeIndex] || group.options[0]

  function move(delta) {
    if (!group.options.length) return
    const nextIndex = (activeIndex + delta + group.options.length) % group.options.length
    const nextOption = group.options[nextIndex]
    onSelect(group.id, nextOption?.id || null)
  }

  return (
    <div style={styles.conditionGroup}>
      <div style={{ display: 'grid', gap: 4 }}>
        <div style={styles.headerLabel}>{group.title}</div>
        <div style={{ fontSize: 13, lineHeight: 1.7, color: '#dbc7a1' }}>{group.description}</div>
      </div>
      <div style={styles.pagerRow}>
        <button type="button" onClick={() => move(-1)} style={styles.pagerButton}>上一个条件</button>
        <div style={styles.pagerSummary}>
          <div style={{ fontSize: 13, color: '#ccb38e' }}>
            {activeIndex + 1} / {group.options.length}
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.8, color: '#f8edd9', whiteSpace: 'pre-wrap' }}>
            {activeOption?.label}
          </div>
        </div>
        <button type="button" onClick={() => move(1)} style={styles.pagerButton}>下一个条件</button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={() => onOpenDetail(group.id)} style={styles.detailButton}>查看所有条件</button>
      </div>
    </div>
  )
}

export default function ExecutionModal({
  open,
  model,
  settlementBgUrl,
  settlementDiceBgUrl,
  executionSteps,
  executionStepIndex,
  executionSummaryEffects,
  executionSummaryActions,
  executionSummaryPops,
  executionTargetNameMap,
  executionSlotCards,
  executionConditionGroups,
  executionConditionSelections,
  onSelectCondition,
  onOpenCard,
  onOpenAction,
  onAdvance,
  onClose,
}) {
  const [detailGroupId, setDetailGroupId] = useState(null)
  const [detailFilterText, setDetailFilterText] = useState('')

  const detailGroup = useMemo(
    () => executionConditionGroups.find((group) => group.id === detailGroupId) || null,
    [detailGroupId, executionConditionGroups]
  )

  const filteredDetailOptions = useMemo(() => {
    if (!detailGroup) return []
    const keyword = detailFilterText.trim().toLowerCase()
    if (!keyword) return detailGroup.options
    return detailGroup.options.filter((option) => (
      `${option.label || ''} ${option.detail || ''}`.toLowerCase().includes(keyword)
    ))
  }, [detailFilterText, detailGroup])

  if (!open) return null

  const visibleSteps = executionSteps.slice(0, executionStepIndex + 1)
  const hasNextStep = executionStepIndex < executionSteps.length - 1

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.toolbar}>
          <div>
            <div style={{ ...styles.headerLabel, color: '#b88b58' }}>仪式结算</div>
            <div style={{ marginTop: 8, color: '#6a4623', fontSize: 14, lineHeight: 1.7 }}>
              按当前准备状态预览仪式结算。
            </div>
          </div>
          <button type="button" style={styles.closeButton} onClick={onClose}>关闭结算</button>
        </div>

        <div style={styles.bodyShell}>
          <div style={styles.backgroundLayer}>
            {settlementBgUrl ? <img src={settlementBgUrl} alt="" style={styles.backgroundImage} /> : null}
            {settlementDiceBgUrl ? <img src={settlementDiceBgUrl} alt="" style={styles.diceImage} /> : null}
          </div>

          <div style={styles.bodyGrid}>
            <div style={styles.leftPane}>
              <div style={styles.slotPreviewWrap}>
                {(model?.slots || []).map((slot) => {
                  const card = executionSlotCards[slot.id]
                  return (
                    <div key={slot.id} style={styles.slotCard}>
                      <div style={styles.slotLabel}>{slot.id.toUpperCase()}</div>
                      {card ? <CardPortrait card={card} widthOverride={84} /> : <div style={styles.emptySlot}>空槽</div>}
                      <div style={styles.slotName}>{card?.name || slot.text || slot.title}</div>
                    </div>
                  )
                })}
              </div>

              <div style={styles.summaryPanel}>
                <div style={styles.headerLabel}>结算获取</div>
                {executionSummaryEffects.length > 0 ? (
                  <div style={{ marginTop: 12 }}>
                    <ExecutionEffectList effects={executionSummaryEffects} onOpenCard={onOpenCard} />
                  </div>
                ) : null}

                {executionSummaryActions.length > 0 ? (
                  <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {executionSummaryActions.map((action, index) => (
                      <ExecutionActionBadge
                        key={`${action.key}:${action.targetId || ''}:${index}`}
                        action={action}
                        targetData={executionTargetNameMap[`${action.targetType}:${action.targetId}`]}
                      />
                    ))}
                  </div>
                ) : null}

                {executionSummaryPops.length > 0 ? (
                  <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                    {executionSummaryPops.map((pop, index) => (
                      <StoryPopLine key={`${pop.key}:${index}`} pop={pop} executionSlotCards={executionSlotCards} />
                    ))}
                  </div>
                ) : null}

                {executionSummaryEffects.length === 0 && executionSummaryActions.length === 0 && executionSummaryPops.length === 0 ? (
                  <div style={{ marginTop: 12, color: '#cbb391', fontSize: 14, lineHeight: 1.8 }}>
                    当前还没有结算结果，先在右侧推进文本与分支选择。
                  </div>
                ) : null}
              </div>
            </div>

            <div style={styles.rightPane}>
              <div style={styles.headerBlock}>
                <div style={styles.headerLabel}>仪式结算</div>
                <div style={styles.title}>{model?.title}</div>
              </div>

              <div style={styles.conditionsScroll}>
                {executionConditionGroups.map((group) => (
                  group.options.length > 4 ? (
                    <ConditionPagerGroup
                      key={group.id}
                      group={group}
                      selectedId={executionConditionSelections[group.id] || null}
                      onSelect={onSelectCondition}
                      onOpenDetail={setDetailGroupId}
                    />
                  ) : (
                    <ConditionGridGroup
                      key={group.id}
                      group={group}
                      selectedId={executionConditionSelections[group.id] || null}
                      onSelect={onSelectCondition}
                    />
                  )
                ))}
              </div>

              <div style={styles.narrativeScroll}>
                {visibleSteps.map((step) => (
                  <div key={step.id} style={styles.narrativeSection}>
                    <div style={styles.metaTag}>{step.phase}</div>
                    {step.title ? <div style={styles.stepTitle}>{step.title}</div> : null}
                    {step.conditions?.length > 0 ? (
                      <div style={{ ...styles.contentBlock, ...styles.conditionChips }}>
                        {step.conditions.map((condition, index) => (
                          <span key={`${step.id}:condition:${index}`} style={styles.conditionChip}>{condition}</span>
                        ))}
                      </div>
                    ) : null}
                    {step.text ? (
                      <div style={styles.contentBlock}>
                        <div style={styles.text}>{step.text}</div>
                      </div>
                    ) : null}
                    {(step.tips || []).map((tip, index) => (
                      <div key={`${step.id}:tip:${index}`} style={styles.contentBlock}>
                        <div style={styles.tipText}>{tip}</div>
                      </div>
                    ))}
                    {step.effects?.length > 0 ? (
                      <div style={styles.contentBlock}>
                        <ExecutionEffectList effects={step.effects} onOpenCard={onOpenCard} />
                      </div>
                    ) : null}
                    {step.actions?.length > 0 ? (
                      <div style={styles.contentBlock}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {step.actions.map((action, index) => (
                            <button
                              key={`${step.id}:action:${index}`}
                              type="button"
                              onClick={() => onOpenAction?.(action, index)}
                              style={styles.detailButton}
                            >
                              {formatExecutionActionLabel(action, executionTargetNameMap)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {step.popItems?.length > 0 ? (
                      <div style={{ display: 'grid', gap: 10 }}>
                        {step.popItems.map((pop, index) => (
                          <StoryPopLine key={`${step.id}:pop:${index}`} pop={pop} executionSlotCards={executionSlotCards} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div style={styles.footer}>
                <button type="button" style={styles.primaryButton} onClick={hasNextStep ? onAdvance : onClose}>
                  {hasNextStep ? '推进下一步' : '执行完成'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {detailGroup ? (
        <div style={styles.detailOverlay} onClick={() => { setDetailGroupId(null); setDetailFilterText('') }}>
          <div style={styles.detailDialog} onClick={(event) => event.stopPropagation()}>
            <div style={styles.detailHeader}>
              <div>
                <div style={styles.headerLabel}>{detailGroup.title}</div>
                <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7, color: '#dbc7a1' }}>{detailGroup.description}</div>
              </div>
              <button type="button" style={styles.closeButton} onClick={() => { setDetailGroupId(null); setDetailFilterText('') }}>关闭</button>
            </div>
            <div style={styles.detailSearchWrap}>
              <input
                type="text"
                value={detailFilterText}
                onChange={(event) => setDetailFilterText(event.target.value)}
                placeholder="搜索条件"
                style={styles.detailSearchInput}
              />
            </div>
            <div style={styles.detailList}>
              {filteredDetailOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onSelectCondition(detailGroup.id, option.id)
                    setDetailGroupId(null)
                    setDetailFilterText('')
                  }}
                  style={option.id === executionConditionSelections[detailGroup.id]
                    ? { ...styles.conditionOption, ...styles.conditionOptionActive }
                    : styles.conditionOption}
                >
                  <div style={{ fontSize: 14, lineHeight: 1.7, color: '#fff4de', whiteSpace: 'pre-wrap' }}>
                    {option.label}
                  </div>
                  {option.detail ? (
                    <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.6, color: '#d8c5a0', whiteSpace: 'pre-wrap' }}>
                      {option.detail}
                    </div>
                  ) : null}
                </button>
              ))}
              {filteredDetailOptions.length === 0 ? <div style={styles.detailEmpty}>没有匹配当前搜索的条件。</div> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
