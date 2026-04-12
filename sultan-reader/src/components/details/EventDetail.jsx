import { useEffect, useMemo, useRef, useState } from 'react'
import { useResolvedImage } from '../../services/imageResolver'
import { adaptStoryData } from '../../services/storyAdapter'
import useConfigStore from '../../stores/useConfigStore'
import useCanvasStore from '../../stores/useCanvasStore'
import { linkNodesOnCanvas, mountNodeOnCanvas } from '../../services/graphNavigation'

const AUTO_CANVAS_LIMIT = 3

function collectFollowupActions(node, collector = []) {
  if (!node || typeof node !== 'object') return collector

  ;(node.actions || []).forEach((action) => {
    if (!action?.targetType || !action?.targetId) return
    if (!['rite', 'event', 'loot', 'over'].includes(action.targetType)) return
    collector.push(action)
  })

  ;(node.choices || []).forEach((choice) => {
    if (choice?.branch) collectFollowupActions(choice.branch, collector)
  })

  return collector
}

function dedupeActions(actions = []) {
  const map = new Map()
  actions.forEach((action, index) => {
    const key = [
      action.targetType,
      action.targetId,
      action.branch || 'direct',
      action.key || '',
      action.text || '',
    ].join('|')
    if (!map.has(key)) {
      map.set(key, { ...action, _dedupeIndex: index })
    }
  })
  return Array.from(map.values())
}

function normalizeTextContent(text) {
  if (text == null) return ''
  if (typeof text === 'string') return text
  if (Array.isArray(text)) return text.map((item) => normalizeTextContent(item)).filter(Boolean).join('\n\n')
  if (typeof text === 'object') {
    if (typeof text.text === 'string') return text.text
    if (typeof text.result_text === 'string') return text.result_text
    if (typeof text.tips_text === 'string') return text.tips_text
  }
  return String(text)
}

function EventChoiceButton({ option, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={active ? { ...S.choiceButton, ...S.choiceButtonActive } : S.choiceButton}
    >
      <div style={S.choiceId}>{option.tag || option.id || '选项'}</div>
      <div style={S.choiceText}>{option.text || '未命名选项'}</div>
    </button>
  )
}

function EventFigure({ card, index, total }) {
  const { url, loading } = useResolvedImage(card?.image)
  const width = total > 1 ? 172 : 208

  return (
    <div
      style={{
        ...S.figureWrap,
        width,
        right: `${index * 96}px`,
        zIndex: total - index,
      }}
    >
      {loading ? (
        <div style={S.figureFallback}>载入中…</div>
      ) : url ? (
        <img src={url} alt={card?.name || ''} style={S.figureImage} />
      ) : (
        <div style={S.figureFallback}>{card?.name || '角色'}</div>
      )}
    </div>
  )
}

export default function EventDetail({ data }) {
  const cardsLite = useConfigStore((s) => s.cardsLite)
  const cardsById = useConfigStore((s) => s.cardsById)
  const contentNameMap = useConfigStore((s) => s.contentNameMap)
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId)
  const model = useMemo(() => adaptStoryData('event', data, cardsLite, cardsById), [cardsLite, cardsById, data])
  const [choicePath, setChoicePath] = useState([])
  const autoMountedEventIdRef = useRef(null)

  useEffect(() => {
    setChoicePath([])
    autoMountedEventIdRef.current = null
  }, [data?.id])

  const eventNodeHistory = useMemo(() => {
    if (!model?.eventFlow) return []

    const history = []
    let currentNode = model.eventFlow
    history.push(currentNode)

    for (const choiceTag of choicePath) {
      const nextChoice = currentNode?.choices?.find((choice) => choice.tag === choiceTag)
      if (!nextChoice?.branch) break
      currentNode = nextChoice.branch
      history.push(currentNode)
    }

    return history
  }, [choicePath, model?.eventFlow])

  const currentEventNode = eventNodeHistory[eventNodeHistory.length - 1] || model?.eventFlow || null

  const visibleSections = useMemo(() => (
    eventNodeHistory.map((node, depth) => ({
      id: `${node?.id || 'event'}:${depth}`,
      texts: [
        ...(node?.promptEntries || []).map((entry) => normalizeTextContent(entry.text)).filter(Boolean),
        normalizeTextContent(node?.option?.text),
      ].filter(Boolean),
      choices: node?.choices || [],
      effects: node?.effects || [],
    }))
  ), [eventNodeHistory])

  const visualCards = useMemo(() => {
    const allCards = [
      ...(currentEventNode?.relatedCards || []),
      ...(model?.eventFlow?.relatedCards || []),
      model?.fallbackCharacterCard || null,
    ].filter(Boolean)

    const unique = new Map()
    allCards.forEach((card) => {
      const key = String(card.id || card.name || Math.random())
      if (!unique.has(key)) unique.set(key, card)
    })
    return Array.from(unique.values()).slice(0, 3)
  }, [currentEventNode?.relatedCards, model?.eventFlow?.relatedCards, model?.fallbackCharacterCard])

  const followupActions = useMemo(
    () => dedupeActions(collectFollowupActions(model?.eventFlow || null)),
    [model?.eventFlow]
  )

  const resolvedFollowupActions = useMemo(() => (
    followupActions.map((action) => {
      const key = `${action.targetType}:${action.targetId}`
      const mapped = contentNameMap?.[key] || null
      return {
        ...action,
        displayLabel: summarizeFollowupAction(action, mapped),
      }
    })
  ), [contentNameMap, followupActions])

  const autoFollowupActions = useMemo(
    () => [...resolvedFollowupActions].sort(() => Math.random() - 0.5).slice(0, AUTO_CANVAS_LIMIT),
    [resolvedFollowupActions]
  )

  useEffect(() => {
    if (!data?.id || autoFollowupActions.length === 0) return
    if (autoMountedEventIdRef.current === data.id) return

    autoMountedEventIdRef.current = data.id
    autoFollowupActions.forEach((action, index) => {
      void mountNodeOnCanvas(
        { id: action.targetId, type: action.targetType, name: action.displayLabel || action.text },
        { x: 460 + index * 60, y: 180 + index * 50 },
        { autoSelect: false, expandRelations: false }
      ).then((targetNodeKey) => {
        if (!targetNodeKey || !selectedNodeId) return
        linkNodesOnCanvas(
          selectedNodeId,
          action.targetType,
          action.targetId,
          action.branch === 'success' ? 'success' : action.branch === 'failed' ? 'failed' : 'default',
          action.text
        )
      })
    })
  }, [autoFollowupActions, data?.id, selectedNodeId])

  function handleSelectChoice(choiceTag, depth) {
    setChoicePath((current) => {
      const prefix = current.slice(0, depth)
      if (current[depth] === choiceTag) return prefix
      return [...prefix, choiceTag]
    })
  }

  async function handleOpenAction(action, offsetIndex = 0) {
    if (!action?.targetType || !action?.targetId) return

    const targetNodeKey = await mountNodeOnCanvas(
      { id: action.targetId, type: action.targetType, name: action.displayLabel || action.text },
      { x: 460 + offsetIndex * 60, y: 180 + offsetIndex * 50 },
      { autoSelect: true, expandRelations: false }
    )

    if (targetNodeKey && selectedNodeId) {
      linkNodesOnCanvas(
        selectedNodeId,
        action.targetType,
        action.targetId,
        action.branch === 'success' ? 'success' : action.branch === 'failed' ? 'failed' : 'default',
        action.text
      )
    }
  }

  if (!model) return null

  return (
    <div style={S.shell}>
      <div style={S.heroLayer}>
        {visualCards.map((card, index) => (
          <EventFigure key={`${card.id || card.name}:${index}`} card={card} index={index} total={visualCards.length} />
        ))}
      </div>

      <div style={S.header}>
        <div style={S.title}>{model.title}</div>
        {model.meta.length > 0 ? (
          <div style={S.metaRow}>
            {model.meta.map((item) => (
              <span key={item} style={S.metaChip}>{item}</span>
            ))}
          </div>
        ) : null}
      </div>

      <div style={S.contentColumn}>
        {visibleSections.length > 0 ? visibleSections.map((section, depth) => (
          <div key={section.id} style={S.flowSection}>
            {section.texts.map((text, index) => (
              <div key={`${section.id}:text:${index}`} style={index === section.texts.length - 1 ? S.leadParagraph : S.paragraph}>
                {text}
              </div>
            ))}

            {section.effects.length > 0 ? (
              <div style={S.effectRow}>
                {section.effects.map((effect, index) => (
                  <span key={`${section.id}:effect:${effect.type}:${index}`} style={S.effectChip}>{effect.label}</span>
                ))}
              </div>
            ) : null}

            {section.choices.length > 0 ? (
              <div style={S.choiceList}>
                {section.choices.map((choice) => (
                  <EventChoiceButton
                    key={`${section.id}:${choice.id}`}
                    option={choice}
                    active={choicePath[depth] === choice.tag}
                    onSelect={() => handleSelectChoice(choice.tag, depth)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )) : (
          <div style={S.emptyText}>这个幕后没有可直接阅读的正文，主要承担触发与分支作用。</div>
        )}

        {resolvedFollowupActions.length > 0 ? (
          <div style={S.followupSection}>
            <div style={S.followupTitle}>后续节点</div>
            <div style={S.followupHint}>
              默认会随机带出最多 3 个后续节点到画布，这里仍然可以手动继续打开。
            </div>
            <div style={S.followupList}>
              {resolvedFollowupActions.map((action, index) => (
                <button
                  key={`${action.targetType}:${action.targetId}:${index}`}
                  type="button"
                  style={S.followupButton}
                  onClick={() => handleOpenAction(action, index)}
                >
                  {action.targetType === 'rite' ? '仪式' : action.targetType === 'event' ? '幕后' : '结局'}：{action.displayLabel}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function summarizeFollowupAction(action, mappedTarget) {
  if (mappedTarget) {
    if (action.targetType === 'event') {
      return mappedTarget.text || mappedTarget.name || mappedTarget.title || String(action.targetId)
    }
    return mappedTarget.name || mappedTarget.title || mappedTarget.text || String(action.targetId)
  }

  if (action.targetType === 'event' && action.text && !action.text.includes('event_on')) {
    return action.text
  }

  return String(action.targetId || action.text || '')
}

const S = {
  shell: {
    position: 'relative',
    minHeight: 520,
    padding: '6px 0 120px',
    overflow: 'visible',
  },
  heroLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 'min(36%, 320px)',
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  figureWrap: {
    position: 'absolute',
    right: 0,
    bottom: 8,
    height: '70%',
    minHeight: 280,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    opacity: 0.26,
  },
  figureImage: {
    height: '100%',
    width: '100%',
    objectFit: 'contain',
    objectPosition: 'bottom center',
    display: 'block',
    filter: 'drop-shadow(0 20px 28px rgba(0, 0, 0, 0.42))',
  },
  figureFallback: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(241, 232, 213, 0.42)',
    fontSize: 12,
  },
  header: {
    position: 'relative',
    zIndex: 1,
  },
  title: {
    color: '#fff1d6',
    fontSize: 36,
    fontWeight: 800,
    lineHeight: 1.08,
    letterSpacing: '-0.02em',
  },
  metaRow: {
    marginTop: 10,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaChip: {
    padding: '4px 10px',
    borderRadius: 999,
    background: 'rgba(212, 184, 126, 0.08)',
    color: '#d9be88',
    fontSize: 11,
    lineHeight: 1.4,
  },
  contentColumn: {
    position: 'relative',
    zIndex: 1,
    marginTop: 18,
    display: 'grid',
    gap: 18,
    alignContent: 'start',
    overflow: 'visible',
    paddingRight: 24,
  },
  flowSection: {
    display: 'grid',
    gap: 12,
  },
  paragraph: {
    color: '#f1e8d5',
    fontSize: 17,
    lineHeight: 1.95,
    whiteSpace: 'pre-wrap',
    textShadow: '0 2px 8px rgba(8, 6, 4, 0.82)',
  },
  leadParagraph: {
    color: '#fff4df',
    fontSize: 18,
    lineHeight: 1.95,
    whiteSpace: 'pre-wrap',
    textShadow: '0 2px 8px rgba(8, 6, 4, 0.82)',
  },
  effectRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  effectChip: {
    padding: '5px 10px',
    borderRadius: 999,
    background: 'rgba(212, 184, 126, 0.08)',
    color: '#d8bd89',
    fontSize: 12,
    lineHeight: 1.5,
  },
  choiceList: {
    display: 'grid',
    gap: 10,
    marginTop: 4,
  },
  choiceButton: {
    width: '100%',
    textAlign: 'left',
    padding: '12px 14px',
    borderRadius: 14,
    border: '1px solid rgba(212, 184, 126, 0.18)',
    background: 'rgba(22, 17, 12, 0.46)',
    color: '#f2e8d7',
    cursor: 'pointer',
    transition: 'border-color 120ms ease, background 120ms ease, transform 120ms ease',
  },
  choiceButtonActive: {
    border: '1px solid rgba(221, 196, 136, 0.42)',
    background: 'rgba(64, 48, 30, 0.56)',
    transform: 'translateX(6px)',
  },
  choiceId: {
    color: 'rgba(217, 190, 136, 0.72)',
    fontSize: 11,
    marginBottom: 4,
    letterSpacing: '0.08em',
  },
  choiceText: {
    fontSize: 15,
    lineHeight: 1.7,
  },
  followupSection: {
    marginTop: 10,
    display: 'grid',
    gap: 10,
  },
  followupTitle: {
    color: '#f0d6a0',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.08em',
  },
  followupHint: {
    color: 'rgba(241, 232, 213, 0.56)',
    fontSize: 12,
    lineHeight: 1.7,
  },
  followupList: {
    display: 'grid',
    gap: 8,
  },
  followupButton: {
    width: '100%',
    textAlign: 'left',
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(212, 184, 126, 0.14)',
    background: 'rgba(24, 18, 12, 0.58)',
    color: '#efe2c7',
    fontSize: 14,
    lineHeight: 1.6,
    cursor: 'pointer',
  },
  emptyText: {
    color: 'rgba(241, 232, 213, 0.72)',
    fontSize: 15,
    lineHeight: 1.85,
    whiteSpace: 'pre-wrap',
  },
}
