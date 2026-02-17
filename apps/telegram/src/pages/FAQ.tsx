import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronLeft } from 'lucide-react'
import { SEO } from '@/components/SEO'

const FAQ_ITEMS = [
  {
    question: 'What is AiVerse?',
    answer: 'AiVerse is an AI-powered creative platform that lets you generate stunning images and videos from text prompts. It supports multiple AI models including GPT Image, Kling, NanoBanana PRO, FLUX, and more. Available as a Telegram Mini App and a web application.'
  },
  {
    question: 'How do I generate AI images for free?',
    answer: 'Sign up on AiVerse and receive free bonus tokens daily. Use these tokens in the Studio to generate images with any available AI model. You can earn more tokens through daily bonuses, spin wheel, and referral program.'
  },
  {
    question: 'What AI models are available?',
    answer: 'AiVerse offers multiple AI models: FLUX for fast image generation, GPT Image (DALL-E) by OpenAI, Stable Diffusion XL, Kling AI and Seedance for video generation, plus GPT-4, Claude, and DeepSeek for AI chat.'
  },
  {
    question: 'Can I generate AI videos?',
    answer: 'Yes! AiVerse supports AI video generation with models like Kling AI and Seedance. You can create videos from text prompts or from existing images. Videos can be up to 10 seconds long in 1080p resolution.'
  },
  {
    question: 'How does the Telegram bot work?',
    answer: 'Open @aiversebot in Telegram and launch the Mini App. You get the full AiVerse experience directly inside Telegram — generate images, create videos, chat with AI, and participate in contests without leaving the messenger.'
  },
  {
    question: 'What are AiVerse tokens and how do I get them?',
    answer: 'Tokens are the currency used for AI generations. You receive free tokens daily, can earn more through the spin wheel and referral program, or purchase additional tokens. Different AI models require different amounts of tokens per generation.'
  },
  {
    question: 'Can I use AiVerse on desktop?',
    answer: 'Yes! AiVerse is available as a web application at aiverseapp.net. It works on any modern browser and can be installed as a PWA (Progressive Web App) for a native-like experience on desktop.'
  },
  {
    question: 'What image resolutions are supported?',
    answer: 'AiVerse supports resolutions up to 4K (4096x4096 pixels) with multiple aspect ratios: 1:1, 16:9, 9:16, 4:3, and 3:4. You can also choose from style presets like Photorealistic, Anime, Digital Art, and more.'
  },
  {
    question: 'Is there a community feature?',
    answer: 'Yes! The Home feed shows AI-generated images and videos from the community. You can like, share, and remix other users\' creations. There are also contests and leaderboards where top creators are featured.'
  },
  {
    question: 'How is AiVerse different from Midjourney or DALL-E?',
    answer: 'AiVerse aggregates multiple AI models in one platform — you can use FLUX, GPT Image, Kling, and more without switching between services. It also offers video generation, AI chat, gamification features, and is available directly in Telegram.'
  }
]

const FAQ_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map(item => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer
    }
  }))
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
      >
        <span className="text-white font-medium pr-4">{question}</span>
        <ChevronDown
          size={20}
          className={`text-zinc-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 text-zinc-400 text-sm leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  )
}

export default function FAQ() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <SEO
        title="FAQ - Frequently Asked Questions"
        description="Find answers about AiVerse AI creative platform. Learn about AI image generation, video creation, tokens, supported models, and more."
        path="/faq"
        jsonLd={FAQ_JSONLD}
      />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-zinc-900/50 border border-white/10 flex items-center justify-center text-white hover:bg-zinc-800 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold">Frequently Asked Questions</h1>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, index) => (
            <FAQItem key={index} question={item.question} answer={item.answer} />
          ))}
        </div>

        <div className="mt-12 p-6 rounded-2xl bg-gradient-to-br from-violet-950/50 to-fuchsia-950/30 border border-white/10 text-center">
          <h2 className="text-lg font-semibold mb-2">Still have questions?</h2>
          <p className="text-zinc-400 text-sm mb-4">
            Contact us at contact@aiverseapp.net or reach out via our Telegram bot @aiversebot
          </p>
        </div>
      </div>
    </div>
  )
}
