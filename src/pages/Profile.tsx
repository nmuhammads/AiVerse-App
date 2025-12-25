import React, { useState, useEffect, useRef } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { Sparkles, Share2, Edit, History as HistoryIcon, X, Download as DownloadIcon, Send, Wallet, Settings as SettingsIcon, Globe, EyeOff, Maximize2, Copy, Check, Crown, Grid, Info, List as ListIcon, Loader2, User, RefreshCw, Clipboard, Camera, Clock, Repeat, Trash2, Filter, Pencil, ChevronLeft, ChevronRight } from 'lucide-react'

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
import { GenerationSelector } from '@/components/GenerationSelector'
import { useNavigate } from 'react-router-dom'
import { useHaptics } from '@/hooks/useHaptics'
import { useTelegram } from '@/hooks/useTelegram'
import { useGenerationStore } from '@/store/generationStore'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { ProfileSkeletonGrid } from '@/components/ui/skeleton'

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
  const { user, platform, saveToGallery, shareImage } = useTelegram()
  const [avatarSrc, setAvatarSrc] = useState<string>('')
  const [coverSrc, setCoverSrc] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [spins, setSpins] = useState<number>(0)
  const [likes, setLikes] = useState<number>(0)
  const [remixCount, setRemixCount] = useState<number>(0)
  const [followingCount, setFollowingCount] = useState<number>(0)
  const [followersCount, setFollowersCount] = useState<number>(0)
  const [items, setItems] = useState<{ id: number; image_url: string | null; compressed_url?: string | null; prompt: string; created_at: string | null; is_published: boolean; model?: string | null; edit_variants?: string[] | null }[]>([])
  const [preview, setPreview] = useState<{ id: number; image_url: string; prompt: string; is_published: boolean; model?: string | null; edit_variants?: string[] | null } | null>(null)
  const [previewIndex, setPreviewIndex] = useState(0) // 0 = original, 1+ = edit variants
  const [showPrompt, setShowPrompt] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [total, setTotal] = useState<number | undefined>(undefined)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  // Filters
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [visibility, setVisibility] = useState<'all' | 'published' | 'private'>('all')
  const [showEditedOnly, setShowEditedOnly] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [showAvatarModal, setShowAvatarModal] = useState(false)
  const [showCoverSelector, setShowCoverSelector] = useState(false)
  const [showAvatarOptions, setShowAvatarOptions] = useState(false)
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
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: user.id })
            }).catch(() => { })

            const r = await fetch(`/api/user/generations?user_id=${user.id}&limit=6&offset=0`)
            const j = await r.json().catch(() => null)
            if (r.ok && j) { setItems(j.items || []); setTotal(j.total); setOffset(0) }
          } finally { setLoading(false) }
        })()
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
          setItems(filteredItems)
          setTotal(j.total)
          setOffset(0)
        }
      })
      .finally(() => setLoading(false))
  }, [user?.id, selectedModels, visibility, showEditedOnly])

  const {
    setPrompt,
    setSelectedModel,
    setParentGeneration,
    setCurrentScreen,
    setAspectRatio,
    setGenerationMode,
    setUploadedImages
  } = useGenerationStore()

  const handleRemix = (item: any) => {
    impact('medium')

    // Parse metadata from prompt
    let cleanPrompt = item.prompt
    let metadata: Record<string, string> = {}

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
        'qwen-edit': 'seedream4-5'
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

    if (item.input_images && item.input_images.length > 0) {
      setUploadedImages(item.input_images)
      setGenerationMode('image')
    } else {
      setUploadedImages([])
    }

    setParentGeneration(item.id, item.author?.username || user?.username)
    setCurrentScreen('form')
    navigate('/studio')
  }

  const stats = [
    { label: t('profile.stats.generations'), value: typeof total === 'number' ? total : items.length },
    { label: t('profile.stats.followers'), value: followersCount },
    { label: t('profile.stats.likes'), value: likes },
    { label: t('profile.stats.remixes'), value: remixCount },
  ]
  const paddingTop = platform === 'ios' ? 'calc(env(safe-area-inset-top) + 5px)' : 'calc(env(safe-area-inset-top) + 50px)'

  const [showPublishConfirm, setShowPublishConfirm] = useState(false)
  const [showRemixShareConfirm, setShowRemixShareConfirm] = useState(false)
  const [remixShareLoading, setRemixShareLoading] = useState(false)
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id })
      })
      if (res.ok) {
        impact('medium')
        notify('success')
        // Remove from local state
        setItems(prev => prev.filter(item => item.id !== preview.id))
        setTotal(prev => (prev !== undefined ? prev - 1 : prev))
        setPreview(null)
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
        headers: { 'Content-Type': 'application/json' },
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

  const handlePublish = async () => {
    if (!preview) return
    impact('medium')
    const newStatus = !preview.is_published

    // Optimistic update
    setPreview(prev => prev ? { ...prev, is_published: newStatus } : null)
    setItems(prev => prev.map(i => i.id === preview.id ? { ...i, is_published: newStatus } : i))
    setShowPublishConfirm(false)

    try {
      const r = await fetch('/api/user/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generationId: preview.id, isPublished: newStatus })
      })
      if (r.ok) {
        notify('success')
      } else {
        notify('error')
        // Revert
        setPreview(prev => prev ? { ...prev, is_published: !newStatus } : null)
        setItems(prev => prev.map(i => i.id === preview.id ? { ...i, is_published: !newStatus } : i))
      }
    } catch {
      notify('error')
      // Revert
      setPreview(prev => prev ? { ...prev, is_published: !newStatus } : null)
      setItems(prev => prev.map(i => i.id === preview.id ? { ...i, is_published: !newStatus } : i))
    }
  }


  const handleCoverSelect = async (generationId: number) => {
    if (!user?.id) return
    try {
      const r = await fetch('/api/user/cover/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          {/* Cover Edit Button */}
          <button
            onClick={() => setShowCoverSelector(true)}
            className="absolute top-4 right-4 z-20 w-6 h-6 rounded-full bg-black/40 hover:bg-black/60 text-white/70 hover:text-white flex items-center justify-center backdrop-blur-md transition-colors border border-white/10"
          >
            <Camera size={16} />
          </button>

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
                  <img
                    src={avatarSrc || avatarUrl}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = avatarUrl }}
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
                    headers: { 'Content-Type': 'application/json' },
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
        <div>
          <div className="flex justify-between items-end mb-2 px-1">
            <div className="text-lg font-bold text-white">{t('profile.history.title')}</div>
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
            <div className="flex items-center gap-2">
              <Globe size={14} className="flex-shrink-0 text-zinc-500" />
              <div className="flex bg-zinc-800/50 rounded-full p-0.5 border border-white/5">
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
              {/* Edited filter toggle */}
              <button
                onClick={() => {
                  impact('light')
                  setShowEditedOnly(!showEditedOnly)
                  setItems([])
                  setOffset(0)
                }}
                className={`w-8 h-8 rounded-full text-[11px] font-medium transition-all flex items-center justify-center border ${showEditedOnly
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
                  {items.filter(h => !!h.image_url).map((h) => (
                    <div key={h.id} className="group relative rounded-2xl overflow-hidden border border-white/5 bg-zinc-900">
                      <button onClick={() => { setPreviewIndex(0); setPreview({ id: h.id, image_url: h.image_url || '', prompt: h.prompt, is_published: h.is_published, model: h.model, edit_variants: h.edit_variants }) }} className="block w-full">
                        <GridImage
                          src={h.compressed_url || h.image_url || ''}
                          originalUrl={h.image_url || ''}
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
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center px-4" onClick={(e) => { if (e.target === e.currentTarget) setPreview(null) }}>
                  <div className={`relative w-full max-w-3xl bg-zinc-900 rounded-2xl border border-white/10 overflow-hidden ${platform === 'ios' ? 'mt-16' : ''}`}>
                    <div className="relative w-full aspect-square bg-black">
                      {/* Top buttons with better contrast */}
                      <div className="absolute top-0 left-0 right-0 px-2 pt-2 flex justify-between items-start z-20 pointer-events-none">
                        <button
                          onClick={() => {
                            impact('light')
                            if (navigator.share) {
                              navigator.share({ title: 'AiVerse', text: cleanPrompt(preview.prompt), url: preview.image_url }).catch(() => { })
                            } else {
                              shareImage(preview.image_url, cleanPrompt(preview.prompt))
                            }
                          }}
                          className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white backdrop-blur-md pointer-events-auto shadow-lg border border-white/10"
                        >
                          <Share2 size={20} />
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
                          onClick={() => setPreview(null)}
                          className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white backdrop-blur-md pointer-events-auto shadow-lg border border-white/10"
                        >
                          <X size={20} />
                        </button>
                      </div>
                      {/* Edit button bottom right */}
                      <div className="absolute bottom-2 right-2 z-20 pointer-events-none flex gap-2">
                        {/* Delete variant button - only show for edit variants (not original) */}
                        {preview.edit_variants && preview.edit_variants.length > 0 && previewIndex > 0 && (
                          <button
                            onClick={() => {
                              impact('light')
                              setShowVariantDeleteConfirm(true)
                            }}
                            className="px-3 py-2 rounded-lg bg-red-500/80 hover:bg-red-500 flex items-center justify-center gap-1.5 text-white backdrop-blur-md pointer-events-auto shadow-lg border border-red-400/30 text-xs font-medium"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            impact('light')
                            const currentImage = preview.edit_variants && preview.edit_variants.length > 0
                              ? [preview.image_url, ...preview.edit_variants][previewIndex]
                              : preview.image_url
                            setPreview(null)
                            navigate(`/editor?image=${encodeURIComponent(currentImage)}&generation_id=${preview.id}`)
                          }}
                          className="px-3 py-2 rounded-lg bg-black/50 hover:bg-black/70 flex items-center justify-center gap-1.5 text-white backdrop-blur-md pointer-events-auto shadow-lg border border-white/10 text-xs font-medium"
                        >
                          <Pencil size={14} />
                          {t('editor.edit')}
                        </button>
                      </div>
                      {/* Carousel navigation */}
                      {preview.edit_variants && preview.edit_variants.length > 0 && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              impact('light')
                              const allImages = [preview.image_url, ...preview.edit_variants!]
                              setPreviewIndex(prev => prev === 0 ? allImages.length - 1 : prev - 1)
                            }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white backdrop-blur-md shadow-lg border border-white/10"
                          >
                            <ChevronLeft size={24} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              impact('light')
                              const allImages = [preview.image_url, ...preview.edit_variants!]
                              setPreviewIndex(prev => prev === allImages.length - 1 ? 0 : prev + 1)
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white backdrop-blur-md shadow-lg border border-white/10"
                          >
                            <ChevronRight size={24} />
                          </button>
                          {/* Dots indicator */}
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
                            {[preview.image_url, ...preview.edit_variants].map((_, idx) => (
                              <button
                                key={idx}
                                onClick={(e) => { e.stopPropagation(); impact('light'); setPreviewIndex(idx) }}
                                className={`w-2 h-2 rounded-full transition-all ${idx === previewIndex ? 'bg-white w-4' : 'bg-white/50'}`}
                              />
                            ))}
                          </div>
                        </>
                      )}
                      <img
                        src={preview.edit_variants && preview.edit_variants.length > 0
                          ? [preview.image_url, ...preview.edit_variants][previewIndex]
                          : preview.image_url
                        }
                        alt="Preview"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="p-4 flex flex-col gap-3">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          onClick={() => {
                            impact('light')
                            const currentImage = preview.edit_variants && preview.edit_variants.length > 0
                              ? [preview.image_url, ...preview.edit_variants][previewIndex]
                              : preview.image_url
                            saveToGallery(currentImage, `ai-${Date.now()}.jpg`)
                          }}
                          className="flex-1 min-h-[48px] h-auto py-3 rounded-xl bg-white text-black hover:bg-zinc-100 font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
                        >
                          <DownloadIcon size={16} />
                          {t('profile.preview.saveToGallery')}
                        </button>
                        <button
                          onClick={async () => {
                            if (!user?.id) return
                            impact('light')
                            try {
                              const r = await fetch('/api/telegram/sendDocument', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: user.id, file_url: preview.image_url, caption: cleanPrompt(preview.prompt) }) })
                              const j = await r.json().catch(() => null)
                              if (r.ok && j?.ok) { notify('success') }
                              else {
                                notify('error')
                                shareImage(preview.image_url, cleanPrompt(preview.prompt))
                              }
                            } catch {
                              notify('error')
                            }
                          }}
                          className="flex-1 min-h-[48px] h-auto py-3 rounded-xl bg-violet-600 text-white hover:bg-violet-700 font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
                        >
                          <Send size={16} />
                          {t('profile.preview.sendToChat')}
                        </button>
                      </div>

                      {/* Row 2: Remix + Publish */}
                      <div className="flex gap-3">
                        <button
                          onClick={() => setShowRemixShareConfirm(true)}
                          disabled={remixShareLoading}
                          className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white hover:from-fuchsia-700 hover:to-violet-700 font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] disabled:opacity-50 overflow-hidden"
                        >
                          {remixShareLoading ? <Loader2 size={14} className="flex-shrink-0 animate-spin" /> : <Repeat size={14} className="flex-shrink-0" />}
                          <span className="truncate">{t('profile.preview.shareRemix')}</span>
                        </button>
                        <button
                          onClick={() => {
                            if (preview.is_published) {
                              handlePublish()
                            } else {
                              setShowPublishConfirm(true)
                            }
                          }}
                          className={`flex-1 min-h-[44px] py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-colors ${preview.is_published ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                        >
                          {preview.is_published ? <EyeOff size={14} /> : <Globe size={14} />}
                          {preview.is_published ? t('profile.preview.unpublish') : t('profile.preview.publish')}
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
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowPublishConfirm(false)}
                        className="flex-1 py-3 rounded-xl bg-zinc-800 text-white font-bold text-sm hover:bg-zinc-700 transition-colors"
                      >
                        {t('profile.publishConfirm.cancel')}
                      </button>
                      <button
                        onClick={handlePublish}
                        className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors"
                      >
                        {t('profile.publishConfirm.confirm')}
                      </button>
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
                                model: preview.model || null
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
                              headers: { 'Content-Type': 'application/json' },
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
    </div >
  )
}
