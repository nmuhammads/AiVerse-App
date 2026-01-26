import { useEffect } from 'react'
import { type ModelType } from '@/store/generationStore'
import { DevModeBanner } from '@/components/DevModeBanner'
import { ActiveGenerationsPanel } from '@/components/ActiveGenerationsPanel'
import { DescribeImageModal } from '@/components/DescribeImageModal'
import { PaymentModal } from '@/components/PaymentModal'
import { AIChatOverlay } from '@/components/AIChatOverlay'
import { ChatOnboardingOverlay } from '@/components/ChatOnboardingOverlay'
import { ChatModeExitOnboarding } from '@/components/ChatModeExitOnboarding'
import { useActiveGenerationsStore } from '@/store/activeGenerationsStore'
import { useTranslation } from 'react-i18next'
import { Zap, Pencil } from 'lucide-react'

// Components
import { ModelSelector } from '@/pages/Studio/ModelSelector'
import { PromptInput } from '@/pages/Studio/PromptInput'
import { ImageUploader } from '@/pages/Studio/ImageUploader'
import { SettingsPanel } from '@/pages/Studio/SettingsPanel'
import { VideoSettings } from '@/pages/Studio/VideoSettings'
import { GenerateButton } from '@/pages/Studio/GenerateButton'
import { ResultView } from '@/pages/Studio/ResultView'
import { InsufficientBalanceModal } from '@/pages/Studio/InsufficientBalanceModal'
import { TimeoutModal } from '@/pages/Studio/TimeoutModal'
import { StudioModeToggle } from '@/pages/Studio/StudioModeToggle'

// Hook & Constants
import { useStudio } from '@/pages/Studio/hooks/useStudio'
import {
  IMAGE_MODELS,
  VIDEO_MODELS,
  GPT_IMAGE_PRICES,
  SUPPORTED_RATIOS,
  RATIO_EMOJIS,
  RATIO_DISPLAY_NAMES,
} from '@/pages/Studio/constants'

// --- Header Component ---
type TranslationFn = ReturnType<typeof useTranslation>['t']
type StudioHeaderProps = {
  t: TranslationFn
  balance: number | null
  onOpenEditor: () => void
  onOpenPayment: () => void
}

function StudioHeader({ t, balance, onOpenEditor, onOpenPayment }: StudioHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <StudioModeToggle />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenEditor}
          className="px-3 py-1.5 rounded-full bg-cyan-600/20 border border-cyan-500/30 flex items-center gap-1.5 active:scale-95 transition-transform"
        >
          <Pencil size={14} className="text-cyan-400" />
          <span className="text-xs font-bold text-cyan-300">{t('editor.title')}</span>
        </button>
        <button
          onClick={onOpenPayment}
          className="px-3 py-1.5 rounded-full bg-zinc-900 border border-white/10 flex items-center gap-1.5 active:scale-95 transition-transform"
        >
          <Zap size={14} className="text-yellow-500 fill-yellow-500" />
          {balance === null ? (
            <div className="h-4 w-8 bg-zinc-700 rounded animate-pulse" />
          ) : (
            <span className="text-xs font-bold text-white">{balance}</span>
          )}
        </button>
      </div>
    </div>
  )
}

export default function Studio() {
  const activeGens = useActiveGenerationsStore(state => state.generations)
  const hasActiveGens = activeGens.length > 0

  const {
    t,
    platform,
    balance,
    selectedModel,
    mediaType,
    prompt,
    uploadedImages,
    uploadedVideoUrl,
    aspectRatio,
    generationMode,
    error,
    currentScreen,
    parentAuthorUsername,
    parentGenerationId,
    isPromptPrivate,
    showBalancePopup,
    showTimeoutModal,
    showCountSelector,
    isPaymentModalOpen,
    isFullScreen,
    isMuted,
    isOptimizing,
    isDescribeModalOpen,
    isUploadingImage,
    isUploadingVideo,
    availableSlots,
    priceLabel,
    isGenerateDisabled,
    inputKey,
    studioMode,

    // Refs
    fileInputRef,
    cameraInputRef,
    videoInputRef,

    // Result State
    hasResult,
    resultUrl,
    isVideoResult,
    hasMultipleImages,
    generatedImages,
    currentImageIndex,

    // Setters
    setShowBalancePopup,
    setIsPaymentModalOpen,
    setShowTimeoutModal,
    setShowCountSelector,
    setIsFullScreen,
    setIsMuted,
    setIsDescribeModalOpen,
    setIsUploadingVideo,

    setPrompt,
    setMediaType,
    setSelectedModel,
    setGenerationMode,
    setUploadedImages,
    addUploadedImage,
    removeUploadedImage,
    setUploadedVideoUrl,
    setAspectRatio,
    setError,
    setImageCount,
    setVideoDuration,
    setVideoResolution,
    setFixedLens,
    setGenerateAudio,
    setKlingVideoMode,
    setKlingDuration,
    setKlingSound,
    setKlingMCQuality,
    setCharacterOrientation,
    setVideoDurationSeconds,
    setResolution,
    setGptImageQuality,
    setParentGeneration,

    // Handlers
    impact,
    navigate,
    handleGenerate,
    handleOptimizePrompt,
    handleImageUpload,
    processPastedFiles,
    handleViewGenerationResult,

    // Result Handlers
    handleCloseResult,
    handleSaveResult,
    handleSendToChat,
    handleEditResult,
    handlePrevImage,
    handleNextImage,
    handleSelectImage,

    // Additional data
    gptImageQuality,
    resolution,
    videoDuration,
    videoResolution,
    fixedLens,
    generateAudio,
    klingDuration,
    klingSound,
    klingMCQuality,
    characterOrientation,
    videoDurationSeconds,
    klingVideoMode,
    imageCount,
  } = useStudio()

  // Prevent body scroll when in chat mode
  useEffect(() => {
    if (studioMode === 'chat') {
      const originalStyle = window.getComputedStyle(document.body).overflow
      document.body.style.overflow = 'hidden'
      document.body.style.overscrollBehavior = 'none'
      return () => {
        document.body.style.overflow = originalStyle
        document.body.style.overscrollBehavior = 'auto'
      }
    }
  }, [studioMode])

  // Different padding for Chat (fixed inset-0) and Studio (in-flow)
  // Chat ignores App padding, so needs full safe-area + header calculation
  const chatHeaderTop = platform === 'ios'
    ? 'var(--header-offset-ios)'
    : 'calc(var(--header-offset-android) + 20px)'
  const chatContainerTop = platform === 'ios'
    ? 'calc(var(--header-offset-ios) + 52px)'
    : 'calc(var(--header-offset-android) + 72px)'

  // Studio is inside App which already has safe-area padding
  // So we only need to offset the Header height
  const studioPaddingTop = platform === 'ios' ? '54px' : '56px'

  const isAndroid = platform === 'android'
  // Используем CSS классы для позиционирования над TabBar
  const tabbarOffsetClass = isAndroid ? 'pb-tabbar-android' : 'pb-tabbar-ios'
  const studioOffsetClass = isAndroid ? 'pb-studio-android' : 'pb-studio-ios' // extra padding for generate button
  const aboveTabbarClass = isAndroid ? 'above-tabbar-android' : 'above-tabbar-ios'
  const chatContainerClass = isAndroid ? 'chat-container-android' : 'chat-container-ios'

  // Рендеринг Result View
  if (hasResult) {
    return (
      <ResultView
        t={t}
        platform={platform}
        resultUrl={resultUrl}
        isVideoResult={isVideoResult}
        hasMultipleImages={hasMultipleImages}
        generatedImages={generatedImages}
        currentImageIndex={currentImageIndex}
        isMuted={isMuted}
        isFullScreen={isFullScreen}
        onToggleMuted={() => { setIsMuted(!isMuted); impact('light') }}
        onOpenFullScreen={() => { impact('light'); setIsFullScreen(true) }}
        onCloseFullScreen={() => setIsFullScreen(false)}
        onPrevImage={handlePrevImage}
        onNextImage={handleNextImage}
        onSelectImage={handleSelectImage}
        onSave={handleSaveResult}
        onSendToChat={handleSendToChat}
        onEdit={handleEditResult}
        onClose={handleCloseResult}
      />
    )
  }

  const ratios = SUPPORTED_RATIOS[selectedModel] || SUPPORTED_RATIOS['seedream4']
  const maxImages = 8

  // Режим чата - фиксированная позиция между header и tabbar
  if (studioMode === 'chat') {
    return (
      <div className="bg-black fixed inset-0 overflow-hidden z-0">
        {/* Header - prevent touch scrolling on background */}
        <div
          className="fixed left-0 right-0 z-50 mx-auto max-w-3xl w-full px-4 pt-4 pb-1 touch-none select-none bg-black"
          style={{ top: chatHeaderTop }}
        >
          <StudioHeader
            t={t}
            balance={balance}
            onOpenEditor={() => { impact('light'); navigate('/editor') }}
            onOpenPayment={() => { impact('light'); setIsPaymentModalOpen(true) }}
          />
        </div>

        {/* Chat Container - fixed position between header and tabbar */}
        <div className={`${chatContainerClass} mx-auto max-w-3xl px-4 z-30`} style={{ top: chatContainerTop }}>
          <div className="h-full bg-black rounded-2xl border border-white/5 overflow-hidden">
            <AIChatOverlay variant="inline" />
          </div>
        </div>

        {/* Modals */}
        <InsufficientBalanceModal
          isOpen={showBalancePopup}
          onClose={() => setShowBalancePopup(false)}
          onBuyTokens={() => {
            impact('medium')
            setShowBalancePopup(false)
            setIsPaymentModalOpen(true)
          }}
        />
        <PaymentModal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} />
        <DescribeImageModal
          isOpen={isDescribeModalOpen}
          onClose={() => setIsDescribeModalOpen(false)}
          onPromptGenerated={(generatedPrompt) => {
            setPrompt(generatedPrompt)
          }}
        />
        <TimeoutModal
          isOpen={showTimeoutModal}
          onClose={() => setShowTimeoutModal(false)}
        />
        <ChatModeExitOnboarding />
      </div>
    )
  }


  // Режим Studio
  return (
    <div
      className={`bg-black flex flex-col min-h-0 min-h-dvh ${studioOffsetClass}`}
      style={{ paddingTop: studioPaddingTop }}
    >
      <div className="mx-auto max-w-3xl w-full px-4 flex-1 min-h-0 flex flex-col gap-6 py-4">
        <StudioHeader
          t={t}
          balance={balance}
          onOpenEditor={() => { impact('light'); navigate('/editor') }}
          onOpenPayment={() => { impact('light'); setIsPaymentModalOpen(true) }}
        />

        <>
          {/* Dev Mode Banner */}
          <DevModeBanner />

          {/* 0. Media Type Toggle: Фото / Видео */}
          <ModelSelector
            t={t}
            mediaType={mediaType}
            selectedModel={selectedModel}
            generationMode={generationMode}
            klingVideoMode={klingVideoMode}
            impact={impact}
            imageModels={IMAGE_MODELS.map(({ id, icon }) => ({ id, icon }))}
            videoModels={VIDEO_MODELS}
            setMediaType={setMediaType}
            setSelectedModel={setSelectedModel}
            setGenerationMode={setGenerationMode}
            setUploadedImages={setUploadedImages}
            setUploadedVideoUrl={setUploadedVideoUrl}
            setKlingVideoMode={setKlingVideoMode}
            onOpenMultiGeneration={() => { impact('light'); navigate('/multi-generation') }}
          />

          {/* 3. Prompt Input */}
          {selectedModel !== 'kling-mc' && (
            <PromptInput
              t={t}
              prompt={prompt}
              isPromptPrivate={isPromptPrivate}
              parentAuthorUsername={parentAuthorUsername}
              isOptimizing={isOptimizing}
              onPromptChange={setPrompt}
              onClearPrompt={() => setPrompt('')}
              onClearParent={() => {
                setParentGeneration(null, null)
                setPrompt('')
                setUploadedImages([])
              }}
              onOptimize={handleOptimizePrompt}
              onDescribe={() => { impact('light'); setIsDescribeModalOpen(true) }}
              selectedModel={selectedModel}

            />
          )}

          {/* 4. Reference Image for IMAGES mode */}
          <ImageUploader
            t={t}
            mediaType={mediaType}
            generationMode={generationMode}
            selectedModel={selectedModel}
            uploadedImages={uploadedImages}
            parentGenerationId={parentGenerationId}
            maxImages={maxImages}
            isUploadingImage={isUploadingImage}
            fileInputRef={fileInputRef}
            onProcessPastedFiles={async (files) => {
              await processPastedFiles(files)
            }}
            onRemoveUploadedImage={removeUploadedImage}
            onSetUploadedImages={setUploadedImages}
          />

          <SettingsPanel
            t={t}
            selectedModel={selectedModel}
            ratios={ratios}
            aspectRatio={aspectRatio}
            ratioEmojis={RATIO_EMOJIS}
            ratioDisplayNames={RATIO_DISPLAY_NAMES}
            gptImageQuality={gptImageQuality}
            gptImagePrices={GPT_IMAGE_PRICES}
            resolution={resolution}
            onSetAspectRatio={setAspectRatio}
            onSetResolution={setResolution}
            onSetGptImageQuality={setGptImageQuality}
            onImpact={impact}
          />

          <VideoSettings
            t={t}
            mediaType={mediaType}
            selectedModel={selectedModel}
            videoDuration={videoDuration}
            videoResolution={videoResolution}
            fixedLens={fixedLens}
            generateAudio={generateAudio}
            klingDuration={klingDuration}
            klingSound={klingSound}
            klingMCQuality={klingMCQuality}
            characterOrientation={characterOrientation}
            uploadedImages={uploadedImages}
            uploadedVideoUrl={uploadedVideoUrl}
            videoDurationSeconds={videoDurationSeconds}
            isUploadingVideo={isUploadingVideo}
            videoInputRef={videoInputRef}
            prompt={prompt}
            onSetVideoDuration={setVideoDuration}
            onSetVideoResolution={setVideoResolution}
            onSetFixedLens={setFixedLens}
            onSetGenerateAudio={setGenerateAudio}
            onSetKlingDuration={setKlingDuration}
            onSetKlingSound={setKlingSound}
            onSetKlingMCQuality={setKlingMCQuality}
            onSetCharacterOrientation={setCharacterOrientation}
            onSetUploadedImages={setUploadedImages}
            onSetUploadedVideoUrl={setUploadedVideoUrl}
            onSetVideoDurationSeconds={setVideoDurationSeconds}
            onSetIsUploadingVideo={setIsUploadingVideo}
            onSetPrompt={setPrompt}
            onSetError={setError}
            onImpact={impact}
          />

          {/* Generate Button Fixed at Bottom */}
          <div className={`fixed left-0 right-0 ${aboveTabbarClass} z-40 px-4 transition-all duration-300 ${isFullScreen ? 'translate-y-[150%]' : 'translate-y-0'}`}>
            {/* Error Message */}
            {error && (
              <div className={`${error.includes('Время ожидания') ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'} border rounded-xl p-3 flex items-center gap-3 text-sm animate-in fade-in slide-in-from-bottom-2`}>
                <div className={`w-1.5 h-1.5 rounded-full ${error.includes('Время ожидания') ? 'bg-amber-500' : 'bg-rose-500'}`} />
                {error}
              </div>
            )}

            {/* Active Generations Panel */}
            <ActiveGenerationsPanel onViewResult={handleViewGenerationResult} />

            <GenerateButton
              t={t}
              mediaType={mediaType}
              imageCount={imageCount}
              availableSlots={availableSlots}
              showCountSelector={showCountSelector}
              isDisabled={isGenerateDisabled}
              priceLabel={priceLabel}
              onToggleCountSelector={() => setShowCountSelector(prev => !prev)}
              onCloseCountSelector={() => setShowCountSelector(false)}
              onSelectImageCount={setImageCount}
              onImpact={impact}
              onGenerate={handleGenerate}
            />
          </div>

          {/* Spacer to push content above fixed panel */}
          <div className={hasActiveGens ? 'h-[160px]' : 'h-24'} />
        </>

        <InsufficientBalanceModal
          isOpen={showBalancePopup}
          onClose={() => setShowBalancePopup(false)}
          onBuyTokens={() => {
            impact('medium')
            setShowBalancePopup(false)
            setIsPaymentModalOpen(true)
          }}
        />

        <PaymentModal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} />
        <DescribeImageModal
          isOpen={isDescribeModalOpen}
          onClose={() => setIsDescribeModalOpen(false)}
          onPromptGenerated={(generatedPrompt) => {
            setPrompt(generatedPrompt)
          }}
        />

        <TimeoutModal
          isOpen={showTimeoutModal}
          onClose={() => setShowTimeoutModal(false)}
        />

        {/* Persistent File Input */}
        <input
          key={inputKey}
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
          className="hidden"
          onClick={(e) => {
            e.stopPropagation();
            (e.target as HTMLInputElement).value = '';
          }}
        />

        {/* Camera Input */}
        <input
          key={`camera-${inputKey}`}
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleImageUpload}
          className="hidden"
          onClick={(e) => {
            e.stopPropagation();
            (e.target as HTMLInputElement).value = '';
          }}
        />

      </div>
      <ChatOnboardingOverlay />
    </div>
  )
}
