import { Coins, Trash2 } from 'lucide-react'
import type {
  NodeArtifact,
  WorkflowNode,
  WorkflowNodeData,
} from '@aiverse/shared/types/workflow'
import {
  getRefSource,
  getSelectedUpstreamNodeId,
  getSelectedStartUpstreamNodeId,
  getSelectedEndUpstreamNodeId,
  hasExplicitSeedanceFrameSelection,
  getDefaultNodeTitle,
  getNodeDisplayName,
  getNodeTypeLabel,
} from './workflowUtils'
import {
  WORKFLOW_IMAGE_MODEL_OPTIONS,
  WORKFLOW_VIDEO_MODEL_OPTIONS,
  calculateWorkflowNodeCost,
} from './workflowPricing'

function deriveNodeTitle(node: WorkflowNode): string {
  return getNodeDisplayName(node)
}

export function NodeSettings(props: {
  node: WorkflowNode
  output?: NodeArtifact | null
  nodeCost?: number
  onOpenOutput?: () => void
  incomingOptions: Array<{ id: string; edgeId: string; order: number; label: string; type: string; targetHandle?: string | null }>
  onPatch: (nodeId: string, patch: Partial<WorkflowNodeData>) => void
  onUpdateInputOrder: (nodeId: string, edgeId: string, fragmentOrder: number) => void
  onDelete: () => void
  onUploadRefs: (node: WorkflowNode, files: FileList | null) => Promise<void>
  onRemoveRef: (node: WorkflowNode, index: number) => void
  isUploading: boolean
}) {
  const { node, output, nodeCost, onOpenOutput, incomingOptions, onPatch, onUpdateInputOrder, onDelete, onUploadRefs, onRemoveRef, isUploading } = props
  const rawImageIncomingOptions = incomingOptions.filter((item) => item.type === 'image.generate')
  const imageIncomingOptions = Array.from(
    new Map(
      rawImageIncomingOptions
        .map((item) => [item.id, item])
    ).values()
  )
  const videoIncomingOptions = incomingOptions
    .filter((item) => item.type === 'video.generate' || item.type === 'video.concat')
    .sort((a, b) => {
      const byOrder = a.order - b.order
      if (byOrder !== 0) return byOrder
      return a.edgeId.localeCompare(b.edgeId)
    })
  const rawRefSource = getRefSource(node)
  const refSource = node.type === 'video.generate' && rawRefSource === 'mixed' ? 'upstream' : rawRefSource
  const selectedUpstreamNodeId = getSelectedUpstreamNodeId(node)
  const selectedStartUpstreamNodeId = getSelectedStartUpstreamNodeId(node)
  const selectedEndUpstreamNodeId = getSelectedEndUpstreamNodeId(node)
  const connectedStartOption = rawImageIncomingOptions.find((item) => String(item.targetHandle || '').toLowerCase() === 'start_image')
  const connectedEndOption = rawImageIncomingOptions.find((item) => String(item.targetHandle || '').toLowerCase() === 'end_image')
  const resolvedSelectedStartUpstreamNodeId = connectedStartOption?.id || selectedStartUpstreamNodeId
  const resolvedSelectedEndUpstreamNodeId = connectedEndOption?.id || selectedEndUpstreamNodeId
  const refImages = Array.isArray(node.data?.ref_images) ? node.data.ref_images : []
  const isGeneratorNode = node.type === 'image.generate' || node.type === 'video.generate'
  const videoModel = node.type === 'video.generate'
    ? String(node.data?.model || 'seedance-1.5-pro')
    : ''
  const imageModel = node.type === 'image.generate'
    ? String(node.data?.model || 'gpt-image-1.5')
    : ''
  const videoMode = node.type === 'video.generate'
    ? String(node.data?.mode || 'i2v')
    : 'i2v'
  const isSeedanceI2V = node.type === 'video.generate'
    && videoModel === 'seedance-1.5-pro'
    && videoMode === 'i2v'
  const maxRefs = node.type === 'image.generate' ? 8 : 2
  const sourceModes = node.type === 'video.generate'
    ? [
      { value: 'upstream', label: 'Из предыдущего нода' },
      { value: 'upload', label: 'Загруженные фото' },
    ]
    : [
      { value: 'upstream', label: 'Из предыдущего нода' },
      { value: 'upload', label: 'Загруженные фото' },
      { value: 'mixed', label: 'Смешанный источник' },
    ]
  const outputImages = output?.type === 'image'
    ? output.image_urls.filter((item) => typeof item === 'string' && item.trim().length > 0)
    : []
  const outputVideo = output?.type === 'video' ? output.video_url : null
  const showSeedanceUploadHints = isSeedanceI2V && refSource === 'upload'

  return (
    <div className="mt-3 space-y-2 text-[11px]">
      {output ? (
        <div className="rounded-xl border border-emerald-400/35 bg-emerald-900/15 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-emerald-100">Результат ноды</p>
            {onOpenOutput ? (
              <button
                className="rounded-md border border-emerald-300/50 bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-100"
                onClick={onOpenOutput}
              >
                Открыть
              </button>
            ) : null}
          </div>

          {output.type === 'image' ? (
            outputImages.length > 0 ? (
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {outputImages.map((url, index) => (
                  <img
                    key={`${url}-${index}`}
                    src={url}
                    alt={`node-output-${index + 1}`}
                    className="h-16 w-full rounded-md border border-emerald-200/20 object-cover"
                  />
                ))}
              </div>
            ) : (
              <p className="mt-1 text-zinc-300">Изображение недоступно</p>
            )
          ) : output.type === 'video' ? (
            outputVideo ? (
              <video
                src={outputVideo}
                controls
                playsInline
                className="mt-2 max-h-52 w-full rounded-md border border-emerald-200/20 bg-black object-contain"
              />
            ) : (
              <p className="mt-1 text-zinc-300">Видео недоступно</p>
            )
          ) : (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-emerald-200/20 bg-black/25 p-2 text-[10px] text-zinc-200">
              {output.text || 'Пустой текст'}
            </pre>
          )}
        </div>
      ) : null}

      <div className="rounded-xl border border-white/10 bg-zinc-900/80 p-2.5">
        <p className="text-xs font-semibold text-zinc-100">{deriveNodeTitle(node)}</p>
        <p className="mt-1 text-[11px] text-zinc-400">{node.id}</p>
      </div>

      <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
        <p className="text-zinc-500">Название ноды</p>
        <input
          className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
          value={String(node.data?.label || '')}
          placeholder={getDefaultNodeTitle(node)}
          onChange={(event) => onPatch(node.id, { label: event.target.value })}
        />
      </label>

      {node.type === 'prompt' ? (
        <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
          <p className="text-zinc-500">Текст промпта</p>
          <textarea
            className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
            value={String(node.data?.text || '')}
            rows={4}
            onChange={(event) => onPatch(node.id, { text: event.target.value })}
          />
        </label>
      ) : null}

      {node.type === 'video.concat' ? (
        <>
          <div className="rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2 text-zinc-300">
            <p className="text-zinc-500">FFmpeg: Соединить видео в один</p>
            <p className="mt-1">Подключите минимум 2 видео-ноды на вход. На выходе будет одно объединенное видео.</p>
            <p className="mt-1 text-zinc-400">Сейчас audio не объединяется, собирается видео-дорожка.</p>
          </div>

          <div className="rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
            <p className="text-zinc-500">Последовательность фрагментов</p>
            {videoIncomingOptions.length > 0 ? (
              <div className="mt-2 space-y-2">
                {videoIncomingOptions.map((item) => (
                  <div key={item.edgeId} className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-black/25 px-2 py-1.5">
                    <span className="text-zinc-200">{item.label}</span>
                    <label className="inline-flex items-center gap-1.5 text-zinc-400">
                      <span>Фрагмент</span>
                      <select
                        className="rounded border border-white/10 bg-black/40 px-1.5 py-0.5 text-zinc-100 outline-none"
                        value={String(item.order + 1)}
                        onChange={(event) => onUpdateInputOrder(node.id, item.edgeId, Number(event.target.value))}
                      >
                        {Array.from({ length: videoIncomingOptions.length }, (_, index) => (
                          <option key={`${item.edgeId}-pos-${index + 1}`} value={index + 1}>
                            {index + 1}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-zinc-400">Подключите видео-ноды для настройки очередности</p>
            )}
          </div>
        </>
      ) : null}

      {isGeneratorNode ? (
        <>
          <div className="rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
            <p className="text-zinc-500">Подключенные предыдущие ноды</p>
            {imageIncomingOptions.length > 0 ? (
              <div className="mt-1 space-y-1">
                {imageIncomingOptions.map((item) => (
                  <p key={item.id} className="text-zinc-200">{item.label}</p>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-zinc-400">Нет подключений</p>
            )}
          </div>

          <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
            <p className="text-zinc-500">Источник фото-референсов</p>
            <select
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
              value={refSource}
              onChange={(event) => onPatch(node.id, {
                ref_source: event.target.value as WorkflowNodeData['ref_source'],
              })}
            >
              {sourceModes.map((mode) => (
                <option key={mode.value} value={mode.value}>{mode.label}</option>
              ))}
            </select>
          </label>

          {(refSource === 'upstream' || refSource === 'mixed') && isSeedanceI2V && imageIncomingOptions.length > 0 ? (
            <>
              <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
                <p className="text-zinc-500">Стартовый кадр: источник-нода</p>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
                  value={resolvedSelectedStartUpstreamNodeId}
                  onChange={(event) => onPatch(node.id, {
                    selected_start_upstream_node_id: event.target.value as WorkflowNodeData['selected_start_upstream_node_id'],
                  })}
                >
                  <option value="auto">Авто (первый доступный)</option>
                  {imageIncomingOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </label>

              <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
                <p className="text-zinc-500">Финальный кадр: источник-нода</p>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
                  value={resolvedSelectedEndUpstreamNodeId}
                  onChange={(event) => onPatch(node.id, {
                    selected_end_upstream_node_id: event.target.value as WorkflowNodeData['selected_end_upstream_node_id'],
                  })}
                >
                  <option value="none">Не использовать</option>
                  {imageIncomingOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          {(refSource === 'upstream' || refSource === 'mixed') && !isSeedanceI2V && imageIncomingOptions.length > 1 ? (
            <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
              <p className="text-zinc-500">Какой предыдущий нод использовать</p>
              <select
                className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
                value={selectedUpstreamNodeId}
                onChange={(event) => onPatch(node.id, {
                  selected_upstream_node_id: event.target.value as WorkflowNodeData['selected_upstream_node_id'],
                })}
              >
                <option value="all">Все подключенные</option>
                {imageIncomingOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
          ) : null}

          {(refSource === 'upload' || refSource === 'mixed') ? (
            <div className="rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-zinc-500">Загруженные фото-референсы</p>
                <span className="text-zinc-400">{refImages.length}/{maxRefs}</span>
              </div>
              {showSeedanceUploadHints ? (
                <div className="mt-2 rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-1.5 text-[10px] text-cyan-100">
                  <p>Для Seedance i2v: 1-е фото это стартовый кадр, 2-е фото это финальный кадр.</p>
                  <p className="mt-1 text-cyan-200/90">Если загрузили в обратном порядке, нажмите кнопку ниже.</p>
                </div>
              ) : null}
              <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border border-cyan-400/60 bg-cyan-500/10 px-2 py-1 text-zinc-100">
                {isUploading ? 'Загрузка...' : 'Добавить фото'}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={isUploading}
                  onChange={async (event) => {
                    await onUploadRefs(node, event.target.files)
                    event.currentTarget.value = ''
                  }}
                />
              </label>

              {refImages.length > 0 ? (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {refImages.map((url, index) => (
                    <div key={`${url}-${index}`} className="relative overflow-hidden rounded-md border border-white/10 bg-black/30">
                      <img src={url} alt={`ref-${index + 1}`} className="h-14 w-full object-cover" />
                      {showSeedanceUploadHints ? (
                        <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[9px] text-cyan-100">
                          {index === 0 ? 'Старт' : 'Финал'}
                        </span>
                      ) : null}
                      <button
                        className="absolute right-1 top-1 rounded bg-black/70 px-1 text-[10px] text-white"
                        onClick={() => onRemoveRef(node, index)}
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-zinc-400">Референсы не добавлены</p>
              )}
              {showSeedanceUploadHints && refImages.length === 1 ? (
                <p className="mt-2 text-[10px] text-zinc-400">Добавьте второе фото, чтобы задать финальный кадр.</p>
              ) : null}
              {showSeedanceUploadHints && refImages.length >= 2 ? (
                <button
                  className="mt-2 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-zinc-100"
                  onClick={() => onPatch(node.id, { ref_images: [refImages[1], refImages[0]] })}
                >
                  Поменять местами старт/финал
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {node.type === 'image.generate' ? (
        <>
          <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
            <p className="text-zinc-500">Модель</p>
            <select
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
              value={imageModel}
              onChange={(event) => {
                const nextModel = event.target.value
                const patch: Partial<WorkflowNodeData> = { model: nextModel }
                if (nextModel === 'gpt-image-1.5') patch.gpt_image_quality = 'medium'
                if (nextModel === 'nanobanana-pro') patch.resolution = '1K'
                if (nextModel === 'nanobanana-2') patch.resolution = '1K'
                onPatch(node.id, patch)
              }}
            >
              {WORKFLOW_IMAGE_MODEL_OPTIONS.map((modelId) => (
                <option key={modelId} value={modelId}>{modelId}</option>
              ))}
            </select>
          </label>

          {imageModel === 'gpt-image-1.5' ? (
            <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
              <p className="text-zinc-500">Качество GPT Image</p>
              <select
                className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
                value={String(node.data?.gpt_image_quality || 'medium')}
                onChange={(event) => onPatch(node.id, { gpt_image_quality: event.target.value as WorkflowNodeData['gpt_image_quality'] })}
              >
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </label>
          ) : null}

          {(imageModel === 'nanobanana-pro' || imageModel === 'nanobanana-2') ? (
            <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
              <p className="text-zinc-500">Разрешение</p>
              <select
                className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
                value={String(node.data?.resolution || '1K')}
                onChange={(event) => onPatch(node.id, { resolution: event.target.value as WorkflowNodeData['resolution'] })}
              >
                <option value="1K">1K</option>
                <option value="2K">2K</option>
                {imageModel === 'nanobanana-2' ? <option value="4K">4K</option> : null}
              </select>
            </label>
          ) : null}

          <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
            <p className="text-zinc-500">Промпт</p>
            <textarea
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
              value={String(node.data?.prompt || '')}
              rows={3}
              onChange={(event) => onPatch(node.id, { prompt: event.target.value })}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
              <p className="text-zinc-500">Формат</p>
              <select
                className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
                value={String(node.data?.aspect_ratio || '3:4')}
                onChange={(event) => onPatch(node.id, { aspect_ratio: event.target.value })}
              >
                <option value="1:1">1:1</option>
                <option value="3:4">3:4</option>
                <option value="4:3">4:3</option>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
              </select>
            </label>

            <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
              <p className="text-zinc-500">Количество</p>
              <input
                type="number"
                min={1}
                max={4}
                className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
                value={Number(node.data?.image_count || 1)}
                onChange={(event) => onPatch(node.id, { image_count: Math.max(1, Math.min(4, Number(event.target.value) || 1)) })}
              />
            </label>
          </div>
        </>
      ) : null}

      {node.type === 'video.generate' ? (
        <>
          <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
            <p className="text-zinc-500">Модель</p>
            <select
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
              value={videoModel}
              onChange={(event) => onPatch(node.id, {
                model: event.target.value as WorkflowNodeData['model'],
                ref_source: 'upstream',
                selected_upstream_node_id: 'all',
                selected_start_upstream_node_id: 'auto',
                selected_end_upstream_node_id: 'none',
                kling_duration: '5',
                kling_sound: false,
              })}
            >
              {WORKFLOW_VIDEO_MODEL_OPTIONS.map((modelId) => (
                <option key={modelId} value={modelId}>{modelId}</option>
              ))}
            </select>
          </label>

          {videoModel === 'seedance-1.5-pro' ? (
            <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
              <p className="text-zinc-500">Режим</p>
              <select
                className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
                value={videoMode}
                onChange={(event) => onPatch(node.id, { mode: event.target.value as WorkflowNodeData['mode'] })}
              >
                <option value="i2v">i2v</option>
                <option value="t2v">t2v</option>
              </select>
            </label>
          ) : null}

          <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
            <p className="text-zinc-500">Промпт</p>
            <textarea
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
              value={String(node.data?.prompt || '')}
              rows={3}
              onChange={(event) => onPatch(node.id, { prompt: event.target.value })}
            />
          </label>

          {videoModel === 'seedance-1.5-pro' ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
                  <p className="text-zinc-500">Длительность</p>
                  <select
                    className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
                    value={String(node.data?.video_duration || '8')}
                    onChange={(event) => onPatch(node.id, { video_duration: event.target.value })}
                  >
                    <option value="4">4s</option>
                    <option value="8">8s</option>
                    <option value="12">12s</option>
                  </select>
                </label>

                <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
                  <p className="text-zinc-500">Разрешение</p>
                  <select
                    className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
                    value={String(node.data?.video_resolution || '720p')}
                    onChange={(event) => onPatch(node.id, { video_resolution: event.target.value })}
                  >
                    <option value="480p">480p</option>
                    <option value="720p">720p</option>
                  </select>
                </label>
              </div>

              <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
                <p className="text-zinc-500">Генерация аудио</p>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
                  value={String(Boolean(node.data?.generate_audio ?? false))}
                  onChange={(event) => onPatch(node.id, { generate_audio: event.target.value === 'true' })}
                >
                  <option value="false">Нет</option>
                  <option value="true">Да</option>
                </select>
              </label>
            </>
          ) : null}

          {(videoModel === 'kling-t2v' || videoModel === 'kling-i2v') ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
                <p className="text-zinc-500">Длительность Kling</p>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
                  value={String(node.data?.kling_duration || '5')}
                  onChange={(event) => onPatch(node.id, { kling_duration: event.target.value })}
                >
                  <option value="5">5s</option>
                  <option value="10">10s</option>
                </select>
              </label>

              <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
                <p className="text-zinc-500">Звук Kling</p>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
                  value={String(Boolean(node.data?.kling_sound ?? false))}
                  onChange={(event) => onPatch(node.id, { kling_sound: event.target.value === 'true' })}
                >
                  <option value="false">Нет</option>
                  <option value="true">Да</option>
                </select>
              </label>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
        <p className="text-zinc-500">Тип</p>
        <p className="mt-0.5 text-zinc-200">{getNodeTypeLabel(node.type)}</p>
      </div>
      <div className="rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
        <p className="text-zinc-500">Оценка стоимости</p>
        <p className="mt-0.5 inline-flex items-center gap-1 text-zinc-200">
          <Coins className="h-3.5 w-3.5 text-yellow-400" />
          {typeof nodeCost === 'number' ? `${nodeCost} токенов` : `${calculateWorkflowNodeCost(node)} токенов`}
        </p>
      </div>

      <button
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-[11px] text-red-200"
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Удалить ноду
      </button>
    </div>
  )
}
