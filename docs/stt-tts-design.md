# STT/TTS 语音交互设计方案

> **状态**: 草案  
> **日期**: 2026-02-16  
> **作者**: Coder  
> **目标**: 为 friend agent 框架设计语音输入输出能力

---

## 1. 概述

### 1.1 目标

为 friend agent 添加语音交互能力：
- **STT (Speech-to-Text)**: 语音转文字，让用户可以用说话与 agent 交互
- **TTS (Text-to-Speech)**: 文字转语音，让 agent 用声音回应用户

### 1.2 设计原则

1. **本地优先**: 优先支持本地运行，保护隐私
2. **云端可选**: 支持云服务作为高质量备选
3. **低延迟**: 实时交互需要快速响应（STT < 1s, TTS < 500ms）
4. **多语言**: 支持中文、英文等主流语言
5. **模块化**: 支持多种 STT/TTS 提供者，易于扩展

---

## 2. STT (Speech-to-Text) 方案

### 2.1 技术选型对比

| 方案 | 类型 | 延迟 | 质量 | 成本 | 隐私 | 中文支持 |
|------|------|------|------|------|------|----------|
| **Whisper (本地)** | 本地 | 1-5s | ⭐⭐⭐⭐⭐ | 免费 | ✅ 完全本地 | ⭐⭐⭐⭐⭐ |
| Whisper.cpp | 本地 | 0.5-2s | ⭐⭐⭐⭐⭐ | 免费 | ✅ 完全本地 | ⭐⭐⭐⭐⭐ |
| Vosk | 本地 | <500ms | ⭐⭐⭐ | 免费 | ✅ 完全本地 | ⭐⭐⭐ |
| OpenAI Whisper API | 云端 | 2-5s | ⭐⭐⭐⭐⭐ | $0.006/min | ⚠️ 数据上传 | ⭐⭐⭐⭐⭐ |
| Google Speech-to-Text | 云端 | 1-2s | ⭐⭐⭐⭐ | $0.006/min | ⚠️ 数据上传 | ⭐⭐⭐⭐ |
| Azure Speech | 云端 | 1-2s | ⭐⭐⭐⭐ | $1/hr | ⚠️ 数据上传 | ⭐⭐⭐⭐⭐ |

### 2.2 推荐方案：Whisper 本地 + 云端备选

#### 2.2.1 主方案：Whisper 本地

**优势**:
- 完全本地，隐私保护
- 免费使用
- 高质量转录
- 支持多语言（中英文效果优秀）

**实现选项**:

```typescript
// 方案 A: 使用 OpenAI Whisper Node.js 绑定
import whisper from 'whisper-node';

const whisperClient = new whisper.Whisper('base'); // tiny/base/small/medium/large

async function transcribe(audioBuffer: Buffer): Promise<string> {
  const result = await whisperClient.transcribe(audioBuffer);
  return result;
}

// 方案 B: 使用 whisper.cpp (更快)
import { WhisperCpp } from 'whisper-cpp-node';

const whisper = new WhisperCpp({
  modelPath: './models/ggml-base.bin',
  language: 'zh',
});

async function transcribe(audioBuffer: Buffer): Promise<string> {
  return await whisper.transcribe(audioBuffer);
}
```

#### 2.2.2 备选方案：云端 STT

当本地资源不足或需要更高精度时，使用云服务：

```typescript
// OpenAI Whisper API
async function transcribeWithOpenAI(audioPath: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData, // audio file
  });
  return response.json();
}
```

### 2.3 STT 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      Audio Input                            │
│  (Microphone / Audio File / WebSocket Stream)               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   Audio Preprocessing                        │
│  - Resampling (16kHz)                                        │
│  - Noise Reduction (optional)                                │
│  - VAD (Voice Activity Detection)                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              STT Provider Interface                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ WhisperLocal │  │ WhisperAPI   │  │ GoogleSTT    │       │
│  │ (Primary)    │  │ (Fallback)   │  │ (Optional)   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   Transcribed Text                           │
│  → Send to agent for processing                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. TTS (Text-to-Speech) 方案

### 3.1 技术选型对比

| 方案 | 类型 | 延迟 | 质量 | 成本 | 中文 | 自然度 |
|------|------|------|------|------|------|--------|
| **Piper TTS** | 本地 | <200ms | ⭐⭐⭐ | 免费 | ⭐⭐⭐ | 中等 |
| **Edge TTS** | 云端 | 300-500ms | ⭐⭐⭐⭐ | 免费 | ⭐⭐⭐⭐⭐ | 高 |
| OpenAI TTS | 云端 | 500ms | ⭐⭐⭐⭐⭐ | $15/1M chars | ⭐⭐⭐ | 极高 |
| Azure Neural | 云端 | 300ms | ⭐⭐⭐⭐⭐ | $15/1M chars | ⭐⭐⭐⭐⭐ | 极高 |
| Google Cloud TTS | 云端 | 300ms | ⭐⭐⭐⭐ | $4/1M chars | ⭐⭐⭐⭐ | 高 |
| elevenlabs | 云端 | 500ms | ⭐⭐⭐⭐⭐ | $5/1M chars | ⭐⭐⭐ | 极高 |

### 3.2 推荐方案：Edge TTS (免费) + OpenAI TTS (高质量备选)

#### 3.2.1 主方案：Edge TTS

**优势**:
- 完全免费
- 高质量神经网络语音
- 支持多种中文语音（xiaoxiao, yunxi, yunjian 等）
- 低延迟（300-500ms）

**实现**:

```typescript
// 使用 edge-tts
import { EdgeTTS } from 'edge-tts';

const tts = new EdgeTTS();

async function synthesize(text: string, voice: string = 'zh-CN-XiaoxiaoNeural'): Promise<Buffer> {
  const audio = await tts.synthesize({
    text,
    voice,
    rate: '+0%',  // 语速
    pitch: '+0Hz', // 音调
  });
  return audio;
}

// 可用的中文语音:
// - zh-CN-XiaoxiaoNeural (晓晓, 女声, 温暖)
// - zh-CN-YunxiNeural (云希, 男声, 活力)
// - zh-CN-YunjianNeural (云健, 男声, 专业)
// - zh-CN-XiaoyiNeural (晓伊, 女声, 甜美)
```

#### 3.2.2 备选方案：OpenAI TTS

高质量语音合成：

```typescript
// OpenAI TTS API
async function synthesizeWithOpenAI(text: string, voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'alloy'): Promise<Buffer> {
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice,
      response_format: 'mp3',
    }),
  });
  return Buffer.from(await response.arrayBuffer());
}
```

#### 3.2.3 本地方案：Piper TTS

隐私优先，完全本地：

```typescript
import { PiperTTS } from 'piper-tts-node';

const piper = new PiperTTS('./models/zh_CN-huayan-medium.onnx');

async function synthesizeLocal(text: string): Promise<Buffer> {
  return await piper.synthesize(text);
}
```

### 3.3 TTS 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Response                           │
│  (Text to speak)                                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                Text Preprocessing                            │
│  - Text chunking (for long responses)                       │
│  - SSML formatting (optional)                               │
│  - Emoji/symbol handling                                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              TTS Provider Interface                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ EdgeTTS      │  │ OpenAI TTS   │  │ PiperTTS     │       │
│  │ (Primary)    │  │ (High Quality)│  │ (Local)      │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Audio Output                              │
│  - Stream to speaker                                         │
│  - Save to file                                              │
│  - WebSocket stream to client                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 接口设计

### 4.1 STT 接口

```typescript
// packages/server/src/agent/stt/types.ts

export interface STTProvider {
  readonly id: string;
  readonly name: string;
  
  /**
   * Transcribe audio to text
   * @param audio - Audio buffer (WAV/MP3/OGG)
   * @param options - Transcription options
   */
  transcribe(audio: Buffer, options?: STTOptions): Promise<STTResult>;
  
  /**
   * Stream transcription (real-time)
   */
  stream?(options?: STTStreamOptions): STTStream;
}

export interface STTOptions {
  language?: string;        // 'zh' | 'en' | 'auto'
  model?: string;           // 'tiny' | 'base' | 'small' | 'medium'
  prompt?: string;          // Context prompt for better accuracy
}

export interface STTResult {
  text: string;
  language?: string;
  confidence?: number;
  segments?: STTSegment[];
  duration?: number;  // Processing time in ms
}

export interface STTSegment {
  start: number;   // Start time in seconds
  end: number;     // End time in seconds
  text: string;
}

export interface STTStream {
  write(chunk: Buffer): void;
  onResult(callback: (result: STTResult) => void): void;
  end(): void;
}
```

### 4.2 TTS 接口

```typescript
// packages/server/src/agent/tts/types.ts

export interface TTSProvider {
  readonly id: string;
  readonly name: string;
  readonly voices: VoiceInfo[];
  
  /**
   * Synthesize text to speech
   * @param text - Text to synthesize
   * @param options - Synthesis options
   */
  synthesize(text: string, options?: TTSOptions): Promise<TTSResult>;
  
  /**
   * Stream synthesis (for long text)
   */
  stream?(text: string, options?: TTSOptions): AsyncIterable<Buffer>;
}

export interface VoiceInfo {
  id: string;
  name: string;
  language: string;
  gender?: 'male' | 'female' | 'neutral';
  preview?: string;  // URL to preview audio
}

export interface TTSOptions {
  voice?: string;       // Voice ID
  rate?: number;        // Speech rate (-100 to 100)
  pitch?: number;       // Pitch adjustment (-100 to 100)
  format?: 'mp3' | 'wav' | 'ogg';
}

export interface TTSResult {
  audio: Buffer;
  format: string;
  duration?: number;  // Duration in seconds
}
```

### 4.3 统一管理器

```typescript
// packages/server/src/agent/voice/manager.ts

export interface VoiceManagerConfig {
  stt: {
    provider: 'whisper-local' | 'whisper-api' | 'google' | 'auto';
    fallbackProvider?: string;
    language?: string;
    model?: string;
  };
  tts: {
    provider: 'edge' | 'openai' | 'piper' | 'auto';
    fallbackProvider?: string;
    voice?: string;
    rate?: number;
  };
}

export class VoiceManager {
  private sttProviders: Map<string, STTProvider>;
  private ttsProviders: Map<string, TTSProvider>;
  private config: VoiceManagerConfig;
  
  constructor(config: VoiceManagerConfig);
  
  // STT Methods
  transcribe(audio: Buffer, options?: STTOptions): Promise<STTResult>;
  startStreamingTranscription(): STTStream;
  
  // TTS Methods
  synthesize(text: string, options?: TTSOptions): Promise<TTSResult>;
  getVoices(): VoiceInfo[];
  setVoice(voiceId: string): void;
  
  // Provider Management
  registerSTTProvider(provider: STTProvider): void;
  registerTTSProvider(provider: TTSProvider): void;
  setSTTProvider(id: string): void;
  setTTSProvider(id: string): void;
}
```

---

## 5. 实现计划

### 5.1 Phase 1: 基础实现（2-3 天）

**文件结构**:
```
packages/server/src/agent/voice/
├── index.ts              # 导出
├── manager.ts            # VoiceManager
├── stt/
│   ├── types.ts          # STT 接口定义
│   ├── whisper-local.ts  # 本地 Whisper
│   ├── whisper-api.ts    # OpenAI Whisper API
│   └── index.ts          # STT 导出
└── tts/
    ├── types.ts          # TTS 接口定义
    ├── edge-tts.ts       # Edge TTS
    ├── openai-tts.ts     # OpenAI TTS
    ├── piper.ts          # Piper TTS (可选)
    └── index.ts          # TTS 导出
```

**任务**:
1. 创建 STT/TTS 类型定义
2. 实现 Whisper 本地 STT
3. 实现 Edge TTS
4. 创建 VoiceManager

### 5.2 Phase 2: 集成与优化（1-2 天）

**任务**:
1. 集成到 AgentManager
2. 添加配置支持
3. 实现流式处理
4. 性能优化

### 5.3 Phase 3: 前端集成（1-2 天）

**任务**:
1. WebSocket 语音流传输
2. 前端录音组件
3. 音频播放组件
4. UI 集成

---

## 6. 配置示例

```typescript
// friend 配置文件
{
  "voice": {
    "enabled": true,
    "stt": {
      "provider": "whisper-local",
      "model": "base",
      "language": "auto"
    },
    "tts": {
      "provider": "edge",
      "voice": "zh-CN-XiaoxiaoNeural",
      "rate": 0
    }
  }
}
```

---

## 7. API Key 管理

```typescript
// 存储在 authStorage 中
interface VoiceApiKeys {
  openai?: string;    // OpenAI Whisper/TTS
  google?: string;    // Google Speech/TTS
  azure?: string;     // Azure Speech
  elevenlabs?: string; // ElevenLabs TTS
}

// 通过工具配置
tools: [
  {
    name: 'configure_voice',
    description: 'Configure STT/TTS providers and API keys',
    parameters: {
      provider: { type: 'string' },
      apiKey: { type: 'string' },
    }
  }
]
```

---

## 8. 成本估算

### 8.1 本地方案（免费）

| 组件 | 提供者 | 成本 |
|------|--------|------|
| STT | Whisper 本地 | 免费 |
| TTS | Edge TTS | 免费 |
| **总计** | | **$0** |

### 8.2 云端方案

| 使用量 | OpenAI | Azure | Google |
|--------|--------|-------|--------|
| 1 小时语音输入 | $0.36 | $1.00 | $0.36 |
| 10 万字输出 | $1.50 | $1.50 | $0.40 |
| **月均（重度使用）** | ~$5-10 | ~$5-10 | ~$2-5 |

---

## 9. 安全与隐私

### 9.1 本地方案
- ✅ 音频数据完全本地处理
- ✅ 无网络传输
- ✅ 满足最高隐私要求

### 9.2 云端方案
- ⚠️ 音频数据上传到云端
- ⚠️ 需要用户授权
- ⚠️ 建议在配置中明确告知

### 9.3 混合方案
- 默认本地处理
- 云端作为可选的高质量备选
- 用户自主选择

---

## 10. 未来扩展

### 10.1 短期
- [ ] 实时语音对话模式
- [ ] 多说话人识别
- [ ] 情感识别

### 10.2 中期
- [ ] 自定义语音克隆
- [ ] 多语言实时翻译
- [ ] 语音情感合成

### 10.3 长期
- [ ] 端到端语音对话（跳过文本中间层）
- [ ] 本地模型微调
- [ ] 低功耗设备优化

---

## 11. 参考资料

- [OpenAI Whisper](https://github.com/openai/whisper)
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp)
- [Edge TTS](https://github.com/rany2/edge-tts)
- [Piper TTS](https://github.com/rhasspy/piper)
- [OpenAI TTS API](https://platform.openai.com/docs/api-reference/audio)
- [Azure Speech Services](https://azure.microsoft.com/en-us/products/cognitive-services/speech-services)
