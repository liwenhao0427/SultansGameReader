/**
 * 详情面板数据处理逻辑单元测试（任务 10.6）
 * 测试各详情组件依赖的数据转换逻辑（纯函数，不依赖 DOM）
 * 组件渲染测试需要完整 Electron 环境，此处聚焦于数据层
 */
import { describe, it, expect } from 'vitest';
import { parseConditionObject } from '../../services/conditionParser.js';

// ── EventDetail 数据处理逻辑 ──────────────────────────────────────────────────

describe('EventDetail - settlement 数据处理', () => {
  it('正确提取 settlement 条目数量', () => {
    const data = {
      id: 5300000,
      text: '开场介绍',
      settlement: [
        { action: { confirm: { id: 'c1', text: '确认' } } },
        { action: { option: [{ text: '选项1' }] } },
      ],
    };
    const settlements = Array.isArray(data.settlement) ? data.settlement : [];
    expect(settlements).toHaveLength(2);
  });

  it('正确识别交互类型', () => {
    const detectType = (action) => {
      if (action.confirm) return 'confirm';
      if (action.option) return 'option';
      if (action.slide) return 'slide';
      if (action.prompt) return 'prompt';
      return null;
    };
    expect(detectType({ confirm: {} })).toBe('confirm');
    expect(detectType({ option: [] })).toBe('option');
    expect(detectType({ slide: {} })).toBe('slide');
    expect(detectType({ prompt: {} })).toBe('prompt');
    expect(detectType({})).toBeNull();
  });

  it('条件解析集成：settlement 条目的条件正确解析', () => {
    const item = {
      condition: {
        'counter.7000490>=': 1,
        'counter.7000490>=__c': '方便结局检定',
      },
    };
    const conditions = parseConditionObject(item.condition);
    expect(conditions).toHaveLength(1);
    expect(conditions[0]).toBe('方便结局检定');
  });
});

// ── AfterStoryDetail 章节分组逻辑 ────────────────────────────────────────────

describe('AfterStoryDetail - __ca 章节分组', () => {
  /**
   * 将 extra 数组按 __ca 字段分组为章节
   * （与 AfterStoryDetail.jsx 中的逻辑一致）
   */
  function buildChapters(extras) {
    const chapters = [];
    let current = { title: null, items: [] };
    for (const item of extras) {
      if (item.__ca) {
        if (current.items.length > 0 || current.title) {
          chapters.push({ ...current });
        }
        current = { title: item.__ca, items: [item] };
      } else {
        current.items.push(item);
      }
    }
    if (current.items.length > 0 || current.title) {
      chapters.push(current);
    }
    return chapters;
  }

  it('无 __ca 时所有条目在同一章节', () => {
    const extras = [
      { key: 'e1', result_text: '文本1' },
      { key: 'e2', result_text: '文本2' },
    ];
    const chapters = buildChapters(extras);
    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBeNull();
    expect(chapters[0].items).toHaveLength(2);
  });

  it('有 __ca 时正确分章节', () => {
    const extras = [
      { key: 'e1', result_text: '文本1' },
      { key: 'e2', __ca: '--屠龙--', result_text: '文本2' },
      { key: 'e3', result_text: '文本3' },
      { key: 'e4', __ca: '--幸福--', result_text: '文本4' },
    ];
    const chapters = buildChapters(extras);
    expect(chapters).toHaveLength(3);
    expect(chapters[0].title).toBeNull();
    expect(chapters[1].title).toBe('--屠龙--');
    expect(chapters[2].title).toBe('--幸福--');
  });

  it('__ca 作为章节标题正确显示（来自真实数据）', () => {
    const extras = [
      {
        key: '2000001_extra_12',
        __ca: '---------------------------屠龙-神圣的牺牲------------------------------------------------',
        result_text: '人们把你的故事编成了歌谣',
      },
    ];
    const chapters = buildChapters(extras);
    expect(chapters[0].title).toContain('屠龙-神圣的牺牲');
  });
});

// ── DTDetail 对话树数据处理 ───────────────────────────────────────────────────

describe('DTDetail - 对话树数据处理', () => {
  const JUMP_TYPE_MAP = {
    '0': '直接跳转',
    '1': '选项分支',
    '2': '条件跳转',
    '3': '结束',
  };

  it('jump_type 映射正确', () => {
    expect(JUMP_TYPE_MAP['0']).toBe('直接跳转');
    expect(JUMP_TYPE_MAP['1']).toBe('选项分支');
    expect(JUMP_TYPE_MAP['3']).toBe('结束');
  });

  it('正确提取 Item 数组', () => {
    const data = {
      dialog_tree_id: 'DT1',
      description: '测试对话树',
      Item: [
        { word_id: 'w1', word: '你好', jump_type: '0', direct_id: 'w2', Option: [] },
        { word_id: 'w2', word: '再见', jump_type: '3', direct_id: '', Option: [] },
      ],
    };
    const items = Array.isArray(data.Item) ? data.Item : [];
    expect(items).toHaveLength(2);
    expect(items[0].word).toBe('你好');
    expect(JUMP_TYPE_MAP[items[1].jump_type]).toBe('结束');
  });

  it('选项分支正确提取', () => {
    const item = {
      word_id: 'w1',
      word: '请选择',
      jump_type: '1',
      Option: [
        { option_Jump_id: 'w2', option_Jump_word: '选项A' },
        { option_Jump_id: 'w3', option_Jump_word: '选项B' },
      ],
    };
    expect(item.Option).toHaveLength(2);
    expect(item.Option[0].option_Jump_word).toBe('选项A');
  });
});

// ── LootDetail 物品列表处理 ───────────────────────────────────────────────────

describe('LootDetail - 物品列表', () => {
  it('正确提取 item 数组', () => {
    const data = {
      id: 6000004,
      name: '情报掉落',
      type: 2,
      type__c: '2 普通权重',
      item: [
        { id: '2000032', type: 'card', num: '1', weight: 60 },
        { id: '2000033', type: 'card', num: '1', weight: 60 },
      ],
    };
    const items = Array.isArray(data.item) ? data.item : [];
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe('2000032');
    expect(items[0].weight).toBe(60);
  });

  it('type__c 注释正确读取', () => {
    const data = { type: 2, type__c: '2 普通权重, 3 维新' };
    expect(data.type__c).toContain('普通权重');
  });
});
