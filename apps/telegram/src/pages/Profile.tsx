import React, { useState, useEffect, useRef } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { Sparkles, Share2, Edit, History as HistoryIcon, X, Download as DownloadIcon, Send, Wallet, Settings as SettingsIcon, Globe, EyeOff, Maximize2, Copy, Check, Crown, Grid, Info, List as ListIcon, Loader2, User, RefreshCw, Clipboard, Camera, Clock, Repeat, Trash2, Filter, Pencil, ChevronLeft, ChevronRight, Video, Image as ImageIcon, VolumeX, Volume2, Gift, Lock, Unlock, MessageSquare, Droplets, LogOut } from 'lucide-react'

// Custom GridImage component for handling load states
const GridImage = ({ src, originalUrl, alt, className, onImageError }: { src: string, originalUrl: string, alt: string, className?: string, onImageError?: () => void }) => {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [imgSrc, setImgSrc] = useState(src)
  const imgRef = React.useRef<HTMLImageElement>(null)

  useEffect(() => {
    setImgSrc(src)
    setError(false)
    setLoaded(false)
  }, [src])

  // Check for cached images
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete) {
      setLoaded(true)
    }
  }, [imgSrc])

  // Notify parent when image is unavailable
  useEffect(() => {
    if (error && onImageError) {
      onImageError()
    }
  }, [error, onImageError])

  // If image is unavailable, return null (hide the element)
  if (error) {
    return null
  }

  return (
    <div className={`relative w-full h-full overflow-hidden bg-zinc-800 ${className}`}>
      {!loaded && (
        <div
          className="absolute inset-0 bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 bg-[length:200%_100%]"
          style={{ animation: 'shimmer 1.5s ease-in-out infinite' }}
        />
      )}
      <img
        ref={imgRef}
        src={imgSrc}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!error && imgSrc !== originalUrl) {
            setImgSrc(originalUrl)
          } else {
            setError(true)
          }
        }}
      />
    </div>
  )
}

import { PaymentModal } from '@/components/PaymentModal'
import { toast } from 'sonner'
import { GenerationSelector } from '@/components/GenerationSelector'
import { useNavigate, useLocation } from 'react-router-dom'
import { useHaptics } from '@/hooks/useHaptics'
import { useTelegram, getAuthHeaders } from '@/hooks/useTelegram'
import { useGenerationStore } from '@/store/generationStore'
import { useAuthStore } from '@/store/authStore'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { ProfileSkeletonGrid } from '@/components/ui/skeleton'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { ChannelSubscriptionModal } from '@/components/ChannelSubscriptionModal'

function getModelDisplayName(model: string | null): string {
  if (!model) return ''
  switch (model) {
    case 'nanobanana': return 'NanoBanana'
    case 'nanobanana-pro': return 'NanoBanana Pro'
    case 'seedream4': return 'Seedream 4'
    case 'seedream4-5': return 'Seedream 4.5'
    case 'seedream4.5': return 'Seedream 4.5'
    case 'qwen-edit': return 'Qwen Edit'
    case 'flux': return 'Flux'
    case 'p-image-edit': return 'Editor'
    case 'seedance-1.5-pro': return 'Seedance Pro'
    case 'gptimage1.5': return 'GPT image 1.5'
    case 'kling-mc':
    case 'kling-2.6/motion-control': return 'Kling Motion-Control'
    case 'kling-t2v':
    case 'kling-2.6/text-to-video': return 'Kling 2.6'
    case 'kling-i2v':
    case 'kling-2.6/image-to-video': return 'Kling 2.6'
    default: return model
  }
}

function cleanPrompt(prompt: string): string {
  return prompt.replace(/\s*\[.*?\]\s*$/, '').trim()
}

export default function Profile() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // ... (rest of the component)

  // ... inside the component, finding usages of prompt ...

  // In the list:
  // <p className="text-[10px] text-zinc-300 truncate font-medium">{cleanPrompt(h.prompt)}</p>

  // In the preview modal:
  // navigator.share({ title: 'AiVerse', text: cleanPrompt(preview.prompt), url: preview.image_url })
  // shareImage(preview.image_url, cleanPrompt(preview.prompt))
  const { impact, notify } = useHaptics()
  const { user, platform, saveToGallery, shareImage, isInTelegram } = useTelegram()
  const [avatarSrc, setAvatarSrc] = useState<string>('')
  const [coverSrc, setCoverSrc] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [spins, setSpins] = useState<number>(0)
  const [likes, setLikes] = useState<number>(0)
  const [remixCount, setRemixCount] = useState<number>(0)
  const [followingCount, setFollowingCount] = useState<number>(0)
  const [followersCount, setFollowersCount] = useState<number>(0)
  const [items, setItems] = useState<{ id: number; image_url: string | null; video_url?: string | null; compressed_url?: string | null; prompt: string; created_at: string | null; is_published: boolean; is_prompt_private?: boolean; model?: string | null; edit_variants?: string[] | null; media_type?: 'image' | 'video' | null; input_images?: string[] | null }[]>([])
  const [preview, setPreview] = useState<{ id: number; image_url: string; video_url?: string | null; prompt: string; is_published: boolean; is_prompt_private?: boolean; model?: string | null; edit_variants?: string[] | null; media_type?: 'image' | 'video' | null; input_images?: string[] | null } | null>(null)
  const [previewIndex, setPreviewIndex] = useState(0) // 0 = original, 1+ = edit variants
  const [currentGenerationIndex, setCurrentGenerationIndex] = useState<number | null>(null) // index in items array
  const [isVideoMuted, setIsVideoMuted] = useState(true)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [total, setTotal] = useState<number | undefined>(undefined)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  // Filters
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [visibility, setVisibility] = useState<'all' | 'published' | 'private'>('all')
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | 'image' | 'video'>('all')
  const [showEditedOnly, setShowEditedOnly] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [showAvatarModal, setShowAvatarModal] = useState(false)
  const [showCoverSelector, setShowCoverSelector] = useState(false)
  const [showAvatarOptions, setShowAvatarOptions] = useState(false)
  // Channel subscription reward state
  const [channelReward, setChannelReward] = useState<{ show: boolean; loading: boolean; claiming: boolean }>({ show: false, loading: true, claiming: false })
  const [showRewardModal, setShowRewardModal] = useState(false)
  const [showSpinButton, setShowSpinButton] = useState(false) // State based on event settings

  useEffect(() => {
    // Check if spin event is enabled
    fetch('/api/events/status/spin')
      .then(res => res.json())
      .then(data => {
        if (data && data.enabled) {
          setShowSpinButton(true)
        } else {
          setShowSpinButton(false)
        }
      })
      .catch((e) => console.error('Failed to fetch spin status', e))
  }, [])

  // Auto-open PaymentModal if ?payment=true query param
  const location = useLocation()
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('payment') === 'true') {
      setIsPaymentModalOpen(true)
      // Clean up the URL
      navigate('/profile', { replace: true })
    }
  }, [location.search, navigate])

  const displayName = (user?.first_name && user?.last_name)
    ? `${user.first_name} ${user.last_name} `
    : (user?.first_name || user?.username || t('profile.guest'))
  const username = user?.username ? `@${user.username} ` : '—'
  const avatarSeed = user?.username || String(user?.id || 'guest')
  const avatarUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(avatarSeed)}`

  const prevBalanceRef = useRef<number | null>(null)

  const fetchBalance = () => {
    if (user?.id) {
      fetch(`/api/user/info/${user.id}`).then(async r => {
        const j = await r.json().catch(() => null);
        if (r.ok && j && typeof j.balance === 'number') {
          const newBalance = j.balance
          const prevBalance = prevBalanceRef.current

          if (prevBalance !== null && newBalance > prevBalance) {
            impact('heavy')
            notify('success')
            // Use Telegram's showAlert if available for native feel, fallback to alert
            const wa = (window as any).Telegram?.WebApp
            if (wa && wa.showAlert) {
              wa.showAlert(t('profile.balance.success'))
            } else {
              alert(t('profile.balance.success'))
            }
          }

          setBalance(newBalance)
          prevBalanceRef.current = newBalance
        }
        if (r.ok && j && typeof j.likes_count === 'number') {
          setLikes(j.likes_count)
        }
        if (r.ok && j && typeof j.remix_count === 'number') {
          setRemixCount(j.remix_count)
        }
        if (r.ok && j && typeof j.spins === 'number') {
          setSpins(j.spins)
        }
        if (r.ok && j && j.cover_url) {
          setCoverSrc(j.cover_url)
        } else {
          setCoverSrc('')
        }
        if (r.ok && j && typeof j.following_count === 'number') {
          setFollowingCount(j.following_count)
        }
        if (r.ok && j && typeof j.followers_count === 'number') {
          setFollowersCount(j.followers_count)
        }
      })
    }
  }

  useEffect(() => {
    const url = user?.id ? `/api/user/avatar/${user.id}` : avatarUrl
    setAvatarSrc(url)
    if (user?.id) {
      fetch(`/api/user/avatar/${user.id}`).then(r => { if (r.ok) setAvatarSrc(`/api/user/avatar/${user.id}`) })
      fetchBalance()
        ; (async () => {
          setLoading(true)
          try {
            // Check pending status first
            await fetch('/api/generation/check-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
              body: JSON.stringify({ user_id: user.id })
            }).catch(() => { })

            const r = await fetch(`/api/user/generations?user_id=${user.id}&limit=6&offset=0`)
            const j = await r.json().catch(() => null)
            if (r.ok && j) { setItems(j.items || []); setTotal(j.total); setOffset(0) }
          } finally { setLoading(false) }
        })()
    }
  }, [user?.id])

  // Check channel subscription status
  useEffect(() => {
    if (user?.id) {
      fetch(`/api/user/channel-subscription/${user.id}`)
        .then(async r => {
          const j = await r.json().catch(() => null)
          if (r.ok && j) {
            // Show card only if not subscribed OR subscribed but reward not claimed
            setChannelReward(prev => ({
              ...prev,
              loading: false,
              show: !j.rewardClaimed
            }))
          } else {
            setChannelReward(prev => ({ ...prev, loading: false, show: false }))
          }
        })
        .catch(() => setChannelReward(prev => ({ ...prev, loading: false, show: false })))
    }
  }, [user?.id])

  // Refresh balance when modal closes or window gains focus (user returns from payment)
  useEffect(() => {
    if (!isPaymentModalOpen) {
      fetchBalance()
    }
  }, [isPaymentModalOpen])

  useEffect(() => {
    const onFocus = () => fetchBalance()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') fetchBalance()
    })
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [user?.id])

  const [isFullScreen, setIsFullScreen] = useState(false)
  const [scale, setScale] = useState(1)

  // Reset scale when closing fullscreen
  useEffect(() => {
    if (!isFullScreen) setScale(1)
  }, [isFullScreen])

  // Reset showPrompt when preview changes
  useEffect(() => {
    setShowPrompt(false)
  }, [preview])

  // Reload data when filters change
  useEffect(() => {
    if (!user?.id) return
    const modelParam = selectedModels.length > 0 ? `&model=${selectedModels.join(',')}` : ''
    const visibilityParam = visibility !== 'all' ? `&visibility=${visibility}` : ''
    setLoading(true)
    fetch(`/api/user/generations?user_id=${user.id}&limit=50&offset=0${modelParam}${visibilityParam}`)
      .then(async r => {
        const j = await r.json().catch(() => null)
        if (r.ok && j) {
          let filteredItems = j.items || []
          if (showEditedOnly) {
            filteredItems = filteredItems.filter((item: any) => item.edit_variants && item.edit_variants.length > 0)
          }
          // Filter by media type
          if (mediaTypeFilter !== 'all') {
            filteredItems = filteredItems.filter((item: any) => {
              const itemMediaType = item.media_type || 'image' // default to image if not set
              return itemMediaType === mediaTypeFilter
            })
          }
          setItems(filteredItems)
          setTotal(j.total)
          setOffset(0)
        }
      })
      .finally(() => setLoading(false))
  }, [user?.id, selectedModels, visibility, showEditedOnly, mediaTypeFilter])

  // Refresh function for pull-to-refresh
  const handleRefresh = async () => {
    if (!user?.id || refreshing) return
    setRefreshing(true)
    try {
      // Check pending status first
      await fetch('/api/generation/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ user_id: user.id })
      }).catch(() => { })

      // Refresh generations
      const modelParam = selectedModels.length > 0 ? `&model=${selectedModels.join(',')}` : ''
      const visibilityParam = visibility !== 'all' ? `&visibility=${visibility}` : ''
      const r = await fetch(`/api/user/generations?user_id=${user.id}&limit=50&offset=0${modelParam}${visibilityParam}`)
      const j = await r.json().catch(() => null)
      if (r.ok && j) {
        let filteredItems = j.items || []
        if (showEditedOnly) {
          filteredItems = filteredItems.filter((item: any) => item.edit_variants && item.edit_variants.length > 0)
        }
        if (mediaTypeFilter !== 'all') {
          filteredItems = filteredItems.filter((item: any) => {
            const itemMediaType = item.media_type || 'image'
            return itemMediaType === mediaTypeFilter
          })
        }
        setItems(filteredItems)
        setTotal(j.total)
        setOffset(0)
      }

      // Refresh balance
      fetchBalance()
      notify('success')
    } catch {
      notify('error')
    } finally {
      setRefreshing(false)
    }
  }

  const {
    setPrompt,
    setSelectedModel,
    setParentGeneration,
    setCurrentScreen,
    setAspectRatio,
    setGenerationMode,
    setUploadedImages,
    setMediaType
  } = useGenerationStore()

  const handleRemix = (item: any) => {
    impact('medium')

    // Parse metadata from prompt
    let cleanPrompt = item.prompt
    const metadata: Record<string, string> = {}

    const match = item.prompt.match(/\s*\[(.*?)\]\s*$/)
    if (match) {
      const metaString = match[1]
      cleanPrompt = item.prompt.replace(match[0], '').trim()

      metaString.split(';').forEach((part: string) => {
        const [key, val] = part.split('=').map((s: string) => s.trim())
        if (key && val) metadata[key] = val
      })
    }

    setPrompt(cleanPrompt)

    if (item.model) {
      const modelMap: Record<string, any> = {
        'nanobanana': 'nanobanana',
        'nanobanana-pro': 'nanobanana-pro',
        'seedream4': 'seedream4',
        'seedream4-5': 'seedream4-5',
        'seedream4.5': 'seedream4-5',
        'seedance-1.5-pro': 'seedance-1.5-pro',
        'gptimage1.5': 'gpt-image-1.5'
      }
      if (modelMap[item.model]) {
        setSelectedModel(modelMap[item.model])
      }
    }

    if (metadata.ratio) {
      const validRatios = ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '16:21', 'Auto', 'square_hd', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9']
      if (validRatios.includes(metadata.ratio)) {
        setAspectRatio(metadata.ratio as any)
      }
    }

    if (metadata.type) {
      if (metadata.type === 'text_photo') {
        setGenerationMode('image')
      } else {
        setGenerationMode('text')
      }
    }

    // Load input images if present
    if (item.input_images && item.input_images.length > 0) {
      setUploadedImages(item.input_images)
      setGenerationMode('image')
    } else {
      setUploadedImages([])
    }

    // Set media type based on item
    if (item.media_type === 'video') {
      setMediaType('video')
      // Ensure we use the video model
      if (!item.model || item.model === 'seedance-1.5-pro') {
        setSelectedModel('seedance-1.5-pro')
      }
    } else {
      setMediaType('image')
    }

    setParentGeneration(item.id, item.author?.username || user?.username)
    setCurrentScreen('form')
    navigate('/studio')
  }

  // Navigation between generations
  const goToPrevGeneration = () => {
    if (currentGenerationIndex === null || currentGenerationIndex <= 0) return
    impact('light')
    const newIndex = currentGenerationIndex - 1
    const newItem = items[newIndex]
    if (!newItem) return
    setCurrentGenerationIndex(newIndex)
    setPreviewIndex(0)
    setPreview({
      id: newItem.id,
      image_url: newItem.image_url || '',
      video_url: newItem.video_url,
      prompt: newItem.prompt,
      is_published: newItem.is_published,
      is_prompt_private: newItem.is_prompt_private,
      model: newItem.model,
      edit_variants: newItem.edit_variants,
      media_type: newItem.media_type
    })
  }

  const goToNextGeneration = async () => {
    if (currentGenerationIndex === null) return

    // Filter logic updated to include items with video_url even if image_url is missing (use input_images for thumbnail)
    const filteredItems = items.filter(h => !!(h.image_url || h.video_url || (h.media_type === 'video' && h.input_images && h.input_images.length > 0)))

    // If at the last item and there are more to load, fetch next batch
    if (currentGenerationIndex >= filteredItems.length - 1) {
      // Check if there are more items to load
      if (total !== undefined && items.length < total && user?.id) {
        impact('light')
        const modelParam = selectedModels.length > 0 ? `&model=${selectedModels.join(',')}` : ''
        const visibilityParam = visibility !== 'all' ? `&visibility=${visibility}` : ''
        try {
          const r = await fetch(`/api/user/generations?user_id=${user.id}&limit=6&offset=${offset + 6}${modelParam}${visibilityParam}`)
          const j = await r.json().catch(() => null)
          if (r.ok && j && j.items && j.items.length > 0) {
            const newItems = [...items, ...j.items]
            setItems(newItems)
            setOffset(offset + 6)
            setTotal(j.total)

            // Now navigate to the next item
            // Filter logic updated
            const newFilteredItems = newItems.filter(h => !!(h.image_url || h.video_url || (h.media_type === 'video' && h.input_images && h.input_images.length > 0)))
            const newIndex = currentGenerationIndex + 1
            if (newIndex < newFilteredItems.length) {
              const newItem = newFilteredItems[newIndex]
              setCurrentGenerationIndex(newIndex)
              setPreviewIndex(0)
              setPreview({
                id: newItem.id,
                image_url: newItem.image_url || '',
                video_url: newItem.video_url,
                prompt: newItem.prompt,
                is_published: newItem.is_published,
                is_prompt_private: newItem.is_prompt_private,
                model: newItem.model,
                edit_variants: newItem.edit_variants,
                media_type: newItem.media_type
              })
            }
          }
        } catch {
          // Ignore errors
        }
      }
      return
    }

    impact('light')
    const newIndex = currentGenerationIndex + 1
    const newItem = filteredItems[newIndex]
    if (!newItem) return
    setCurrentGenerationIndex(newIndex)
    setPreviewIndex(0)
    setPreview({
      id: newItem.id,
      image_url: newItem.image_url || '',
      video_url: newItem.video_url,
      prompt: newItem.prompt,
      is_published: newItem.is_published,
      is_prompt_private: newItem.is_prompt_private,
      model: newItem.model,
      edit_variants: newItem.edit_variants,
      media_type: newItem.media_type
    })
  }

  const stats = [
    { label: t('profile.stats.generations'), value: typeof total === 'number' ? total : items.length },
    { label: t('profile.stats.followers'), value: followersCount },
    { label: t('profile.stats.likes'), value: likes },
    { label: t('profile.stats.remixes'), value: remixCount },
  ]
  const paddingTop = platform === 'ios' ? 'calc(env(safe-area-inset-top) + 60px)' : 'calc(env(safe-area-inset-top) + 50px)'

  const [showPublishConfirm, setShowPublishConfirm] = useState(false)
  const [showRemixShareConfirm, setShowRemixShareConfirm] = useState(false)
  const [remixShareLoading, setRemixShareLoading] = useState(false)
  const [sendWithPromptLoading, setSendWithPromptLoading] = useState(false)
  const [sendWithWatermarkLoading, setSendWithWatermarkLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showVariantDeleteConfirm, setShowVariantDeleteConfirm] = useState(false)
  const [variantDeleteLoading, setVariantDeleteLoading] = useState(false)

  const handleDelete = async () => {
    if (!preview || !user?.id) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/generation/${preview.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ user_id: user.id })
      })
      if (res.ok) {
        impact('medium')
        notify('success')
        // Remove from local state
        setItems(prev => prev.filter(item => item.id !== preview.id))
        setTotal(prev => (prev !== undefined ? prev - 1 : prev))
        setPreview(null)
        setCurrentGenerationIndex(null)
        setShowDeleteConfirm(false)
      } else {
        notify('error')
      }
    } catch {
      notify('error')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleDeleteVariant = async () => {
    if (!preview || !user?.id || previewIndex === 0) return // Can't delete original
    setVariantDeleteLoading(true)
    try {
      // previewIndex 1 = edit_variants[0], so variant index = previewIndex - 1
      const variantIndex = previewIndex - 1
      const res = await fetch(`/api/generation/${preview.id}/variant/${variantIndex}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ user_id: user.id })
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        impact('medium')
        notify('success')
        // Update local state
        const newVariants = data.remaining_variants || []
        setPreview(prev => prev ? { ...prev, edit_variants: newVariants.length > 0 ? newVariants : null } : null)
        setItems(prev => prev.map(item =>
          item.id === preview.id
            ? { ...item, edit_variants: newVariants.length > 0 ? newVariants : null }
            : item
        ))
        // Move to previous image or original
        setPreviewIndex(prev => Math.max(0, prev - 1))
        setShowVariantDeleteConfirm(false)
      } else {
        notify('error')
      }
    } catch {
      notify('error')
    } finally {
      setVariantDeleteLoading(false)
    }
  }

  const handlePublish = async (privacy?: boolean) => {
    if (!preview) return
    impact('medium')
    const newStatus = !preview.is_published
    const newPrivacy = privacy !== undefined ? privacy : preview.is_prompt_private
    const oldStatus = preview.is_published
    const oldPrivacy = preview.is_prompt_private

    // Optimistic update
    setPreview(prev => prev ? { ...prev, is_published: newStatus, is_prompt_private: newPrivacy } : null)
    setItems(prev => prev.map(i => i.id === preview.id ? { ...i, is_published: newStatus, is_prompt_private: newPrivacy } : i))
    setShowPublishConfirm(false)

    try {
      const r = await fetch('/api/user/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ generationId: preview.id, isPublished: newStatus, isPrivate: newPrivacy })
      })
      if (r.ok) {
        notify('success')
      } else {
        notify('error')
        // Revert
        setPreview(prev => prev ? { ...prev, is_published: oldStatus, is_prompt_private: oldPrivacy } : null)
        setItems(prev => prev.map(i => i.id === preview.id ? { ...i, is_published: oldStatus, is_prompt_private: oldPrivacy } : i))
      }
    } catch {
      notify('error')
      // Revert
      setPreview(prev => prev ? { ...prev, is_published: oldStatus, is_prompt_private: oldPrivacy } : null)
      setItems(prev => prev.map(i => i.id === preview.id ? { ...i, is_published: oldStatus, is_prompt_private: oldPrivacy } : i))
    }
  }

  const handlePrivacyToggle = async () => {
    if (!preview) return
    impact('light')
    const newPrivate = !preview.is_prompt_private

    // Optimistic update
    setPreview(prev => prev ? { ...prev, is_prompt_private: newPrivate } : null)
    setItems(prev => prev.map(i => i.id === preview.id ? { ...i, is_prompt_private: newPrivate } : i))

    try {
      const r = await fetch(`/api/generation/${preview.id}/privacy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ is_prompt_private: newPrivate })
      })
      if (r.ok) {
        notify('success')
      } else {
        notify('error')
        // Revert
        setPreview(prev => prev ? { ...prev, is_prompt_private: !newPrivate } : null)
        setItems(prev => prev.map(i => i.id === preview.id ? { ...i, is_prompt_private: !newPrivate } : i))
      }
    } catch {
      notify('error')
      // Revert
      setPreview(prev => prev ? { ...prev, is_prompt_private: !newPrivate } : null)
      setItems(prev => prev.map(i => i.id === preview.id ? { ...i, is_prompt_private: !newPrivate } : i))
    }
  }

  const handleCoverSelect = async (generationId: number) => {
    if (!user?.id) return
    try {
      const r = await fetch('/api/user/cover/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ userId: user.id, generationId })
      })
      const j = await r.json()
      if (r.ok && j.ok) {
        setCoverSrc(j.cover_url)
        notify('success')
      } else {
        notify('error')
      }
    } catch {
      notify('error')
    }
  }

  return (
    <div className="min-h-dvh bg-black safe-bottom-tabbar" style={{ paddingTop }}>
      <div className="mx-auto max-w-3xl px-4 py-4 space-y-6">

        <div
          className="relative overflow-hidden rounded-[2rem] bg-zinc-900/90 border border-white/5 p-5 shadow-2xl transition-all duration-500"
          style={coverSrc ? {
            backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.8)), url(${coverSrc})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          } : {}}
        >
          {/* Cover Edit Button - moved to left */}
          <button
            onClick={() => setShowCoverSelector(true)}
            className="absolute top-4 left-4 z-20 w-6 h-6 rounded-full bg-black/40 hover:bg-black/60 text-white/70 hover:text-white flex items-center justify-center backdrop-blur-md transition-colors border border-white/10"
          >
            <Camera size={16} />
          </button>

          {/* Logout Button - in the right corner (only for web users) */}
          {!isInTelegram && (
            <button
              onClick={() => {
                if (window.confirm(t('profile.logoutConfirm', 'Вы уверены, что хотите выйти?'))) {
                  // Clear auth store
                  useAuthStore.getState().logout()
                  // Redirect to login
                  window.location.href = '/login'
                }
              }}
              className="absolute top-4 right-4 z-20 w-6 h-6 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300 flex items-center justify-center backdrop-blur-md transition-colors border border-red-500/30"
            >
              <LogOut size={16} />
            </button>
          )}

          {/* Background Effects (only show if no cover) */}
          {!coverSrc && (
            <>
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-violet-600/20 rounded-full blur-[80px] pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-indigo-600/20 rounded-full blur-[80px] pointer-events-none" />
            </>
          )}

          <div className="relative z-10 flex flex-col items-center text-center">
            {/* Avatar - clickable to open modal */}
            <div className="relative mb-3 group cursor-pointer" onClick={() => setShowAvatarModal(true)}>
              <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-br from-violet-500 via-fuchsia-500 to-indigo-500 shadow-xl shadow-violet-500/20">
                <div className="w-full h-full rounded-full bg-black overflow-hidden relative">
                  <UserAvatar
                    user={{
                      username: displayName,
                      avatar_url: avatarSrc || avatarUrl
                    }}
                    className="w-full h-full"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                    <Edit className="text-white" size={20} />
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-300 to-yellow-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg tracking-wide uppercase">
                {t('profile.pro')}
              </div>
            </div>

            {/* Name & Username */}
            <h1 className="text-xl font-bold text-white mb-0.5 tracking-tight">{displayName}</h1>
            <p className="text-zinc-400 font-medium text-sm mb-4">{username}</p>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-2 w-full mb-4">
              {stats.map(s => (
                <div
                  key={s.label}
                  className={`bg-black/10 backdrop-blur-xl rounded-xl p-2 border border-white/10 flex flex-col items-center justify-center gap-0.5 shadow-xl ${s.label === 'Подписчики' ? 'cursor-pointer hover:bg-white/5 active:scale-[0.98] transition-all' : ''}`}
                  onClick={() => {
                    if (s.label === 'Подписчики') {
                      impact('light')
                      navigate('/subscriptions?tab=followers')
                    }
                  }}
                >
                  <span className="text-lg font-bold text-white shadow-black/80 drop-shadow-lg">{s.value}</span>
                  <span className="text-[9px] uppercase tracking-wider text-zinc-100 font-bold shadow-black/80 drop-shadow-md">{s.label}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2 w-full">
              <button
                onClick={() => { impact('light'); setIsPaymentModalOpen(true) }}
                className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-violet-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
              >
                <Wallet size={16} />
                <span>{balance ?? 0}</span>
                <span className="opacity-70 font-normal text-[10px] ml-0.5">{t('profile.balance.tokens')}</span>
              </button>

              {showSpinButton && (
                <button
                  onClick={() => { impact('light'); navigate('/spin') }}
                  className="relative w-11 h-11 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl flex items-center justify-center border border-white/5 active:scale-[0.98] transition-all group overflow-visible"
                >
                  <div className="relative w-6 h-6" style={{ animation: 'spin-slow 10s linear infinite' }}>
                    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
                      <circle cx="50" cy="50" r="48" fill="#18181b" stroke="#3f3f46" strokeWidth="4" />
                      <path d="M50 50 L50 4 A46 46 0 0 1 78.5 14 Z" fill="#8b5cf6" />
                      <path d="M50 50 L78.5 14 A46 46 0 0 1 96 50 Z" fill="#3f3f46" />
                      <path d="M50 50 L96 50 A46 46 0 0 1 78.5 86 Z" fill="#7c3aed" />
                      <path d="M50 50 L78.5 86 A46 46 0 0 1 50 96 Z" fill="#27272a" />
                      <path d="M50 50 L50 96 A46 46 0 0 1 21.5 86 Z" fill="#8b5cf6" />
                      <path d="M50 50 L21.5 86 A46 46 0 0 1 4 50 Z" fill="#3f3f46" />
                      <path d="M50 50 L4 50 A46 46 0 0 1 21.5 14 Z" fill="#7c3aed" />
                      <path d="M50 50 L21.5 14 A46 46 0 0 1 50 4 Z" fill="#27272a" />
                      <circle cx="50" cy="50" r="12" fill="#18181b" stroke="#52525b" strokeWidth="2" />
                      <circle cx="50" cy="50" r="6" fill="#fbbf24" />
                    </svg>
                  </div>

                  {/* Badge */}
                  <div className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold px-1 min-w-[16px] h-4 rounded-full flex items-center justify-center border border-zinc-900 shadow-sm z-10 pointer-events-none">
                    {spins}
                  </div>
                </button>
              )}
              {/* Channel Reward Button - Only show if not claimed */}
              {!channelReward.loading && channelReward.show && (
                <button
                  onClick={() => { impact('light'); setShowRewardModal(true) }}
                  className="relative w-11 h-11 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl flex items-center justify-center border border-white/5 active:scale-[0.98] transition-all overflow-visible"
                >
                  <Gift size={18} className="text-amber-400" />
                  {/* Badge */}
                  <div className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold px-1 min-w-[16px] h-4 rounded-full flex items-center justify-center border border-zinc-900 shadow-sm z-10 pointer-events-none">
                    1
                  </div>
                </button>
              )}
              <button
                className="w-11 h-11 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl flex items-center justify-center border border-white/5 active:scale-[0.98] transition-all"
                onClick={() => {
                  impact('light')
                  if (!user?.id) return
                  const deepLink = `https://t.me/AiVerseAppBot?startapp=profile-${user.id}`
                  const shareText = t('profile.actions.share.text')
                  // Force link in text for better compat
                  const fullShareText = `${shareText}\n${deepLink}`

                  if (navigator.share) {
                    navigator.share({
                      title: t('profile.actions.share.title'),
                      text: fullShareText
                    }).catch(() => {
                      // Share cancelled or failed - do nothing to avoid double popup
                    })
                  } else {
                    const wa = (window as any).Telegram?.WebApp
                    if (wa) {
                      wa.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(fullShareText)}`)
                    } else {
                      window.open(`https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(fullShareText)}`, '_blank')
                    }
                  }
                }}
              >
                <Share2 size={18} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f || !user?.id) return

                const reader = new FileReader()
                reader.onload = (ev) => {
                  const base64 = String(ev.target?.result || '')
                  setAvatarSrc(base64)
                  setShowAvatarModal(false)

                  fetch('/api/user/avatar/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                    body: JSON.stringify({ userId: user.id, imageBase64: base64 })
                  }).then(async (r) => {
                    if (r.ok) {
                      impact('medium')
                      notify('success')
                    } else {
                      notify('error')
                    }
                  })
                }
                reader.readAsDataURL(f)
              }} />
            </div>
          </div>
        </div>

        {/* Channel Reward Modal */}
        {showRewardModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowRewardModal(false)}>
            <div className="bg-zinc-900 rounded-2xl border border-white/10 p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <Gift size={24} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{t('rewards.subscribe')}</h3>
                    <p className="text-xs text-zinc-400">@aiversebots</p>
                  </div>
                </div>
                <button onClick={() => setShowRewardModal(false)} className="text-zinc-500 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <p className="text-sm text-zinc-300 mb-6">
                {t('rewards.modalDescription', { defaultValue: 'Подпишитесь на наш канал и получите бонусные токены!' })}
              </p>
              <button
                onClick={async () => {
                  if (channelReward.claiming || !user?.id) return
                  impact('light')
                  setShowRewardModal(false)

                  // Open channel first
                  const wa = (window as any).Telegram?.WebApp
                  if (wa) {
                    wa.openTelegramLink('https://t.me/aiversebots')
                  } else {
                    window.open('https://t.me/aiversebots', '_blank')
                  }

                  // Wait a bit then try to claim
                  setTimeout(async () => {
                    setChannelReward(prev => ({ ...prev, claiming: true }))
                    try {
                      const r = await fetch('/api/user/claim-channel-reward', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                        body: JSON.stringify({ userId: user.id })
                      })
                      const j = await r.json().catch(() => null)
                      if (r.ok && j) {
                        if (j.success) {
                          impact('heavy')
                          notify('success')
                          setBalance(j.newBalance)
                          setChannelReward({ show: false, loading: false, claiming: false })
                          const wa = (window as any).Telegram?.WebApp
                          if (wa && wa.showAlert) {
                            wa.showAlert(t('rewards.success'))
                          }
                        } else if (j.notSubscribed) {
                          notify('warning')
                          const wa = (window as any).Telegram?.WebApp
                          if (wa && wa.showAlert) {
                            wa.showAlert(t('rewards.notSubscribed'))
                          }
                        } else if (j.alreadyClaimed) {
                          setChannelReward({ show: false, loading: false, claiming: false })
                        }
                      }
                    } catch {
                      notify('error')
                    } finally {
                      setChannelReward(prev => ({ ...prev, claiming: false }))
                    }
                  }, 2000)
                }}
                disabled={channelReward.claiming}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold py-3 rounded-xl shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {channelReward.claiming ? t('rewards.checking') : t('rewards.claim')}
              </button>
            </div>
          </div>
        )}
        <div>
          <div className="flex justify-between items-center mb-2 px-1">
            <div className="text-lg font-bold text-white">{t('profile.history.title')}</div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50"
            >
              <RefreshCw size={16} className={`text-zinc-400 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {/* Storage Info Banner */}
          <div className="mb-4 px-1">
            <div className="flex items-start gap-2 p-3 bg-zinc-900/50 rounded-xl border border-white/5 text-zinc-400">
              <Clock size={14} className="mt-0.5 flex-shrink-0 text-zinc-500" />
              <p className="text-[11px] leading-relaxed">
                <Trans i18nKey="profile.storage.text" components={[<span className="text-zinc-300 font-medium" />, <span className="text-emerald-400 font-medium" />]} />
              </p>
            </div>
          </div>
          {/* Filters */}
          <div className="mb-4 px-1 space-y-3">
            {/* Model Filter */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <Filter size={14} className="flex-shrink-0 text-zinc-500" />
              {[
                { value: '', label: t('profile.filters.all') },
                { value: 'nanobanana', label: 'NanoBanana' },
                { value: 'nanobanana-pro', label: 'NanoBanana Pro' },
                { value: 'seedream4', label: 'Seedream 4' },
                { value: 'seedream4-5', label: 'Seedream 4.5' },
                { value: 'gptimage1.5', label: 'GPT Image 1.5' },
              ].map(m => {
                const isActive = m.value === '' ? selectedModels.length === 0 : selectedModels.includes(m.value)
                return (
                  <button
                    key={m.value}
                    onClick={() => {
                      impact('light')
                      if (m.value === '') {
                        setSelectedModels([])
                      } else {
                        if (selectedModels.includes(m.value)) {
                          setSelectedModels(selectedModels.filter(x => x !== m.value))
                        } else {
                          setSelectedModels([...selectedModels, m.value])
                        }
                      }
                      setItems([])
                      setOffset(0)
                    }}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all border ${isActive
                      ? 'bg-violet-600 text-white border-violet-500'
                      : 'bg-zinc-800/50 text-zinc-400 border-white/5 hover:bg-zinc-700/50'
                      }`}
                  >
                    {m.label}
                  </button>
                )
              })}
            </div>
            {/* Visibility Filter */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <Globe size={14} className="flex-shrink-0 text-zinc-500" />
              <div className="flex flex-shrink-0 bg-zinc-800/50 rounded-full p-0.5 border border-white/5">
                {[
                  { value: 'all', label: t('profile.filters.all') },
                  { value: 'published', label: t('profile.filters.published') },
                  { value: 'private', label: t('profile.filters.private') },
                ].map(v => (
                  <button
                    key={v.value}
                    onClick={() => {
                      impact('light')
                      setVisibility(v.value as typeof visibility)
                      setItems([])
                      setOffset(0)
                    }}
                    className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${visibility === v.value
                      ? 'bg-violet-600 text-white'
                      : 'text-zinc-400 hover:text-white'
                      }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              {/* Media Type Filter */}
              <div className="flex flex-shrink-0 bg-zinc-800/50 rounded-full p-0.5 border border-white/5">
                {[
                  { value: 'all', label: t('profile.filters.all'), icon: null },
                  { value: 'image', label: t('profile.filters.photo'), icon: ImageIcon },
                  { value: 'video', label: t('profile.filters.video'), icon: Video },
                ].map(m => (
                  <button
                    key={m.value}
                    onClick={() => {
                      impact('light')
                      setMediaTypeFilter(m.value as typeof mediaTypeFilter)
                      setItems([])
                      setOffset(0)
                    }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 ${mediaTypeFilter === m.value
                      ? 'bg-violet-600 text-white'
                      : 'text-zinc-400 hover:text-white'
                      }`}
                  >
                    {m.icon && <m.icon size={12} />}
                    {m.label}
                  </button>
                ))}
              </div>
              {/* Edited filter toggle */}
              <button
                onClick={() => {
                  impact('light')
                  setShowEditedOnly(!showEditedOnly)
                  setItems([])
                  setOffset(0)
                }}
                className={`flex-shrink-0 w-8 h-8 rounded-full text-[11px] font-medium transition-all flex items-center justify-center border ${showEditedOnly
                  ? 'bg-violet-600 text-white border-violet-500'
                  : 'bg-zinc-800/50 text-zinc-400 hover:text-white border-white/5'
                  }`}
              >
                <Pencil size={14} />
              </button>
            </div>
          </div>
          {loading && items.length === 0 ? (
            <ProfileSkeletonGrid />
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-600 bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800"><HistoryIcon size={32} className="mb-3 opacity-20" /><p className="text-sm font-medium">{t('profile.history.empty')}</p></div>
          ) : (
            <>
              <div>
                <div className="grid grid-cols-2 gap-3">
                  {items.filter(h => !!(h.image_url || h.video_url || (h.media_type === 'video' && h.input_images && h.input_images.length > 0))).map((h, idx) => (
                    <div key={h.id} className="group relative rounded-2xl overflow-hidden border border-white/5 bg-zinc-900">
                      <button onClick={() => { setCurrentGenerationIndex(idx); setPreviewIndex(0); setPreview({ id: h.id, image_url: h.image_url || '', video_url: h.video_url, prompt: h.prompt, is_published: h.is_published, is_prompt_private: h.is_prompt_private, model: h.model, edit_variants: h.edit_variants, media_type: h.media_type, input_images: h.input_images }) }} className="block w-full">
                        <GridImage
                          src={h.compressed_url || h.image_url || ((h.media_type === 'video' && h.input_images && h.input_images.length > 0) ? h.input_images[0] : '')}
                          originalUrl={h.image_url || ((h.media_type === 'video' && h.input_images && h.input_images.length > 0) ? h.input_images[0] : '')}
                          alt="History"
                          className="w-full aspect-square object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </button>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 pointer-events-none"></div>
                      {h.model && (
                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-md border border-white/10 font-medium z-10 pointer-events-none">
                          {getModelDisplayName(h.model)}
                        </div>
                      )}
                      {/* Edit variants indicator */}
                      {h.edit_variants && h.edit_variants.length > 0 && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-violet-500/80 backdrop-blur-md flex items-center justify-center z-10 pointer-events-none border border-violet-400/30">
                          <Pencil size={12} className="text-white" />
                        </div>
                      )}
                      {/* Video indicator */}
                      {h.media_type === 'video' && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500/80 backdrop-blur-md flex items-center justify-center z-10 pointer-events-none border border-red-400/30">
                          <Video size={12} className="text-white" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-[10px] text-zinc-300 truncate font-medium">{cleanPrompt(h.prompt)}</p>
                        {h.is_published && <div className="absolute top-2 right-2 bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded-md backdrop-blur-sm border border-emerald-500/20">{t('profile.preview.publicLabel')}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                {items.length > 0 && (
                  <div className="mt-4 flex justify-center">
                    <button onClick={async () => { if (loading || !user?.id) return; setLoading(true); const modelParam = selectedModels.length > 0 ? `&model=${selectedModels.join(',')}` : ''; const visibilityParam = visibility !== 'all' ? `&visibility=${visibility}` : ''; try { const r = await fetch(`/api/user/generations?user_id=${user.id}&limit=6&offset=${offset + 6}${modelParam}${visibilityParam}`); const j = await r.json().catch(() => null); if (r.ok && j) { setItems([...items, ...j.items]); setOffset(offset + 6); setTotal(j.total) } } finally { setLoading(false); impact('light') } }} className="text-xs text-violet-400 bg-violet-500/5 border border-violet-500/10 hover:bg-violet-500/10 px-4 py-2 rounded-lg">{t('profile.history.loadMore')}</button>
                  </div>
                )}
              </div>
              {preview && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center px-4" onClick={(e) => { if (e.target === e.currentTarget) { setPreview(null); setCurrentGenerationIndex(null) } }}>
                  <div className={`relative w-full max-w-3xl ${platform === 'ios' ? 'mt-16' : ''}`}>
                    {/* Top buttons outside modal for video - positioned above the modal */}
                    {preview.media_type === 'video' && (
                      <div className="flex justify-between items-center px-2 pb-3">
                        <button
                          onClick={() => {
                            impact('light')
                            const shareUrl = preview.video_url || preview.image_url
                            if (navigator.share) {
                              navigator.share({ title: 'AiVerse', text: cleanPrompt(preview.prompt), url: shareUrl }).catch(() => { })
                            } else {
                              shareImage(shareUrl, cleanPrompt(preview.prompt))
                            }
                          }}
                          className="w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-white shadow-lg border border-white/10"
                        >
                          <Share2 size={20} />
                        </button>
                        {/* Copy Remix Link Button */}
                        <button
                          onClick={async () => {
                            impact('light')
                            const botUsername = 'AiVerseAppBot' // TODO: get dynamically if needed
                            const refParam = user?.username || String(user?.id || '')
                            const remixUrl = `https://t.me/${botUsername}?startapp=ref-${refParam}-remix-${preview.id}`
                            try {
                              await navigator.clipboard.writeText(remixUrl)
                              toast.success(t('profile.remixLinkCopied'))
                            } catch (e) {
                              console.error('Failed to copy remix link', e)
                              toast.error(t('common.error'))
                            }
                          }}
                          className="h-10 px-3 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center gap-2 text-white shadow-lg border border-white/10 text-xs font-medium"
                        >
                          <Copy size={16} />
                          <span>{t('profile.copyRemixFull')}</span>
                        </button>
                        <button
                          onClick={() => { setPreview(null); setCurrentGenerationIndex(null) }}
                          className="w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-white shadow-lg border border-white/10"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    )}
                    <div className="bg-zinc-900 rounded-2xl border border-white/10 overflow-hidden">
                      <div className="relative w-full aspect-square bg-black">
                        {/* Top buttons with better contrast - only for images */}
                        {preview.media_type !== 'video' && (
                          <div className="absolute top-0 left-0 right-0 px-2 pt-2 flex justify-between items-start z-20 pointer-events-none">
                            <button
                              onClick={() => {
                                impact('light')
                                const shareUrl = preview.image_url
                                if (navigator.share) {
                                  navigator.share({ title: 'AiVerse', text: cleanPrompt(preview.prompt), url: shareUrl }).catch(() => { })
                                } else {
                                  shareImage(shareUrl, cleanPrompt(preview.prompt))
                                }
                              }}
                              className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white backdrop-blur-md pointer-events-auto shadow-lg border border-white/10"
                            >
                              <Share2 size={20} />
                            </button>
                            {/* Copy Remix Link Button */}
                            <button
                              onClick={async () => {
                                impact('light')
                                const botUsername = 'AiVerseAppBot' // TODO: get dynamically if needed
                                const refParam = user?.username || String(user?.id || '')
                                const remixUrl = `https://t.me/${botUsername}?startapp=ref-${refParam}-remix-${preview.id}`
                                try {
                                  await navigator.clipboard.writeText(remixUrl)
                                  toast.success(t('profile.remixLinkCopied'))
                                } catch (e) {
                                  console.error('Failed to copy remix link', e)
                                  toast.error(t('common.error'))
                                }
                              }}
                              className="h-10 px-3 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center gap-2 text-white backdrop-blur-md pointer-events-auto shadow-lg border border-white/10 text-xs font-medium"
                            >
                              <Copy size={16} />
                              <span>{t('profile.copyRemix')}</span>
                            </button>
                            <button
                              onClick={() => {
                                impact('light')
                                setIsFullScreen(true)
                              }}
                              className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white backdrop-blur-md pointer-events-auto shadow-lg border border-white/10"
                            >
                              <Maximize2 size={20} />
                            </button>
                            <button
                              onClick={() => { setPreview(null); setCurrentGenerationIndex(null) }}
                              className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white backdrop-blur-md pointer-events-auto shadow-lg border border-white/10"
                            >
                              <X size={20} />
                            </button>
                          </div>
                        )}
                        {/* Bottom left - Delete variant button */}
                        {preview.edit_variants && preview.edit_variants.length > 0 && previewIndex > 0 && (
                          <div className="absolute bottom-2 left-2 z-20">
                            <button
                              onClick={() => {
                                impact('light')
                                setShowVariantDeleteConfirm(true)
                              }}
                              className="w-8 h-8 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center text-white backdrop-blur-md shadow-lg border border-red-400/30"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                        {/* Bottom center - Variant switcher */}
                        {preview.edit_variants && preview.edit_variants.length > 0 && (
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 py-1.5 px-2 bg-black/50 backdrop-blur-md rounded-lg border border-white/10">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                impact('light')
                                const allImages = [preview.image_url, ...preview.edit_variants!]
                                setPreviewIndex(prev => prev === 0 ? allImages.length - 1 : prev - 1)
                              }}
                              className="w-5 h-5 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center text-white active:scale-95 transition-all"
                            >
                              <ChevronLeft size={14} />
                            </button>
                            <span className="text-xs text-white/80 min-w-[28px] text-center font-medium">
                              {previewIndex + 1}/{[preview.image_url, ...preview.edit_variants].length}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                impact('light')
                                const allImages = [preview.image_url, ...preview.edit_variants!]
                                setPreviewIndex(prev => prev === allImages.length - 1 ? 0 : prev + 1)
                              }}
                              className="w-5 h-5 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center text-white active:scale-95 transition-all"
                            >
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        )}
                        {/* Bottom right - Edit button */}
                        {preview.media_type !== 'video' && (
                          <div className="absolute bottom-2 right-2 z-20">
                            <button
                              onClick={() => {
                                impact('light')
                                const currentImage = preview.edit_variants && preview.edit_variants.length > 0
                                  ? [preview.image_url, ...preview.edit_variants][previewIndex]
                                  : preview.image_url
                                setPreview(null)
                                setCurrentGenerationIndex(null)
                                navigate(`/editor?image=${encodeURIComponent(currentImage)}&generation_id=${preview.id}`)
                              }}
                              className="px-3 py-2 rounded-lg bg-black/50 hover:bg-black/70 flex items-center justify-center gap-1.5 text-white backdrop-blur-md shadow-lg border border-white/10 text-xs font-medium"
                            >
                              <Pencil size={14} />
                              {t('editor.edit')}
                            </button>
                          </div>
                        )}
                        {/* Navigation between generations */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            goToPrevGeneration()
                          }}
                          disabled={currentGenerationIndex === null || currentGenerationIndex <= 0}
                          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white backdrop-blur-md shadow-lg border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft size={24} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            goToNextGeneration()
                          }}
                          disabled={currentGenerationIndex === null || (currentGenerationIndex >= items.filter(h => !!(h.image_url || h.video_url || (h.media_type === 'video' && h.input_images && h.input_images.length > 0))).length - 1 && (total === undefined || items.length >= total))}
                          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white backdrop-blur-md shadow-lg border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronRight size={24} />
                        </button>
                        {/* Media content - video or image */}
                        {preview.media_type === 'video' && preview.video_url ? (
                          <>
                            {console.log('[Profile Video]', { media_type: preview.media_type, video_url: preview.video_url })}
                            <video
                              src={preview.video_url}
                              controls
                              loop
                              muted={isVideoMuted}
                              playsInline
                              className="w-full h-full object-contain"
                              onLoadStart={() => console.log('[Profile Video] Load started, url:', preview.video_url)}
                              onLoadedData={() => console.log('[Profile Video] Data loaded successfully')}
                              onCanPlay={() => console.log('[Profile Video] Can play now')}
                              onError={(e) => {
                                const video = e.currentTarget
                                console.error('[Profile Video] Error:', {
                                  url: preview.video_url,
                                  errorCode: video.error?.code,
                                  errorMsg: video.error?.message,
                                  networkState: video.networkState,
                                  readyState: video.readyState
                                })
                              }}
                            />
                          </>
                        ) : (
                          <img
                            src={preview.edit_variants && preview.edit_variants.length > 0
                              ? [preview.image_url, ...preview.edit_variants][previewIndex]
                              : preview.image_url
                            }
                            alt="Preview"
                            className="w-full h-full object-contain"
                          />
                        )}
                      </div>
                      <div className="p-4 flex flex-col gap-3">
                        {/* Send to Chat Section */}
                        <div className="border border-white/10 rounded-xl p-3 space-y-2">
                          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wide">{t('profile.preview.sendToSection')}</h4>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              onClick={async () => {
                                if (!user?.id) return
                                impact('light')
                                try {
                                  const fileUrl = (preview.media_type === 'video' && preview.video_url) ? preview.video_url : preview.image_url
                                  const r = await fetch('/api/telegram/sendDocument', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: user.id, file_url: fileUrl, caption: cleanPrompt(preview.prompt) }) })
                                  const j = await r.json().catch(() => null)
                                  if (r.ok && j?.ok) { notify('success') }
                                  else {
                                    notify('error')
                                    shareImage(fileUrl, cleanPrompt(preview.prompt))
                                  }
                                } catch {
                                  notify('error')
                                }
                              }}
                              className="min-h-[56px] h-auto py-2 px-1.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700 font-bold flex flex-col items-center justify-center gap-1 shadow-lg active:scale-[0.98]"
                            >
                              <Send size={18} className="flex-shrink-0" />
                              <span className="text-[10px] leading-tight text-center">{t('profile.preview.sendToChat')}</span>
                            </button>
                            <button
                              onClick={async () => {
                                if (!user?.id || !preview) return
                                setSendWithPromptLoading(true)
                                impact('medium')
                                try {
                                  const r = await fetch('/api/telegram/sendWithPrompt', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      chat_id: user.id,
                                      photo_url: preview.image_url,
                                      video_url: preview.video_url || null,
                                      prompt: cleanPrompt(preview.prompt),
                                      model: preview.model || '',
                                      username: user.username || null,
                                      user_id: user.id,
                                      generation_id: preview.id
                                    })
                                  })
                                  if (r.ok) {
                                    notify('success')
                                  } else {
                                    notify('error')
                                  }
                                } catch {
                                  notify('error')
                                } finally {
                                  setSendWithPromptLoading(false)
                                }
                              }}
                              disabled={sendWithPromptLoading || !preview.prompt}
                              className="min-h-[56px] h-auto py-2 px-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700 font-bold flex flex-col items-center justify-center gap-1 shadow-lg active:scale-[0.98] disabled:opacity-50"
                              title={t('profile.preview.sendWithPromptHint')}
                            >
                              {sendWithPromptLoading ? <Loader2 size={18} className="flex-shrink-0 animate-spin" /> : <MessageSquare size={18} className="flex-shrink-0" />}
                              <span className="text-[10px] leading-tight text-center">{t('profile.preview.sendWithPrompt')}</span>
                            </button>
                            <button
                              onClick={async () => {
                                if (!user?.id || !preview) return
                                setSendWithWatermarkLoading(true)
                                impact('medium')
                                try {
                                  const r = await fetch('/api/telegram/sendWithWatermark', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      chat_id: user.id,
                                      photo_url: preview.image_url,
                                      prompt: cleanPrompt(preview.prompt),
                                      model: preview.model || '',
                                      username: user.username || null,
                                      user_id: user.id,
                                      generation_id: preview.id
                                    })
                                  })
                                  const data = await r.json()
                                  if (r.ok) {
                                    notify('success')
                                  } else if (data.error === 'no_watermark_settings') {
                                    toast.error(t('profile.preview.noWatermarkSettings'))
                                  } else {
                                    notify('error')
                                  }
                                } catch {
                                  notify('error')
                                } finally {
                                  setSendWithWatermarkLoading(false)
                                }
                              }}
                              disabled={sendWithWatermarkLoading || preview.media_type === 'video'}
                              className="min-h-[56px] h-auto py-2 px-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700 font-bold flex flex-col items-center justify-center gap-1 shadow-lg active:scale-[0.98] disabled:opacity-50"
                              title={t('profile.preview.sendWithWatermarkHint')}
                            >
                              {sendWithWatermarkLoading ? <Loader2 size={18} className="flex-shrink-0 animate-spin" /> : <Droplets size={18} className="flex-shrink-0" />}
                              <span className="text-[10px] leading-tight text-center">{t('profile.preview.sendWithWatermark')}</span>
                            </button>
                          </div>
                        </div>

                        {/* Row 2: Save + Remix */}
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              impact('light')
                              if (preview.media_type === 'video' && preview.video_url) {
                                saveToGallery(preview.video_url, `ai-video-${Date.now()}.mp4`)
                              } else {
                                const currentImage = preview.edit_variants && preview.edit_variants.length > 0
                                  ? [preview.image_url, ...preview.edit_variants][previewIndex]
                                  : preview.image_url
                                saveToGallery(currentImage, `ai-${Date.now()}.jpg`)
                              }
                            }}
                            className="flex-1 min-h-[44px] py-2 px-2 rounded-xl bg-white text-black hover:bg-zinc-100 font-bold text-xs flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
                          >
                            <DownloadIcon size={16} />
                            {t('profile.preview.saveToGallery')}
                          </button>
                          <button
                            onClick={() => setShowRemixShareConfirm(true)}
                            disabled={remixShareLoading}
                            className="flex-1 min-h-[44px] py-2 px-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white hover:from-fuchsia-700 hover:to-violet-700 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg active:scale-[0.98] disabled:opacity-50"
                          >
                            {remixShareLoading ? <Loader2 size={14} className="flex-shrink-0 animate-spin" /> : <Repeat size={14} className="flex-shrink-0" />}
                            <span className="text-center leading-tight">{t('profile.preview.shareRemix')}</span>
                          </button>
                        </div>

                        {/* Row 3: Publish + Privacy */}
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              if (preview.is_published) {
                                handlePublish()
                              } else {
                                setShowPublishConfirm(true)
                              }
                            }}
                            className={`flex-1 min-h-[44px] py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg active:scale-[0.98] transition-colors ${preview.is_published ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                          >
                            {preview.is_published ? <EyeOff size={14} className="flex-shrink-0" /> : <Globe size={14} className="flex-shrink-0" />}
                            <span className="text-center leading-tight">{preview.is_published ? t('profile.preview.unpublish') : t('profile.preview.publish')}</span>
                          </button>
                          <button
                            onClick={handlePrivacyToggle}
                            className={`flex-1 min-h-[44px] py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg active:scale-[0.98] transition-colors border ${preview.is_prompt_private ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30' : 'bg-zinc-800 text-zinc-400 border-white/5 hover:bg-zinc-700'}`}
                            title={preview.is_prompt_private ? t('profile.preview.promptPrivate') : t('profile.preview.promptPublic')}
                          >
                            {preview.is_prompt_private ? <Lock size={14} /> : <Unlock size={14} />}
                            <span className="text-center leading-tight">{preview.is_prompt_private ? t('profile.preview.buttonPrivate') : t('profile.preview.buttonPublic')}</span>
                          </button>
                        </div>

                        {/* Prompt Actions */}
                        <div className="w-full flex gap-2">
                          <button
                            onClick={() => {
                              impact('light')
                              navigator.clipboard.writeText(cleanPrompt(preview.prompt))
                              notify('success')
                              setIsCopied(true)
                              setShowPrompt(true)
                              setTimeout(() => setIsCopied(false), 2000)
                            }}
                            className={`flex-1 py-2 rounded-xl border border-white/5 flex items-center justify-center gap-2 transition-all text-xs font-bold ${isCopied ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' : 'bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 hover:text-white'}`}
                          >
                            {isCopied ? <Check size={14} /> : <Copy size={14} />}
                            {isCopied ? t('profile.preview.copied') : t('profile.preview.showPrompt')}
                          </button>
                          {showPrompt && (
                            <button
                              onClick={() => {
                                impact('light')
                                setShowPrompt(false)
                              }}
                              className="px-3 py-2 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                            >
                              <EyeOff size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              impact('light')
                              setShowDeleteConfirm(true)
                            }}
                            className="w-10 h-10 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 flex items-center justify-center text-red-400 hover:text-red-300 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {showPrompt && (
                          <div className="w-full p-3 bg-zinc-900/80 rounded-xl border border-white/10 text-xs text-zinc-300 break-words animate-in fade-in slide-in-from-top-2 duration-200 max-h-32 overflow-y-auto custom-scrollbar">
                            {cleanPrompt(preview.prompt)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}



              {/* Publish Confirmation Modal */}
              {showPublishConfirm && (
                <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center px-4" onClick={(e) => { if (e.target === e.currentTarget) setShowPublishConfirm(false) }}>
                  <div className="w-full max-w-sm bg-zinc-900 rounded-2xl border border-white/10 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="text-center space-y-2">
                      <h3 className="text-lg font-bold text-white">{t('profile.publishConfirm.title')}</h3>
                      <p className="text-sm text-zinc-400">
                        {t('profile.publishConfirm.description')}
                      </p>
                    </div>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => setShowPublishConfirm(false)}
                        className="w-full py-3 rounded-xl bg-zinc-800 text-white font-bold text-sm hover:bg-zinc-700 transition-colors"
                      >
                        {t('profile.publishConfirm.cancel')}
                      </button>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handlePublish(false)}
                          className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold text-[10px] leading-tight hover:bg-emerald-700 transition-colors"
                        >
                          {t('profile.publishConfirm.publishOpen')}
                        </button>
                        <button
                          onClick={() => handlePublish(true)}
                          className="flex-1 py-3 rounded-xl bg-amber-600/80 text-white font-bold text-[10px] leading-tight hover:bg-amber-600 transition-colors"
                        >
                          {t('profile.publishConfirm.publishPrivate')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Remix Share Confirmation Modal */}
              {showRemixShareConfirm && preview && (
                <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center px-4" onClick={(e) => { if (e.target === e.currentTarget) setShowRemixShareConfirm(false) }}>
                  <div className="w-full max-w-sm bg-zinc-900 rounded-2xl border border-white/10 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="text-center space-y-2">
                      <h3 className="text-lg font-bold text-white">Поделиться с ремиксом</h3>
                      <p className="text-sm text-zinc-400">
                        Генерация будет отправлена в чат с ботом и станет публичной в ленте. Другие пользователи смогут использовать её для ремикса.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowRemixShareConfirm(false)}
                        className="flex-1 py-3 rounded-xl bg-zinc-800 text-white font-bold text-sm hover:bg-zinc-700 transition-colors"
                      >
                        {t('profile.publishConfirm.cancel')}
                      </button>
                      <button
                        onClick={async () => {
                          if (!preview || !user?.id) return
                          setRemixShareLoading(true)
                          setShowRemixShareConfirm(false)
                          try {
                            impact('medium')
                            const res = await fetch('/api/telegram/sendRemixShare', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                chat_id: user.id,
                                photo_url: preview.image_url,
                                generation_id: preview.id,
                                owner_username: user.username || null,
                                owner_user_id: user.id,
                                model: preview.model || null,
                                video_url: preview.video_url || null
                              })
                            })
                            if (res.ok) {
                              notify('success')
                              // Update local state to show as published
                              setPreview(prev => prev ? { ...prev, is_published: true } : null)
                              setItems(prev => prev.map(item => item.id === preview.id ? { ...item, is_published: true } : item))
                            } else {
                              notify('error')
                            }
                          } catch (e) {
                            console.error('Remix share failed', e)
                            notify('error')
                          } finally {
                            setRemixShareLoading(false)
                          }
                        }}
                        disabled={remixShareLoading}
                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white font-bold text-sm hover:from-fuchsia-700 hover:to-violet-700 transition-colors disabled:opacity-50"
                      >
                        {remixShareLoading ? 'Отправка...' : 'Поделиться'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Delete Confirmation Modal */}
              {showDeleteConfirm && preview && (
                <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center px-4" onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteConfirm(false) }}>
                  <div className="w-full max-w-sm bg-zinc-900 rounded-2xl border border-white/10 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="text-center space-y-2">
                      <h3 className="text-lg font-bold text-white">{t('profile.deleteConfirm.title')}</h3>
                      <p className="text-sm text-zinc-400">
                        {t('profile.deleteConfirm.description')}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 py-3 rounded-xl bg-zinc-800 text-white font-bold text-sm hover:bg-zinc-700 transition-colors"
                      >
                        {t('profile.deleteConfirm.cancel')}
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={deleteLoading}
                        className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {deleteLoading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        {deleteLoading ? t('profile.preview.delete') : t('profile.preview.delete')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Variant Delete Confirmation Modal */}
              {showVariantDeleteConfirm && preview && previewIndex > 0 && (
                <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center px-4" onClick={(e) => { if (e.target === e.currentTarget) setShowVariantDeleteConfirm(false) }}>
                  <div className="w-full max-w-sm bg-zinc-900 rounded-2xl border border-white/10 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="text-center space-y-2">
                      <h3 className="text-lg font-bold text-white">{t('profile.deleteVariantConfirm.title', 'Удалить вариант?')}</h3>
                      <p className="text-sm text-zinc-400">
                        {t('profile.deleteVariantConfirm.description', 'Этот вариант редактирования будет удалён. Оригинальное изображение останется.')}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowVariantDeleteConfirm(false)}
                        className="flex-1 py-3 rounded-xl bg-zinc-800 text-white font-bold text-sm hover:bg-zinc-700 transition-colors"
                      >
                        {t('profile.deleteConfirm.cancel')}
                      </button>
                      <button
                        onClick={handleDeleteVariant}
                        disabled={variantDeleteLoading}
                        className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {variantDeleteLoading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        {t('profile.preview.delete')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {isFullScreen && preview && (
                <div className="fixed inset-0 z-[200] bg-black flex flex-col">
                  <div className={`absolute top-0 right-0 z-50 p-4 ${platform === 'android' ? 'pt-[calc(5rem+env(safe-area-inset-top))]' : 'pt-[calc(3rem+env(safe-area-inset-top))]'}`}>
                    <button
                      onClick={() => setIsFullScreen(false)}
                      className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md"
                    >
                      <X size={24} />
                    </button>
                  </div>

                  <div className="w-full h-full flex items-center justify-center overflow-hidden">
                    <TransformWrapper
                      initialScale={1}
                      minScale={1}
                      maxScale={4}
                      centerOnInit
                      alignmentAnimation={{ sizeX: 0, sizeY: 0 }}
                    >
                      <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img
                          src={preview.image_url}
                          alt="Fullscreen"
                          className="max-w-full max-h-full object-contain"
                        />
                      </TransformComponent>
                    </TransformWrapper>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Avatar Change Modal */}
      {
        showAvatarModal && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center px-4" onClick={(e) => { if (e.target === e.currentTarget) { setShowAvatarModal(false); setShowAvatarOptions(false) } }}>
            <div className="w-full max-w-sm bg-zinc-900 rounded-2xl border border-white/10 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200">
              {/* Avatar Preview */}
              <div className="flex justify-center">
                <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-br from-violet-500 via-fuchsia-500 to-indigo-500 shadow-xl">
                  <div className="w-full h-full rounded-full bg-black overflow-hidden">
                    <img
                      src={avatarSrc || avatarUrl}
                      alt={displayName}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = avatarUrl }}
                    />
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-bold text-white text-center">{displayName}</h3>

              {!showAvatarOptions ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowAvatarModal(false); setShowAvatarOptions(false) }}
                    className="flex-1 py-3 rounded-xl bg-zinc-800 text-white font-bold text-sm hover:bg-zinc-700 transition-colors"
                  >
                    {t('profile.actions.close')}
                  </button>
                  <button
                    onClick={() => setShowAvatarOptions(true)}
                    className="flex-1 py-3 rounded-xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit size={16} />
                    {t('profile.actions.change')}
                  </button>
                </div>
              ) : (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full py-3 rounded-xl bg-zinc-800 text-white font-bold text-sm hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <User size={16} />
                    {t('profile.actions.selectFromGallery')}
                  </button>

                  {/* Paste zone */}
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onPaste={async (e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (!user?.id) return

                      const items = e.clipboardData?.items
                      if (!items) return

                      for (const item of Array.from(items)) {
                        if (item.type.startsWith('image/')) {
                          const file = item.getAsFile()
                          if (!file) continue

                          const reader = new FileReader()
                          reader.onload = (ev) => {
                            const base64 = String(ev.target?.result || '')
                            setAvatarSrc(base64)
                            setShowAvatarModal(false)
                            setShowAvatarOptions(false)

                            fetch('/api/user/avatar/upload', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                              body: JSON.stringify({ userId: user.id, imageBase64: base64 })
                            }).then(async (r) => {
                              if (r.ok) {
                                impact('medium')
                                notify('success')
                              } else {
                                notify('error')
                              }
                            })
                          }
                          reader.readAsDataURL(file)
                          break
                        }
                      }
                      e.currentTarget.innerHTML = ''
                    }}
                    onInput={(e) => { e.currentTarget.innerHTML = '' }}
                    className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-violet-500/30 bg-violet-500/5 flex items-center justify-center gap-2 text-violet-300 text-sm font-medium cursor-text focus:outline-none focus:border-violet-500/50 focus:bg-violet-500/10"
                  >
                    <Clipboard size={16} />
                    <span>{t('profile.actions.pastePrompt')}</span>
                  </div>

                  <button
                    onClick={() => setShowAvatarOptions(false)}
                    className="w-full py-2 text-zinc-500 text-xs hover:text-zinc-300 transition-colors"
                  >
                    {t('profile.actions.back')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      }

      <PaymentModal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} />

      <GenerationSelector
        isOpen={showCoverSelector}
        onClose={() => setShowCoverSelector(false)}
        onSelect={handleCoverSelect}
      />
      <ChannelSubscriptionModal />
    </div >
  )
}
