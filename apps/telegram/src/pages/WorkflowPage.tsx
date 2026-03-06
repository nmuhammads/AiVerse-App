import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addEdge,
  Background,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Clock3,
  PanelLeft,
  PanelRight,
  Pause,
  Play,
  Plus,
  Save,
  Shapes,
} from 'lucide-react'
import { toast } from 'sonner'
import { getAuthHeaders } from '@/hooks/useTelegram'
import type {
  NodeArtifact,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeData,
} from '@aiverse/shared/types/workflow'
import {
  createWorkflowTemplate,
  deleteWorkflowTemplate,
  getWorkflowRun,
  listWorkflowTemplates,
  patchWorkflowTemplate,
  startWorkflowRun,
} from '@/lib/workflowsApi'
import { getDefaultWorkflowGraph, useWorkflowStore } from '@/store/workflowStore'
import {
  type FlowNodeData,
  NODE_LIBRARY,
  graphToFlowNodes,
  graphToFlowEdges,
  flowToGraph,
  styleEdge,
  validateBeforeRun,
  getNodeDisplayName,
} from '@/components/workflow/workflowUtils'
import { WorkflowNodeCard } from '@/components/workflow/WorkflowNodeCard'
import { NodeSettings } from '@/components/workflow/NodeSettings'
import { BottomSheet } from '@/components/workflow/BottomSheet'
import { MobileHeaderMenu } from '@/components/workflow/MobileHeaderMenu'
import { NodeResultModal } from '@/components/workflow/NodeResultModal'
import { WorkflowResultsOverlay } from '@/components/workflow/WorkflowResultsOverlay'
import { TemplateListModal } from '@/components/workflow/TemplateListModal'
import { resolvedPlatform } from '@/utils/platform'

type MobileSheet = 'none' | 'library' | 'inspector' | 'rename'

const DEFAULT_WORKFLOW_NAME = 'Пайплайн фото в видео'

function cloneGraph(graph: WorkflowGraph): WorkflowGraph {
  return {
    nodes: graph.nodes.map((node) => ({
      ...node,
      position: node.position ? { ...node.position } : undefined,
      data: node.data ? { ...node.data } : undefined,
    })),
    edges: graph.edges.map((edge) => ({
      ...edge,
      data: edge.data ? { ...edge.data } : undefined,
    })),
  }
}

export default function WorkflowPage() {
  const nodeTypes = useMemo(() => ({ workflow: WorkflowNodeCard }), [])

  const {
    graph,
    selectedNodeId,
    dirty,
    templates,
    activeTemplateId,
    activeRunId,
    runStatus,
    run,
    setGraph,
    setSelectedNodeId,
    setDirty,
    setTemplates,
    setActiveTemplateId,
    setActiveRun,
    setRun,
    updateNodeData,
  } = useWorkflowStore()

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRunningAction, setIsRunningAction] = useState(false)
  const [uploadingNodeId, setUploadingNodeId] = useState<string | null>(null)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showInspector, setShowInspector] = useState(false)
  const [activeMobileSheet, setActiveMobileSheet] = useState<MobileSheet>('none')
  const [workflowName, setWorkflowName] = useState(DEFAULT_WORKFLOW_NAME)
  const [isMobileViewport, setIsMobileViewport] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 1024 : false))
  const [templateRenameId, setTemplateRenameId] = useState<number | null>(null)
  const [templateRenameValue, setTemplateRenameValue] = useState('')
  const [templateDeleteId, setTemplateDeleteId] = useState<number | null>(null)
  const [isTemplateActionLoading, setIsTemplateActionLoading] = useState(false)
  const [renameDraftValue, setRenameDraftValue] = useState('')
  const [inspectorMaxHeight, setInspectorMaxHeight] = useState<number | null>(null)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [isResultsOverlayOpen, setIsResultsOverlayOpen] = useState(false)
  const [nodeResultNodeId, setNodeResultNodeId] = useState<string | null>(null)

  const isGraphSyncingRef = useRef(false)
  const workflowCanvasRef = useRef<HTMLElement | null>(null)
  const lastAutoOpenedRunIdRef = useRef<number | null>(null)
  const isRunning = runStatus === 'running' || runStatus === 'queued'
  const aboveTabbarClass = resolvedPlatform === 'android' ? 'above-tabbar-android' : 'above-tabbar-ios'
  const tabbarOffsetVar = resolvedPlatform === 'android' ? 'var(--tabbar-offset-android)' : 'var(--tabbar-offset-ios)'

  const handleOpenNodeResult = useCallback((nodeId: string) => {
    const artifact = run?.node_states?.[nodeId]?.output
    if (!artifact) return
    setNodeResultNodeId(nodeId)
  }, [run])

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>(
    graphToFlowNodes(graph, selectedNodeId, run, { onOpenNodeResult: handleOpenNodeResult })
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(graphToFlowEdges(graph, isRunning))

  useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth < 1024)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!isMobileViewport) {
      setActiveMobileSheet('none')
    }
  }, [isMobileViewport])

  useEffect(() => {
    if (!isMobileViewport) {
      setInspectorMaxHeight(null)
      return
    }

    const measureInspectorHeight = () => {
      const canvas = workflowCanvasRef.current
      if (!canvas) return

      const canvasTop = Math.max(0, canvas.getBoundingClientRect().top)
      const probe = document.createElement('div')
      probe.className = aboveTabbarClass
      probe.style.position = 'fixed'
      probe.style.left = '0'
      probe.style.bottom = '0'
      probe.style.visibility = 'hidden'
      probe.style.pointerEvents = 'none'
      document.body.appendChild(probe)
      const bottomOffset = Number.parseFloat(window.getComputedStyle(probe).bottom || '0') || 0
      document.body.removeChild(probe)

      const available = Math.round(window.innerHeight - canvasTop - bottomOffset)
      setInspectorMaxHeight(Math.max(320, available))
    }

    measureInspectorHeight()
    window.addEventListener('resize', measureInspectorHeight)
    window.addEventListener('scroll', measureInspectorHeight, { passive: true })
    return () => {
      window.removeEventListener('resize', measureInspectorHeight)
      window.removeEventListener('scroll', measureInspectorHeight)
    }
  }, [aboveTabbarClass, isMobileViewport])

  const loadTemplates = useCallback(async () => {
    setIsLoading(true)
    try {
      const items = await listWorkflowTemplates()
      setTemplates(items)

      if (items.length > 0) {
        const first = items[0]
        setActiveTemplateId(first.id)
        setGraph(cloneGraph(first.graph))
        setWorkflowName(first.name)
        setSelectedNodeId(first.graph.nodes[0]?.id || null)
        setDirty(false)
      } else {
        const defaultGraph = cloneGraph(getDefaultWorkflowGraph())
        setActiveTemplateId(null)
        setGraph(defaultGraph)
        setWorkflowName(DEFAULT_WORKFLOW_NAME)
        setSelectedNodeId(defaultGraph.nodes[0]?.id || null)
        setDirty(true)
      }
    } catch (error) {
      console.error('[Workflow] Failed to load templates:', error)
      toast.error(error instanceof Error ? error.message : 'Не удалось загрузить workflows')
    } finally {
      setIsLoading(false)
    }
  }, [setActiveTemplateId, setDirty, setGraph, setSelectedNodeId, setTemplates])

  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  useEffect(() => {
    isGraphSyncingRef.current = true
    setNodes(graphToFlowNodes(graph, selectedNodeId, run, { onOpenNodeResult: handleOpenNodeResult }))
    setEdges(graphToFlowEdges(graph, isRunning))
    const timer = window.setTimeout(() => {
      isGraphSyncingRef.current = false
    }, 0)

    return () => window.clearTimeout(timer)
  }, [graph, handleOpenNodeResult, isRunning, run, selectedNodeId, setEdges, setNodes])

  useEffect(() => {
    if (isGraphSyncingRef.current) return
    if (nodes.some((node) => node.dragging)) return
    const nextGraph = flowToGraph(nodes, edges)
    if (JSON.stringify(nextGraph) === JSON.stringify(graph)) return
    setGraph(nextGraph)
    setDirty(true)
  }, [edges, graph, nodes, setDirty, setGraph])

  const selectedNode = useMemo(() => graph.nodes.find((node) => node.id === selectedNodeId) || null, [graph.nodes, selectedNodeId])
  const selectedNodeOutput = selectedNode ? run?.node_states?.[selectedNode.id]?.output ?? null : null
  const nodeResultArtifact = nodeResultNodeId ? run?.node_states?.[nodeResultNodeId]?.output ?? null : null
  const nodeResultNodeLabel = useMemo(() => {
    if (!nodeResultNodeId) return ''
    const source = graph.nodes.find((item) => item.id === nodeResultNodeId)
    return source ? getNodeDisplayName(source) : nodeResultNodeId
  }, [graph.nodes, nodeResultNodeId])
  const runOutputEntries = useMemo(() => {
    if (!run?.outputs) return []
    const nodesById = new Map(graph.nodes.map((node) => [node.id, node]))
    return Object.entries(run.outputs).map(([nodeId, artifact]) => {
      const source = nodesById.get(nodeId)
      return {
        nodeId,
        nodeLabel: source ? getNodeDisplayName(source) : nodeId,
        artifact: artifact as NodeArtifact,
      }
    })
  }, [graph.nodes, run?.outputs])
  const hasRunOutputs = runOutputEntries.length > 0
  const selectedNodeIncomingOptions = useMemo(() => {
    if (!selectedNode) return []
    return graph.edges
      .filter((edge) => edge.target === selectedNode.id)
      .map((edge, index) => {
        const source = graph.nodes.find((node) => node.id === edge.source)
        return {
          id: edge.source,
          edgeId: edge.id,
          order: Number(edge.data?.order ?? index),
          label: source ? `${getNodeDisplayName(source)} (${source.id})` : edge.source,
          type: source?.type || 'image.generate',
        }
      })
      .sort((a, b) => {
        const byOrder = a.order - b.order
        if (byOrder !== 0) return byOrder
        return a.edgeId.localeCompare(b.edgeId)
      })
  }, [graph.edges, graph.nodes, selectedNode])

  const handleUpdateInputOrder = useCallback((nodeId: string, edgeId: string, fragmentOrder: number) => {
    const targetEdges = graph.edges
      .filter((edge) => edge.target === nodeId)
      .sort((a, b) => {
        const byOrder = Number(a.data?.order ?? 0) - Number(b.data?.order ?? 0)
        if (byOrder !== 0) return byOrder
        return a.id.localeCompare(b.id)
      })

    const currentIndex = targetEdges.findIndex((edge) => edge.id === edgeId)
    if (currentIndex < 0) return

    const desiredIndex = Math.max(0, Math.min(targetEdges.length - 1, Math.floor(fragmentOrder) - 1))
    if (desiredIndex === currentIndex) return

    const reordered = [...targetEdges]
    const [movedEdge] = reordered.splice(currentIndex, 1)
    reordered.splice(desiredIndex, 0, movedEdge)

    const orderByEdgeId = new Map<string, number>()
    reordered.forEach((edge, index) => {
      orderByEdgeId.set(edge.id, index)
    })

    const nextEdges = graph.edges.map((edge) => {
      const nextOrder = orderByEdgeId.get(edge.id)
      if (nextOrder === undefined) return edge
      return {
        ...edge,
        data: {
          ...edge.data,
          order: nextOrder,
        },
      }
    })

    setGraph({
      ...graph,
      edges: nextEdges,
    })
    setDirty(true)
  }, [graph, setDirty, setGraph])

  const progressValue = Math.max(0, Math.min(100, Number(run?.progress || 0)))
  const terminalRun = run?.status === 'completed' || run?.status === 'failed' || run?.status === 'cancelled'
  const runError = run?.error?.message || null

  useEffect(() => {
    if (!activeRunId) return

    let cancelled = false
    const poll = async () => {
      try {
        const latestRun = await getWorkflowRun(activeRunId)
        if (cancelled) return
        setRun(latestRun)

        if (latestRun.status === 'completed') {
          toast.success('Workflow завершен')
          window.clearInterval(interval)
          setIsRunningAction(false)
        } else if (latestRun.status === 'failed' || latestRun.status === 'cancelled') {
          toast.error(latestRun.error?.message || 'Workflow завершился с ошибкой')
          window.clearInterval(interval)
          setIsRunningAction(false)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[Workflow] Poll run failed:', error)
        }
      }
    }

    void poll()
    const interval = window.setInterval(() => {
      void poll()
    }, 2500)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [activeRunId, setRun])

  useEffect(() => {
    if (run?.status !== 'completed' || !run.id) return
    if (!run.outputs || Object.keys(run.outputs).length === 0) return
    if (lastAutoOpenedRunIdRef.current === run.id) return
    lastAutoOpenedRunIdRef.current = run.id
    setIsResultsOverlayOpen(true)
  }, [run])

  useEffect(() => {
    if (!nodeResultNodeId) return
    if (nodeResultArtifact) return
    setNodeResultNodeId(null)
  }, [nodeResultArtifact, nodeResultNodeId])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return

      const incomingCount = edges.filter((edge) => edge.target === connection.target).length
      const nextEdge: Edge = styleEdge(
        {
          id: `${connection.source}-${connection.target}-${Date.now()}`,
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle,
          type: 'smoothstep',
          data: { order: incomingCount },
        },
        isRunning
      )

      setEdges((currentEdges) => addEdge(nextEdge, currentEdges))
    },
    [edges, isRunning, setEdges]
  )

  const handleNodeClick = useCallback(
    (_: unknown, node: Node<FlowNodeData>) => {
      setSelectedNodeId(node.id)
      if (isMobileViewport) {
        setActiveMobileSheet('inspector')
        return
      }
      setShowInspector(true)
    },
    [isMobileViewport, setSelectedNodeId]
  )

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [setSelectedNodeId])

  const handleToggleLibrary = () => {
    if (isMobileViewport) {
      setActiveMobileSheet((value) => (value === 'library' ? 'none' : 'library'))
      return
    }
    setShowLibrary((value) => !value)
  }

  const handleToggleInspector = () => {
    if (isMobileViewport) {
      setActiveMobileSheet((value) => (value === 'inspector' ? 'none' : 'inspector'))
      return
    }
    setShowInspector((value) => !value)
  }

  const handleAddNode = (type: WorkflowNode['type']) => {
    const nodeId = `${type.replace('.', '-')}-${Date.now()}`
    const baseData: WorkflowNodeData =
      type === 'prompt'
        ? { text: '' }
        : type === 'image.generate'
          ? {
            model: 'gpt-image-1.5',
            aspect_ratio: '3:4',
            image_count: 1,
            prompt: '',
            ref_source: 'upstream',
            selected_upstream_node_id: 'all',
            ref_images: [],
          }
          : type === 'video.concat'
            ? {
            }
          : {
            model: 'seedance-1.5-pro',
            mode: 'i2v',
            video_duration: '8',
            video_resolution: '720p',
            prompt: '',
            ref_source: 'upstream',
            selected_upstream_node_id: 'all',
            selected_start_upstream_node_id: 'auto',
            selected_end_upstream_node_id: 'none',
            ref_images: [],
          }

    const nextGraph: WorkflowGraph = {
      ...graph,
      nodes: [
        ...graph.nodes,
        {
          id: nodeId,
          type,
          position: { x: 80 + graph.nodes.length * 42, y: 80 + graph.nodes.length * 56 },
          data: baseData,
        },
      ],
    }

    setGraph(nextGraph)
    setSelectedNodeId(nodeId)
    setDirty(true)
    if (isMobileViewport) {
      setActiveMobileSheet('inspector')
    } else {
      setShowInspector(true)
    }
  }

  const handleDeleteSelectedNode = () => {
    if (!selectedNodeId) return
    const nextGraph: WorkflowGraph = {
      nodes: graph.nodes.filter((node) => node.id !== selectedNodeId),
      edges: graph.edges.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId),
    }
    setGraph(nextGraph)
    setSelectedNodeId(null)
    setDirty(true)
  }

  const fileToDataUrl = useCallback((file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
      reader.readAsDataURL(file)
    })
  }, [])

  const handleUploadNodeRefs = useCallback(
    async (node: WorkflowNode, files: FileList | null) => {
      if (!files || files.length === 0) return
      const limit = node.type === 'image.generate' ? 8 : 2
      const currentRefs = Array.isArray(node.data?.ref_images)
        ? node.data.ref_images.filter((item) => typeof item === 'string' && item.trim().length > 0)
        : []
      const freeSlots = Math.max(0, limit - currentRefs.length)
      if (freeSlots === 0) {
        toast.error(`Достигнут лимит референсов (${limit})`)
        return
      }

      const picked = Array.from(files).slice(0, freeSlots)
      setUploadingNodeId(node.id)

      try {
        const uploadedUrls: string[] = []
        for (const file of picked) {
          const dataUrl = await fileToDataUrl(file)
          const res = await fetch('/api/chat/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
            body: JSON.stringify({ image: dataUrl }),
          })
          const payload = await res.json().catch(() => null)
          if (!res.ok || !payload?.url) {
            throw new Error(payload?.error || `Upload failed (${res.status})`)
          }
          uploadedUrls.push(String(payload.url))
        }

        const nextRefs = [...currentRefs, ...uploadedUrls]
        updateNodeData(node.id, { ref_images: nextRefs })
        toast.success(`Загружено ${uploadedUrls.length} референсов`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Ошибка загрузки референсов')
      } finally {
        setUploadingNodeId(null)
      }
    },
    [fileToDataUrl, updateNodeData]
  )

  const handleRemoveNodeRef = useCallback(
    (node: WorkflowNode, index: number) => {
      const refs = Array.isArray(node.data?.ref_images) ? node.data.ref_images : []
      const nextRefs = refs.filter((_, idx) => idx !== index)
      updateNodeData(node.id, { ref_images: nextRefs })
    },
    [updateNodeData]
  )

  const closeMobileSheet = useCallback(() => {
    setActiveMobileSheet('none')
  }, [])

  const closeTemplateModal = useCallback(() => {
    setIsTemplateModalOpen(false)
    setTemplateRenameId(null)
    setTemplateRenameValue('')
    setTemplateDeleteId(null)
  }, [])

  const createNewDraft = useCallback(() => {
    const nextGraph = cloneGraph(getDefaultWorkflowGraph())
    setGraph(nextGraph)
    setActiveTemplateId(null)
    setWorkflowName(DEFAULT_WORKFLOW_NAME)
    setDirty(true)
    setRun(null)
    setActiveRun(null, null)
    setSelectedNodeId(nextGraph.nodes[0]?.id || null)
  }, [setActiveRun, setActiveTemplateId, setDirty, setGraph, setRun, setSelectedNodeId])

  const handleCreateTemplateDraft = useCallback(() => {
    createNewDraft()
    closeTemplateModal()
    toast.success('Создан новый черновик')
  }, [closeTemplateModal, createNewDraft])

  const handleStartTemplateRename = useCallback((templateId: number, currentName: string) => {
    setTemplateRenameId(templateId)
    setTemplateRenameValue(currentName)
  }, [])

  const handleSubmitTemplateRename = useCallback(async (templateId: number) => {
    const nextName = templateRenameValue.trim()
    if (!nextName) {
      toast.error('Введите название шаблона')
      return
    }

    setIsTemplateActionLoading(true)
    try {
      const updated = await patchWorkflowTemplate(templateId, { name: nextName })
      setTemplates(templates.map((item) => (item.id === updated.id ? updated : item)))
      if (activeTemplateId === updated.id) {
        setWorkflowName(updated.name)
      }
      setTemplateRenameId(null)
      setTemplateRenameValue('')
      toast.success('Шаблон переименован')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось переименовать шаблон')
    } finally {
      setIsTemplateActionLoading(false)
    }
  }, [activeTemplateId, setTemplates, templateRenameValue, templates])

  const handleCancelTemplateRename = useCallback(() => {
    setTemplateRenameId(null)
    setTemplateRenameValue('')
  }, [])

  const handleDeleteTemplate = useCallback(async (templateId: number) => {
    setIsTemplateActionLoading(true)
    try {
      await deleteWorkflowTemplate(templateId)
      const remaining = templates.filter((item) => item.id !== templateId)
      setTemplates(remaining)
      setTemplateDeleteId(null)

      if (remaining.length === 0) {
        createNewDraft()
      } else if (activeTemplateId === templateId) {
        const first = remaining[0]
        setActiveTemplateId(first.id)
        setGraph(cloneGraph(first.graph))
        setWorkflowName(first.name)
        setDirty(false)
        setRun(null)
        setActiveRun(null, null)
        setSelectedNodeId(first.graph.nodes[0]?.id || null)
      }

      toast.success('Шаблон удален')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось удалить шаблон')
    } finally {
      setIsTemplateActionLoading(false)
    }
  }, [activeTemplateId, createNewDraft, setActiveRun, setActiveTemplateId, setDirty, setGraph, setRun, setSelectedNodeId, setTemplates, templates])

  const handleCancelTemplateDelete = useCallback(() => {
    setTemplateDeleteId(null)
  }, [])

  const handleOpenRenameSheet = useCallback(() => {
    setRenameDraftValue(workflowName)
    setActiveMobileSheet('rename')
  }, [workflowName])

  const handleApplyLocalRename = useCallback(() => {
    const nextName = renameDraftValue.trim()
    if (!nextName) {
      toast.error('Введите название сценария')
      return
    }
    setWorkflowName(nextName)
    setDirty(true)
    closeMobileSheet()
  }, [closeMobileSheet, renameDraftValue, setDirty])

  const saveCurrentTemplate = useCallback(async (): Promise<number | null> => {
    setIsSaving(true)
    try {
      if (activeTemplateId) {
        const updated = await patchWorkflowTemplate(activeTemplateId, {
          name: workflowName.trim() || 'Сценарий',
          graph,
        })

        setTemplates(templates.map((item) => (item.id === updated.id ? updated : item)))
        setDirty(false)
        toast.success('Workflow сохранен')
        return updated.id
      }

      const created = await createWorkflowTemplate({
        name: workflowName.trim() || 'Сценарий',
        graph,
      })
      setTemplates([created, ...templates])
      setActiveTemplateId(created.id)
      setDirty(false)
      toast.success('Workflow создан')
      return created.id
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось сохранить workflow')
      return null
    } finally {
      setIsSaving(false)
    }
  }, [activeTemplateId, graph, setActiveTemplateId, setDirty, setTemplates, templates, workflowName])

  const handleSave = async () => {
    await saveCurrentTemplate()
  }

  const handleRun = async () => {
    const issues = validateBeforeRun(graph)
    if (issues.length > 0) {
      toast.error(issues[0])
      return
    }

    setIsRunningAction(true)
    try {
      let workflowId = activeTemplateId
      if (!workflowId || dirty) {
        workflowId = await saveCurrentTemplate()
      }
      if (!workflowId) {
        setIsRunningAction(false)
        return
      }

      const runStart = await startWorkflowRun(workflowId)
      setRun(null)
      setActiveRun(runStart.run_id, runStart.status)
      toast.success(`Запуск #${runStart.run_id} создан`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось запустить workflow')
      setIsRunningAction(false)
    }
  }

  const handleSelectTemplate = (templateId: number) => {
    const selectedTemplate = templates.find((item) => item.id === templateId)
    if (!selectedTemplate) return

    setActiveTemplateId(selectedTemplate.id)
    setGraph(cloneGraph(selectedTemplate.graph))
    setWorkflowName(selectedTemplate.name)
    setDirty(false)
    setRun(null)
    setActiveRun(null, null)
    setSelectedNodeId(selectedTemplate.graph.nodes[0]?.id || null)
  }

  const activeTemplateLabel = activeTemplateId ? `Сценарий #${activeTemplateId}` : 'Черновик'

  return (
    <div className="min-h-full bg-black pb-[calc(env(safe-area-inset-bottom)+84px)] pt-[calc(env(safe-area-inset-top)+74px)] text-zinc-100 lg:pb-6 lg:pt-4">
      <div className="mx-auto w-full max-w-[1540px] px-3 py-3 sm:px-6 sm:py-6">
        {isMobileViewport ? (
          <header className="relative z-[70] rounded-2xl border border-white/10 bg-black/55 px-3 py-2.5 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{workflowName || DEFAULT_WORKFLOW_NAME}</p>
                <p className="mt-0.5 truncate text-[11px] text-zinc-400">
                  {activeTemplateLabel}
                  {dirty ? ' • несохранено' : ''}
                </p>
              </div>
              <button
                className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/75 bg-cyan-500/20 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-60"
                onClick={isRunning ? undefined : handleRun}
                disabled={isRunningAction || isLoading}
              >
                {isRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {isRunning ? 'Выполняется' : 'Run'}
              </button>
              <MobileHeaderMenu
                onSave={() => {
                  void handleSave()
                }}
                onOpenLibrary={() => setActiveMobileSheet('library')}
                onOpenInspector={() => setActiveMobileSheet('inspector')}
                onOpenTemplates={() => setIsTemplateModalOpen(true)}
                onOpenRename={handleOpenRenameSheet}
                disabled={isLoading || isSaving || isRunningAction || isTemplateActionLoading}
              />
            </div>
          </header>
        ) : (
          <header className="rounded-2xl border border-white/10 bg-black/55 px-4 py-3 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-[260px]">
                <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">Конструктор сценариев</p>
                <input
                  value={workflowName}
                  onChange={(event) => {
                    setWorkflowName(event.target.value)
                    setDirty(true)
                  }}
                  className="mt-1 w-full max-w-[520px] border-none bg-transparent p-0 text-lg font-semibold text-white outline-none sm:text-xl"
                  placeholder="Название сценария"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                  <span>{activeTemplateLabel}</span>
                  {dirty ? <span className="text-amber-300">есть несохраненные изменения</span> : null}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    showLibrary
                      ? 'border-cyan-300/70 bg-cyan-400/20 text-cyan-100'
                      : 'border-white/10 bg-zinc-900/75 text-zinc-200 hover:bg-zinc-900'
                  }`}
                  onClick={handleToggleLibrary}
                >
                  <PanelLeft className="h-3.5 w-3.5" />
                  Ноды
                </button>
                <button
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    showInspector
                      ? 'border-cyan-300/70 bg-cyan-400/20 text-cyan-100'
                      : 'border-white/10 bg-zinc-900/75 text-zinc-200 hover:bg-zinc-900'
                  }`}
                  onClick={handleToggleInspector}
                >
                  <PanelRight className="h-3.5 w-3.5" />
                  Настройки
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/75 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-900"
                  onClick={() => setIsTemplateModalOpen(true)}
                >
                  <Shapes className="h-3.5 w-3.5" />
                  Templates
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/75 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-900 disabled:opacity-60"
                  onClick={handleSave}
                  disabled={isSaving || isLoading}
                >
                  <Save className="h-3.5 w-3.5" />
                  Сохранить
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/75 bg-cyan-500/20 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-60"
                  onClick={isRunning ? undefined : handleRun}
                  disabled={isRunningAction || isLoading}
                >
                  {isRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {isRunning ? 'Выполняется' : 'Запустить'}
                </button>
              </div>
            </div>
          </header>
        )}

        <div className="mt-3 flex gap-3">
          <aside className={`${showLibrary ? 'hidden w-60 shrink-0 lg:block' : 'hidden'}`}>
            <div className="h-full rounded-2xl border border-white/10 bg-black/55 p-3 backdrop-blur-xl">
              <h2 className="text-sm font-semibold text-white">Ноды</h2>
              <p className="mt-1 text-xs text-zinc-500">Добавляйте блоки в workflow</p>

              <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
                {NODE_LIBRARY.map((item) => (
                  <button
                    key={item.type}
                    className="rounded-lg border border-white/10 bg-zinc-900/80 px-2 py-2 text-left font-medium text-zinc-200 hover:border-cyan-300/60"
                    onClick={() => handleAddNode(item.type)}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Plus className="h-3.5 w-3.5 text-cyan-300" />
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-zinc-900/70 p-2.5 text-[11px] text-zinc-500">
                V1: генерация фото/видео и инструменты. Нода запускается, когда готовы все её входы.
              </div>
            </div>
          </aside>

          <section
            ref={workflowCanvasRef}
            className="relative min-h-[72vh] flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#05070b]"
          >
            <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2 rounded-xl border border-white/10 bg-black/80 px-3 py-2 text-[11px] backdrop-blur-xl">
              <span className="font-semibold text-zinc-200">{activeTemplateLabel}</span>
              <span className="text-zinc-500">|</span>
              <span className="text-zinc-400">нод {graph.nodes.length}</span>
            </div>

            {!isMobileViewport ? (
              <div className="pointer-events-none absolute left-3 right-3 bottom-3 z-10 rounded-xl border border-white/10 bg-black/80 p-2.5 backdrop-blur-xl">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="inline-flex items-center gap-1 text-zinc-300">
                    <Clock3 className="h-3.5 w-3.5" />
                    Выполнение
                  </span>
                  <span className="text-zinc-500">{run?.status || 'ожидание'}</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                    style={{ width: `${progressValue}%` }}
                  />
                </div>
                {runError ? <p className="mt-2 text-[11px] text-red-300">{runError}</p> : null}
                {terminalRun && hasRunOutputs ? (
                  <button
                    className="pointer-events-auto mt-2 inline-flex rounded-lg border border-cyan-400/60 bg-cyan-500/15 px-2.5 py-1 text-[11px] text-cyan-200"
                    onClick={() => setIsResultsOverlayOpen(true)}
                  >
                    View Results
                  </button>
                ) : null}
              </div>
            ) : null}

            {isLoading ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 text-sm text-zinc-300">
                Загрузка сценария...
              </div>
            ) : null}

            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={handleNodeClick}
              onPaneClick={handlePaneClick}
              fitView
              minZoom={0.03}
              maxZoom={2}
              panOnDrag={!isMobileViewport}
              panOnScroll={isMobileViewport ? true : undefined}
              selectionOnDrag={isMobileViewport ? false : !isMobileViewport}
              zoomOnScroll={!isMobileViewport}
              zoomOnPinch={isMobileViewport ? true : undefined}
              zoomOnDoubleClick={isMobileViewport ? true : undefined}
              preventScrolling={false}
              fitViewOptions={{ padding: 0.2, maxZoom: 1.05 }}
              defaultEdgeOptions={{
                type: 'smoothstep',
              }}
              className="workflow-flow"
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={22} size={1} color="#1b2430" />
              <Controls position="top-right" showInteractive={false} />
            </ReactFlow>
          </section>

          <aside className={`${showInspector ? 'hidden w-[320px] shrink-0 lg:block' : 'hidden'}`}>
            <div className="h-full rounded-2xl border border-white/10 bg-black/55 p-3 backdrop-blur-xl">
              <h2 className="text-sm font-semibold text-white">Настройки ноды</h2>

              {selectedNode ? (
                <NodeSettings
                  node={selectedNode}
                  output={selectedNodeOutput}
                  onOpenOutput={() => handleOpenNodeResult(selectedNode.id)}
                  incomingOptions={selectedNodeIncomingOptions}
                  onPatch={updateNodeData}
                  onUpdateInputOrder={handleUpdateInputOrder}
                  onDelete={handleDeleteSelectedNode}
                  onUploadRefs={handleUploadNodeRefs}
                  onRemoveRef={handleRemoveNodeRef}
                  isUploading={uploadingNodeId === selectedNode.id}
                />
              ) : (
                <div className="mt-3 rounded-xl border border-white/10 bg-zinc-900/80 p-3 text-xs text-zinc-500">
                  Выберите ноду на канвасе, чтобы изменить параметры.
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {isMobileViewport ? (
        <div className={`fixed left-0 right-0 ${aboveTabbarClass} z-40 px-3`}>
          <div className="mx-auto w-full max-w-[760px] rounded-xl border border-white/10 bg-black/80 px-3 py-2 backdrop-blur-xl">
            <div className="flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1 text-zinc-300">
                <Clock3 className="h-3.5 w-3.5" />
                Выполнение
              </span>
              <span className="text-zinc-500">{run?.status || 'ожидание'}</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                style={{ width: `${progressValue}%` }}
              />
            </div>
            {runError ? <p className="mt-1.5 text-[11px] text-red-300">{runError}</p> : null}
            {terminalRun && hasRunOutputs ? (
              <button
                className="mt-2 inline-flex rounded-lg border border-cyan-400/60 bg-cyan-500/15 px-2.5 py-1 text-[11px] text-cyan-200"
                onClick={() => setIsResultsOverlayOpen(true)}
              >
                View Results
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <BottomSheet
        open={isMobileViewport && activeMobileSheet === 'library'}
        onClose={closeMobileSheet}
        title="Ноды"
        initialSnap="half"
        allowCollapsed
        bottomClassName={aboveTabbarClass}
      >
        <p className="text-xs text-zinc-500">Выберите тип ноды и добавьте в граф</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {NODE_LIBRARY.map((item) => (
            <button
              key={`mobile-sheet-${item.type}`}
              className="rounded-lg border border-white/10 bg-zinc-900/80 px-2 py-2 text-left font-medium text-zinc-200"
              onClick={() => handleAddNode(item.type)}
            >
              <span className="inline-flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5 text-cyan-300" />
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet
        open={isMobileViewport && activeMobileSheet === 'inspector'}
        onClose={closeMobileSheet}
        title="Настройки"
        initialSnap="full"
        bottomClassName={aboveTabbarClass}
        contentBottomOffset={tabbarOffsetVar}
        maxHeightPx={inspectorMaxHeight ?? undefined}
      >
        {selectedNode ? (
          <NodeSettings
            node={selectedNode}
            output={selectedNodeOutput}
            onOpenOutput={() => handleOpenNodeResult(selectedNode.id)}
            incomingOptions={selectedNodeIncomingOptions}
            onPatch={updateNodeData}
            onUpdateInputOrder={handleUpdateInputOrder}
            onDelete={handleDeleteSelectedNode}
            onUploadRefs={handleUploadNodeRefs}
            onRemoveRef={handleRemoveNodeRef}
            isUploading={uploadingNodeId === selectedNode.id}
          />
        ) : (
          <p className="mt-2 text-xs text-zinc-500">Нажмите на ноду, чтобы открыть её настройки</p>
        )}
      </BottomSheet>

      <BottomSheet
        open={isMobileViewport && activeMobileSheet === 'rename'}
        onClose={closeMobileSheet}
        title="Rename Workflow"
        initialSnap="half"
        allowCollapsed={false}
        bottomClassName={aboveTabbarClass}
      >
        <label className="block rounded-lg border border-white/10 bg-zinc-900/70 px-2.5 py-2">
          <p className="text-[11px] text-zinc-500">Название workflow</p>
          <input
            className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-zinc-100 outline-none"
            value={renameDraftValue}
            onChange={(event) => setRenameDraftValue(event.target.value)}
            placeholder="Название сценария"
          />
        </label>
        <div className="mt-3 flex gap-2">
          <button
            className="rounded-lg border border-cyan-400/60 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100"
            onClick={handleApplyLocalRename}
          >
            Save
          </button>
          <button
            className="rounded-lg border border-white/10 bg-zinc-800/80 px-3 py-1.5 text-xs font-semibold text-zinc-200"
            onClick={closeMobileSheet}
          >
            Cancel
          </button>
        </div>
      </BottomSheet>

      <TemplateListModal
        open={isTemplateModalOpen}
        isMobileViewport={isMobileViewport}
        bottomClassName={aboveTabbarClass}
        templates={templates}
        activeTemplateId={activeTemplateId}
        templateRenameId={templateRenameId}
        templateRenameValue={templateRenameValue}
        templateDeleteId={templateDeleteId}
        isTemplateActionLoading={isTemplateActionLoading}
        onClose={closeTemplateModal}
        onCreateDraft={handleCreateTemplateDraft}
        onSelectTemplate={handleSelectTemplate}
        onStartRename={handleStartTemplateRename}
        onRenameValueChange={setTemplateRenameValue}
        onSubmitRename={(templateId) => {
          void handleSubmitTemplateRename(templateId)
        }}
        onCancelRename={handleCancelTemplateRename}
        onRequestDelete={setTemplateDeleteId}
        onCancelDelete={handleCancelTemplateDelete}
        onConfirmDelete={(templateId) => {
          void handleDeleteTemplate(templateId)
        }}
      />

      <NodeResultModal
        open={!!nodeResultNodeId && !!nodeResultArtifact}
        artifact={nodeResultArtifact}
        nodeLabel={nodeResultNodeLabel}
        onClose={() => setNodeResultNodeId(null)}
      />

      <WorkflowResultsOverlay
        open={isResultsOverlayOpen}
        entries={runOutputEntries}
        onClose={() => setIsResultsOverlayOpen(false)}
      />
    </div>
  )
}
