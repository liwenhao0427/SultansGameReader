import { useMemo, useRef, useState } from 'react'
import { useResolvedImage } from '../../../services/imageResolver'
import { CARD_RENDER_CONFIG, getCardFrameHeight, getCardRarityFrameAsset } from '../../../resourceConfig'
import { executionStyles as styles } from './executionStyles'

function resolveCardImageKey(card) {
  if (!card) return null
  if (card.image) return card.image
  if (Array.isArray(card.resource)) return card.resource[0] || null
  return card.resource || null
}

function CardPortrait({ card, showName = true, widthOverride = null }) {
  const { url } = useResolvedImage(resolveCardImageKey(card))
  const { url: rareFrameUrl } = useResolvedImage(getCardRarityFrameAsset(card?.rare))
  const width = widthOverride || 90
  const height = getCardFrameHeight(width)
  const artInset = width >= 90 ? '5px 6px 24px' : '3px 4px 18px'

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: 'rgba(18, 15, 11, 0.92)',
        backgroundImage: rareFrameUrl ? `url("${rareFrameUrl}")` : 'none',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        position: 'relative',
        flexShrink: 0,
        boxShadow: '0 16px 28px rgba(0, 0, 0, 0.28)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: artInset,
          overflow: 'hidden',
          borderRadius: width >= 90 ? 18 : 14,
          background: 'linear-gradient(180deg, rgba(87, 78, 58, 0.55), rgba(21, 17, 12, 0.88))',
        }}
      >
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
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 8,
              textAlign: 'center',
              color: '#f4e9cd',
              fontSize: width >= 90 ? 14 : 12,
              lineHeight: 1.5,
            }}
          >
            {card?.name || '未知卡牌'}
          </div>
        )}
      </div>
      {showName ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: width >= 90 ? '8px 8px 9px' : '6px 6px 7px',
            backgroundImage: 'linear-gradient(180deg, transparent, rgba(4, 3, 2, 0.9))',
            color: '#fff7e6',
            fontSize: width >= 90 ? 13 : 11,
            lineHeight: 1.4,
            zIndex: 2,
            fontWeight: 700,
            textAlign: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
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
          <div style={{ color: '#f1dfbb', fontSize: 13, lineHeight: 1.5 }}>{effect.label}</div>
          {effect.cards?.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {effect.cards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onOpenCard?.(card)
                  }}
                  style={styles.effectCardButton}
                >
                  <CardPortrait card={card} showName={false} widthOverride={52} />
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
      {url ? (
        <img
          src={url}
          alt=""
          style={{ width: 24, height: 24, borderRadius: 6, objectFit: 'cover', objectPosition: 'center', flexShrink: 0 }}
        />
      ) : null}
      <span>{formatExecutionActionLabel(action, targetData ? { [`${action.targetType}:${action.targetId}`]: targetData.name } : {})}</span>
    </div>
  )
}

function StoryPopLine({ pop, executionSlotCards }) {
  const card = resolvePopCard(pop, executionSlotCards)

  return (
    <div style={styles.popLine}>
      <div style={{ paddingTop: 2 }}>
        <CardPortrait card={card} showName={false} widthOverride={48} />
      </div>
      <div style={{ ...styles.contentBlock, ...styles.text }}>
        {pop.text}
      </div>
    </div>
  )
}

function LegacyConditionGridGroup({ group, selectedId, onSelect }) {
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

function LegacyConditionPagerGroup({ group, selectedId, onSelect, onOpenDetail }) {
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

function LegacyInlineChoiceStep({ group, selectedId, onSelect, onOpenDetail }) {
  if (!group) return null

  return group.options.length > 4 ? (
    <ConditionPagerGroup
      group={group}
      selectedId={selectedId}
      onSelect={onSelect}
      onOpenDetail={onOpenDetail}
    />
  ) : (
    <ConditionGridGroup
      group={group}
      selectedId={selectedId}
      onSelect={onSelect}
    />
  )
}

function truncateConditionLabel(text, maxLength = 10) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim()
  if (!raw) return ''
  return raw.length > maxLength ? `${raw.slice(0, maxLength)}…` : raw
}

function ConditionGroupIntro({ group }) {
  return (
    <div style={styles.conditionIntro}>
      <div style={styles.headerLabel}>{group.title}</div>
    </div>
  )
}

function ConditionGridGroup({ group, selectedId, onSelect }) {
  return (
    <div style={styles.conditionGroup}>
      <ConditionGroupIntro group={group} />
      <div style={styles.conditionOptionList}>
        {group.options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(group.id, option.id === selectedId ? null : option.id)}
            style={option.id === selectedId ? { ...styles.conditionOption, ...styles.conditionOptionActive } : styles.conditionOption}
          >
            <div style={styles.conditionOptionLabel} title={option.fullLabel || option.label}>
              {truncateConditionLabel(option.label)}
            </div>
            {option.hiddenCount > 0 ? (
              <div style={styles.conditionOptionHint}>另有 {option.hiddenCount} 条条件</div>
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
      <ConditionGroupIntro group={group} />
      <div style={styles.pagerRow}>
        <button type="button" onClick={() => move(-1)} style={styles.pagerButton}>{'<'}</button>
        <button type="button" onClick={() => onOpenDetail(group.id)} style={styles.pagerSummaryButton}>
          <div style={{ fontSize: 13, color: '#ccb38e' }}>
            {activeIndex + 1} / {group.options.length}
          </div>
          <div style={styles.pagerSummaryLabel} title={activeOption?.fullLabel || activeOption?.label || ''}>
            {truncateConditionLabel(activeOption?.label)}
          </div>
          <div style={styles.conditionOptionHint}>
            {activeOption?.hiddenCount > 0 ? `点击查看全部，另有 ${activeOption.hiddenCount} 条条件` : '点击查看全部条件'}
          </div>
        </button>
        <button type="button" onClick={() => move(1)} style={styles.pagerButton}>{'>'}</button>
      </div>
    </div>
  )
}

function InlineChoiceStep({ group, selectedId, onSelect, onOpenDetail }) {
  if (!group) return null

  return group.options.length > 4 ? (
    <ConditionPagerGroup
      group={group}
      selectedId={selectedId}
      onSelect={onSelect}
      onOpenDetail={onOpenDetail}
    />
  ) : (
    <ConditionGridGroup
      group={group}
      selectedId={selectedId}
      onSelect={onSelect}
    />
  )
}

export default function ExecutionModal({
  open,
  model,
  settlementBgUrl,
  settlementDiceBgUrl,
  executionSteps,
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
  onClose,
}) {
  const [detailGroupId, setDetailGroupId] = useState(null)
  const [detailFilterText, setDetailFilterText] = useState('')
  const scrollRef = useRef(null)

  const detailGroup = useMemo(
    () => executionConditionGroups.find((group) => group.id === detailGroupId) || null,
    [detailGroupId, executionConditionGroups]
  )

  const filteredDetailOptions = useMemo(() => {
    if (!detailGroup) return []
    const keyword = detailFilterText.trim().toLowerCase()
    if (!keyword) return detailGroup.options
    return detailGroup.options.filter((option) => (
      `${option.fullLabel || option.label || ''} ${option.detail || ''}`.toLowerCase().includes(keyword)
    ))
  }, [detailFilterText, detailGroup])

  if (!open) return null

  const visibleSteps = executionSteps
  const stackedCards = (model?.slots || [])
    .map((slot) => executionSlotCards?.[slot.id])
    .filter(Boolean)
    .slice(0, 5)

  function handleSelectAndResume(groupId, optionId) {
    onSelectCondition(groupId, optionId)
  }

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
                {stackedCards.map((card, index) => (
                  <button
                    key={`${card.id || card.name}-${index}`}
                    type="button"
                    style={{
                      ...styles.slotPreviewCardButton,
                      left: `${index * 56}px`,
                      top: `${index % 2 === 0 ? 0 : 10}px`,
                      zIndex: 10 + index,
                      transform: `rotate(${15 + index * 1.5}deg)`,
                    }}
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpenCard?.(card, index)
                    }}
                  >
                    <CardPortrait card={card} widthOverride={96} />
                  </button>
                ))}
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

              <div
                ref={scrollRef}
                style={styles.narrativeScroll}
              >
                {visibleSteps.map((step, index) => {
                  const previousStep = visibleSteps[index - 1] || null
                  const hideRepeatedConditionInfo = step.kind === 'result' && previousStep?.kind === 'choice'

                  return (
                  <div key={step.id} style={styles.narrativeSection}>
                    {!hideRepeatedConditionInfo && step.phase ? <div style={styles.metaTag}>{step.phase}</div> : null}
                    {step.title ? <div style={styles.stepTitle}>{step.title}</div> : null}
                    {!hideRepeatedConditionInfo && step.conditions?.length > 0 ? (
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
                    {step.kind === 'choice' ? (
                      <InlineChoiceStep
                        group={executionConditionGroups.find((group) => group.id === step.groupId)}
                        selectedId={executionConditionSelections[step.groupId] || null}
                        onSelect={handleSelectAndResume}
                        onOpenDetail={setDetailGroupId}
                      />
                    ) : null}
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
                )})}
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
                    handleSelectAndResume(detailGroup.id, option.id)
                    setDetailGroupId(null)
                    setDetailFilterText('')
                  }}
                  style={option.id === executionConditionSelections[detailGroup.id]
                    ? { ...styles.conditionOption, ...styles.conditionOptionActive }
                    : styles.conditionOption}
                >
                  <div style={{ fontSize: 14, lineHeight: 1.7, color: '#fff4de', whiteSpace: 'pre-wrap' }}>
                    {option.fullLabel || option.label}
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
