/* DeepSeek API 接入：设置、病例点评、连通性测试（离线时由本地评分兜底） */
(function (root) {
  'use strict';
  const BQ = (root.BQ = root.BQ || {});
  const CONFIG = BQ.Config.CONFIG;
  const Questions = BQ.Questions;
  const STORAGE_KEY = 'bq.ai.settings';

  function defaults() {
    return JSON.parse(JSON.stringify(CONFIG.ai));
  }

  function getSettings() {
    const settings = defaults();
    try {
      const raw = root.localStorage.getItem(STORAGE_KEY);
      if (raw) Object.assign(settings, JSON.parse(raw));
    } catch (err) {
      /* localStorage 不可用时使用默认值 */
    }
    return settings;
  }

  function saveSettings(patch) {
    const settings = Object.assign(getSettings(), patch || {});
    try {
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (err) {
      /* ignore */
    }
    return settings;
  }

  function isConfigured(settings) {
    const s = settings || getSettings();
    if (s.mode === 'offline') return false;
    if (s.mode === 'proxy') return !!s.proxyUrl;
    return !!s.key && !!s.baseUrl;
  }

  function modeLabel(settings) {
    const s = settings || getSettings();
    if (s.mode === 'proxy') return '本地代理';
    if (s.mode === 'direct') return '直连 DeepSeek';
    return '离线本地评分';
  }

  function endpoint(settings) {
    const s = settings || getSettings();
    if (s.mode === 'proxy') {
      return s.proxyUrl || '/api/chat';
    }
    return String(s.baseUrl || 'https://api.deepseek.com').replace(/\/+$/, '') + '/chat/completions';
  }

  async function postChat(payload, settings) {
    const s = settings || getSettings();
    const controller = new AbortController();
    const timer = setTimeout(function () {
      controller.abort();
    }, Math.max(2000, Number(s.timeoutMs) || 12000));
    const headers = { 'Content-Type': 'application/json' };
    if (s.mode === 'direct') {
      headers.Authorization = 'Bearer ' + s.key;
    }
    let response;
    try {
      response = await fetch(endpoint(s), {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (err) {
      clearTimeout(timer);
      if (err && err.name === 'AbortError') throw new Error('API 请求超时');
      throw new Error('API 请求失败：' + (err.message || '网络错误'));
    }
    clearTimeout(timer);
    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch (err) {
      data = null;
    }
    if (!response.ok) {
      const message = data && (data.error && (data.error.message || data.error) || data.message)
        ? (data.error && data.error.message ? data.error.message : data.message || String(data.error))
        : text.slice(0, 200);
      throw new Error('API 返回 ' + response.status + '：' + message);
    }
    if (!data) throw new Error('API 返回了无法解析的内容');
    if (data.error) {
      throw new Error(data.error.message || String(data.error));
    }
    const choice = data.choices && data.choices[0];
    if (!choice) throw new Error('API 返回缺少 choices');
    const message = choice.message || {};
    return message.content != null ? message.content : choice.text || '';
  }

  function parseJsonLoose(text) {
    if (!text) return null;
    let cleaned = String(text).trim();
    cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch (err) {
      return null;
    }
  }

  function buildJudgeMessages(caseData, answer) {
    const diagnoses = caseData.diagnoses.map(function (option) {
      return '    - [' + option.id + '] ' + option.text + (option.correct ? '（推荐诊断）' : '');
    }).join('\n');
    const checks = caseData.checks.map(function (option) {
      return '    - [' + option.id + '] ' + option.text + (option.points >= 10 ? '（关键检查）' : '（帮助有限）');
    }).join('\n');
    const prescriptions = caseData.prescriptions.map(function (option) {
      return '    - [' + option.id + '] ' + option.text + (option.points >= 25 ? '（推荐处方）' : '');
    }).join('\n');
    const data = answer || {};
    const chosenDiagnosis = caseData.diagnoses.find(function (item) {
      return item.id === data.diagnosisId;
    }) || null;
    const chosenChecks = caseData.checks.filter(function (item) {
      return Array.isArray(data.checkIds) && data.checkIds.indexOf(item.id) >= 0;
    });
    const chosenPrescription = caseData.prescriptions.find(function (item) {
      return item.id === data.prescriptionId;
    }) || null;
    const userText = String(data.text || '').slice(0, 800);
    return [
      {
        role: 'system',
        content: [
          '你是「大肥鱼历险记」的 AI 认知诊疗助手，面向大学生普及 AI 知识。',
          '玩家正在处理一个 AI 使用病例：先诊断问题，再选择检查方式，最后开出处方。',
          '请只评价玩家的「处方 / 解释」质量，输出严格 JSON，不要输出任何额外文字。',
          'JSON 结构：{"score": 0-100 的整数, "feedback": "80 字以内的中文点评", "axes": {"knowledge":0-5,"critical":0-5,"practice":0-5,"privacy":0-5,"prompt":0-5,"teaching":0-5,"reliance":0-5}}',
          'score 代表处方质量：是否具体、可执行、说明原因、能防止问题再次发生；不要因为诊断或检查选错而重复扣分。',
          'axes 含义：knowledge=对 AI 原理的理解，critical=批判性验证，practice=动手实践，privacy=隐私安全意识，prompt=提示词能力，teaching=科普传播意愿，reliance=对 AI 的盲目依赖（越高越危险）。',
          '评分标准：只喊口号、把责任推给 AI 或让 AI「保证」的处方给低分；有验证步骤、兜底方案、能向同学解释清楚的给高分。',
          '不要直接泄露标准答案，点评要具体、鼓励思考。'
        ].join('\n')
      },
      {
        role: 'user',
        content: [
          '病例：' + caseData.title + '（' + caseData.topic + '）',
          '场景：' + caseData.scenario,
          '诊断选项：',
          diagnoses,
          '检查选项：',
          checks,
          '处方选项：',
          prescriptions,
          '玩家诊断：' + (chosenDiagnosis ? chosenDiagnosis.id + ' ' + chosenDiagnosis.text : '（未选择）'),
          '玩家检查：' + (chosenChecks.length
            ? chosenChecks.map(function (item) { return item.id + ' ' + item.text; }).join('；')
            : '（未选择）'),
          '玩家处方：' + (chosenPrescription ? chosenPrescription.id + ' ' + chosenPrescription.text : '（未选择）'),
          '玩家补充说明：' + (userText || '（无）'),
          '知识点提示：' + caseData.explain
        ].join('\n')
      }
    ];
  }

  async function judge(caseData, answer, options) {
    const opts = options || {};
    const settings = opts.settings || getSettings();
    if (!isConfigured(settings)) {
      return { ok: false, error: '未配置 API，使用本地评分', settings: settings };
    }
    try {
      const content = await postChat({
        model: settings.model || 'deepseek-chat',
        messages: buildJudgeMessages(caseData, answer),
        temperature: 0.2,
        max_tokens: 500,
        stream: false
      }, settings);
      const parsed = parseJsonLoose(content);
      if (!parsed) {
        return { ok: false, error: 'AI 点评返回格式异常，已使用本地评分', settings: settings, raw: content };
      }
      const judged = Questions.normalizeJudged(caseData, parsed);
      judged.source = 'deepseek';
      judged.raw = content;
      return { ok: true, judged: judged, settings: settings };
    } catch (err) {
      return { ok: false, error: err.message || 'AI 点评失败', settings: settings };
    }
  }

  async function testConnection(settingsOverride) {
    const settings = settingsOverride || getSettings();
    if (settings.mode === 'offline') {
      return { ok: false, error: '当前是离线模式，不需要连接 API' };
    }
    try {
      const content = await postChat({
        model: settings.model || 'deepseek-chat',
        messages: [
          { role: 'user', content: '只回复两个字：OK' }
        ],
        temperature: 0,
        max_tokens: 8,
        stream: false
      }, settings);
      return { ok: true, text: String(content || '').slice(0, 40) };
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  }

  BQ.AI = {
    getSettings: getSettings,
    saveSettings: saveSettings,
    isConfigured: isConfigured,
    modeLabel: modeLabel,
    endpoint: endpoint,
    judge: judge,
    testConnection: testConnection
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
